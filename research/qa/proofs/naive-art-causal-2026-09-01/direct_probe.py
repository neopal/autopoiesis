import asyncio, base64, json, pathlib, urllib.request
import websockets

BASE = 'http://127.0.0.1:4179/chantiers/naive-art/v001/'
OUT = pathlib.Path(__file__).resolve().parent
VIEWPORTS = [(320, 568), (390, 844), (1280, 800)]


class CDP:
    def __init__(self, ws):
        self.ws = ws
        self.next_id = 0
        self.pending = {}
        self.events = []
        self.reader_task = None

    async def start(self):
        self.reader_task = asyncio.create_task(self.reader())

    async def reader(self):
        async for raw in self.ws:
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
        await self.ws.send(json.dumps(payload))
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
    async with websockets.connect(version['webSocketDebuggerUrl'], max_size=50_000_000) as ws:
        cdp = CDP(ws)
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
                for reduced, media in [(False, 'no-preference'), (True, 'reduce')]:
                    cdp.events.clear()
                    await cdp.call('Emulation.setDeviceMetricsOverride', {
                        'width': width,
                        'height': height,
                        'deviceScaleFactor': 1,
                        'mobile': False,
                        'screenWidth': width,
                        'screenHeight': height,
                    }, session)
                    await cdp.call('Emulation.setEmulatedMedia', {
                        'features': [{'name': 'prefers-reduced-motion', 'value': media}],
                    }, session)
                    variant = 'reduced' if reduced else 'normal'
                    navigation = await cdp.call('Page.navigate', {'url': BASE + f'?pulse={width}x{height}-{variant}'}, session)
                    if navigation.get('errorText'):
                        raise RuntimeError(f'Navigation failed: {navigation["errorText"]}')
                    await asyncio.sleep(1.1)
                    state = await evaluate(cdp, '''(() => {
                      const root = document.documentElement;
                      const canvas = document.querySelector('#field');
                      const opening = document.querySelector('.work-opening');
                      if (!canvas || !opening) throw new Error('required direct-route nodes missing');
                      const rect = canvas.getBoundingClientRect();
                      const links = [...document.querySelectorAll('a')];
                      return {
                        viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth},
                        canvas: {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height},
                        firstViewportVisibleCanvasPx: Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)),
                        canvasFirstInMain: Boolean(canvas.compareDocumentPosition(opening) & Node.DOCUMENT_POSITION_FOLLOWING),
                        stage: document.querySelector('[data-stage]')?.textContent.trim(),
                        memory: document.querySelector('[data-memory]')?.textContent.trim(),
                        controls: document.querySelectorAll('button,input,select,textarea').length,
                        linkCount: links.length,
                        minLinkHeight: links.length ? Math.min(...links.map(a => a.getBoundingClientRect().height)) : 0,
                        bodyOverflowX: getComputedStyle(document.body).overflowX,
                        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                        title: document.title
                      };
                    })()''', session)
                    bad, console_events, exceptions, loading_failures = event_failures(cdp)
                    if exceptions or loading_failures:
                        raise RuntimeError(f'Browser errors at {width}x{height}-{variant}: exceptions={exceptions}, loadingFailures={loading_failures}')
                    shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
                    image_path = OUT / f'naive-direct-{width}x{height}-{variant}.png'
                    image_path.write_bytes(base64.b64decode(shot['data']))
                    results.append({
                        'requested': [width, height],
                        'variant': variant,
                        'validViewport': state['viewport']['innerWidth'] == width and state['viewport']['innerHeight'] == height,
                        'state': state,
                        'exceptions': exceptions,
                        'consoleEvents': console_events,
                        'badFirstPartyResponses': bad,
                        'networkLoadingFailures': loading_failures,
                        'capture': str(image_path.resolve()),
                        'bytes': image_path.stat().st_size,
                    })
            output = {
                'route': BASE,
                'probe': 'cache-isolated Chrome 151 CDP; real device metrics and emulated media',
                'matrix': results,
            }
            (OUT / 'direct-results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
            print(json.dumps({'route': BASE, 'runs': len(results), 'valid': all(x['validViewport'] for x in results), 'consoleEvents': [len(x['consoleEvents']) for x in results], 'badResponses': [x['badFirstPartyResponses'] for x in results], 'loadingFailures': [x['networkLoadingFailures'] for x in results], 'states': [x['state'] for x in results]}, indent=2))
        finally:
            if target_id:
                try:
                    await cdp.call('Target.closeTarget', {'targetId': target_id})
                except Exception:
                    pass
            await cdp.close()


asyncio.run(main())
