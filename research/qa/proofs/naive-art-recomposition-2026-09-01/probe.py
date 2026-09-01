import asyncio, base64, json, pathlib, urllib.request
import websockets

BASE = 'http://127.0.0.1:4179/research/qa/proofs/naive-art-recomposition-2026-09-01/'
OUT = pathlib.Path(__file__).resolve().parent
VIEWPORTS = [(320, 568), (390, 844), (1280, 800)]
EXPECTED_PROBE = {
    'stage': 5,
    'fullMemory': 5,
    'deletedMemory': 4,
    'doorDelta': -0.01135429450403913,
    'pathDelta': -0.07354944689058701,
    'canvasOnly': True,
}


class CDP:
    def __init__(self, websocket):
        self.websocket = websocket
        self.next_id = 0
        self.pending = {}
        self.events = []
        self.reader_task = None

    async def start(self):
        self.reader_task = asyncio.create_task(self.reader())

    async def reader(self):
        async for raw in self.websocket:
            message = json.loads(raw)
            if 'id' in message and message['id'] in self.pending:
                future = self.pending.pop(message['id'])
                if not future.done():
                    future.set_result(message)
            else:
                self.events.append(message)

    async def call(self, method, params=None, session=None):
        self.next_id += 1
        ident = self.next_id
        future = asyncio.get_running_loop().create_future()
        self.pending[ident] = future
        payload = {'id': ident, 'method': method, 'params': params or {}}
        if session:
            payload['sessionId'] = session
        await self.websocket.send(json.dumps(payload))
        message = await asyncio.wait_for(future, 15)
        if 'error' in message:
            raise RuntimeError(f'{method}: {message["error"]}')
        return message.get('result', {})

    async def close(self):
        if self.reader_task:
            self.reader_task.cancel()


async def evaluate(cdp, expression, session):
    result = await cdp.call('Runtime.evaluate', {
        'expression': expression,
        'returnByValue': True,
        'awaitPromise': True,
    }, session)
    if 'exceptionDetails' in result:
        raise RuntimeError(f'Runtime.evaluate failed: {result["exceptionDetails"]}')
    value = result.get('result', {}).get('value')
    if value is None:
        raise RuntimeError(f'Runtime.evaluate returned no value: {result}')
    return value


def event_failures(cdp):
    bad_responses = []
    console_events = []
    exceptions = []
    loading_failures = []
    for event in cdp.events:
        method = event.get('method')
        params = event.get('params', {})
        if method == 'Network.responseReceived':
            response = params.get('response', {})
            url = response.get('url', '')
            if url.startswith('http://127.0.0.1:4179') and response.get('status', 0) >= 400:
                bad_responses.append({'url': url, 'status': response.get('status')})
        elif method == 'Network.loadingFailed':
            loading_failures.append({
                'requestId': params.get('requestId'),
                'errorText': params.get('errorText'),
                'blockedReason': params.get('blockedReason'),
                'canceled': params.get('canceled', False),
            })
        elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
            console_events.append({'method': method, 'text': str(params)[:500]})
        elif method == 'Runtime.exceptionThrown':
            exceptions.append(str(params)[:1000])
    return bad_responses, console_events, exceptions, loading_failures


async def main():
    version = json.load(urllib.request.urlopen('http://127.0.0.1:9229/json/version'))
    browser = version.get('Browser', '')
    if not browser.startswith('Chrome/151.'):
        raise RuntimeError(f'Expected Chrome 151, received {browser!r}')
    async with websockets.connect(version['webSocketDebuggerUrl'], max_size=50_000_000) as websocket:
        cdp = CDP(websocket)
        await cdp.start()
        target_id = None
        try:
            target = await cdp.call('Target.createTarget', {'url': 'about:blank'})
            target_id = target['targetId']
            attached = await cdp.call('Target.attachToTarget', {'targetId': target_id, 'flatten': True})
            session = attached['sessionId']
            for method in ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']:
                await cdp.call(method, session=session)
            await cdp.call('Network.setCacheDisabled', {'cacheDisabled': True}, session)
            results = []
            for width, height in VIEWPORTS:
                cdp.events.clear()
                await cdp.call('Emulation.setDeviceMetricsOverride', {
                    'width': width,
                    'height': height,
                    'deviceScaleFactor': 1,
                    'mobile': False,
                    'screenWidth': width,
                    'screenHeight': height,
                }, session)
                target_url = BASE + f'?study={width}x{height}'
                await cdp.call('Page.navigate', {'url': target_url}, session)
                await asyncio.sleep(0.8)
                state = await evaluate(cdp, '''(() => {
                  const root = document.documentElement;
                  const canvas = document.querySelector('#study');
                  const probe = window.__naiveRecompositionProbe;
                  if (!canvas || !probe) throw new Error('required canvas/probe state missing');
                  const rect = canvas.getBoundingClientRect();
                  return {
                    url: location.href,
                    readyState: document.readyState,
                    viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
                    canvas: {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, pixels: canvas.width * canvas.height},
                    artworkPixels: (() => {
                      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                      let count = 0;
                      for (let index = 0; index < data.length; index += 4) {
                        const paperDistance = Math.abs(data[index] - 242) + Math.abs(data[index + 1] - 231) + Math.abs(data[index + 2] - 209);
                        if (paperDistance > 18) count += 1;
                      }
                      return count;
                    })(),
                    textNodes: [...document.body.querySelectorAll('*')].filter(node => node.tagName !== 'SCRIPT' && node.children.length === 0 && node.textContent.trim()).map(node => node.textContent.trim()),
                    controls: document.querySelectorAll('button,input,select,textarea,a').length,
                    probe,
                    title: document.title
                  };
                })()''', session)
                bad, console_events, exceptions, loading_failures = event_failures(cdp)
                viewport = state['viewport']
                canvas = state['canvas']
                if state['readyState'] != 'complete':
                    raise RuntimeError(f'Page did not settle at {width}x{height}: {state["readyState"]}')
                if state['url'] != target_url:
                    raise RuntimeError(f'Navigation did not preserve the study URL at {width}x{height}: {state["url"]!r}')
                if viewport['innerWidth'] != width or viewport['innerHeight'] != height:
                    raise RuntimeError(f'Invalid viewport at {width}x{height}: {viewport}')
                if viewport['scrollWidth'] > width or viewport['scrollHeight'] > height:
                    raise RuntimeError(f'Overflow at {width}x{height}: {viewport}')
                if canvas['left'] < 0 or canvas['top'] < 0 or canvas['right'] > width or canvas['bottom'] > height:
                    raise RuntimeError(f'Canvas escapes viewport at {width}x{height}: {canvas}')
                if state['artworkPixels'] <= 0:
                    raise RuntimeError(f'Artwork pixels are missing at {width}x{height}')
                if state['textNodes'] or state['controls']:
                    raise RuntimeError(f'Caption/control leak at {width}x{height}: text={state["textNodes"]}, controls={state["controls"]}')
                if state['probe'] != EXPECTED_PROBE:
                    raise RuntimeError(f'Unexpected deterministic study state at {width}x{height}: {state["probe"]}')
                if console_events or exceptions or loading_failures or bad:
                    raise RuntimeError(f'Browser errors at {width}x{height}: console={console_events}, exceptions={exceptions}, loadingFailures={loading_failures}, badResponses={bad}')
                shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
                image_path = OUT / f'naive-recomposition-{width}x{height}.png'
                image_path.write_bytes(base64.b64decode(shot['data']))
                results.append({
                    'requested': [width, height],
                    'validViewport': state['viewport']['innerWidth'] == width and state['viewport']['innerHeight'] == height,
                    'state': state,
                    'exceptions': exceptions,
                    'consoleEvents': console_events,
                    'badFirstPartyResponses': bad,
                    'networkLoadingFailures': loading_failures,
                    'capture': str(image_path.relative_to(OUT)),
                    'bytes': image_path.stat().st_size,
                })
            output = {
                'route': BASE,
                'browser': browser,
                'probe': 'cache-isolated Chrome 151 CDP; real device metrics; disposable downstream consequence re-composition',
                'matrix': results,
            }
            (OUT / 'results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
            print(json.dumps({
                'route': BASE,
                'runs': len(results),
                'valid': all(item['validViewport'] for item in results),
                'consoleEvents': [len(item['consoleEvents']) for item in results],
                'exceptions': [len(item['exceptions']) for item in results],
                'badResponses': [item['badFirstPartyResponses'] for item in results],
                'loadingFailures': [item['networkLoadingFailures'] for item in results],
                'textNodes': [item['state']['textNodes'] for item in results],
                'probe': results[0]['state']['probe'],
            }, indent=2))
        finally:
            if target_id:
                try:
                    await cdp.call('Target.closeTarget', {'targetId': target_id})
                except Exception:
                    pass
            await cdp.close()


asyncio.run(main())
