import asyncio
import base64
import json
import pathlib
import urllib.request
import websockets

BASE = 'http://127.0.0.1:4179/chantiers/p5-brush/v002/'
OUT = pathlib.Path(__file__).resolve().parent
VIEWPORTS = [(320, 568), (390, 844), (768, 1024), (1280, 800), (1920, 1080)]

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
    bad_responses, console_events, exceptions, loading_failures = [], [], [], []
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
            target_id = (await cdp.call('Target.createTarget', {'url': 'about:blank'}))['targetId']
            session = (await cdp.call('Target.attachToTarget', {'targetId': target_id, 'flatten': True}))['sessionId']
            for method in ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']:
                await cdp.call(method, session=session)
            await cdp.call('Network.setCacheDisabled', {'cacheDisabled': True}, session)
            results = []
            for width, height in VIEWPORTS:
                for motion in ['normal', 'reduced']:
                    cdp.events.clear()
                    await cdp.call('Emulation.setDeviceMetricsOverride', {
                        'width': width, 'height': height, 'deviceScaleFactor': 1,
                        'mobile': False, 'screenWidth': width, 'screenHeight': height,
                    }, session)
                    await cdp.call('Emulation.setEmulatedMedia', {
                        'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if motion == 'reduced' else 'no-preference'}]
                    }, session)
                    url = BASE + f'?qa=brush-{width}x{height}-{motion}'
                    navigation = await cdp.call('Page.navigate', {'url': url}, session)
                    if navigation.get('errorText'):
                        raise RuntimeError(f'Navigation failed: {navigation["errorText"]}')
                    await asyncio.sleep(1.15)
                    state = await evaluate(cdp, '''(() => {
                      const root = document.documentElement;
                      const field = document.querySelector('#field');
                      const wrap = document.querySelector('.field-wrap');
                      const canvas = field?.getBoundingClientRect();
                      const main = document.querySelector('.studio-main');
                      const order = [...(main?.children || [])].map(node => node.className || node.tagName.toLowerCase());
                      const links = [...document.querySelectorAll('a')].map(a => {
                        const r = a.getBoundingClientRect();
                        return {text: a.textContent.trim(), width: r.width, height: r.height};
                      });
                      return {
                        viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
                        media: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'normal',
                        canvas: canvas && {left: canvas.left, top: canvas.top, right: canvas.right, bottom: canvas.bottom, width: canvas.width, height: canvas.height, pixels: field.width * field.height, dataUrlLength: field.toDataURL().length},
                        fieldWrap: wrap && {top: wrap.getBoundingClientRect().top, bottom: wrap.getBoundingClientRect().bottom},
                        stage: document.querySelector('[data-stage]')?.textContent.trim(),
                        memory: document.querySelector('[data-memory]')?.textContent.trim(),
                        order,
                        surfaceBeforeOpening: order.indexOf('work-surface') >= 0 && order.indexOf('work-surface') < order.indexOf('work-opening'),
                        controls: document.querySelectorAll('button,input,select,textarea').length,
                        linkBoxes: links,
                        minLinkHeight: Math.min(...links.map(link => link.height)),
                        bodyOverflowX: getComputedStyle(document.body).overflowX,
                        title: document.title,
                        ready: Boolean(field && field.toDataURL().length > 1000),
                      };
                    })()''', session)
                    bad, console_events, exceptions, loading_failures = event_failures(cdp)
                    shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
                    image_path = OUT / f'brush-v002-{width}x{height}-{motion}.png'
                    image_path.write_bytes(base64.b64decode(shot['data']))
                    results.append({
                        'requested': [width, height], 'motion': motion, 'url': url,
                        'validViewport': state['viewport']['innerWidth'] == width and state['viewport']['innerHeight'] == height,
                        'state': state, 'exceptions': exceptions, 'consoleEvents': console_events,
                        'badFirstPartyResponses': bad, 'networkLoadingFailures': loading_failures,
                        'capture': str(image_path.resolve()), 'bytes': image_path.stat().st_size,
                    })
            output = {
                'route': BASE,
                'probe': 'cache-isolated Chrome 151 CDP; real device metrics and emulated reduced motion',
                'matrix': results,
            }
            (OUT / 'results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
            summary = {
                'route': BASE,
                'runs': len(results),
                'validViewports': sum(row['validViewport'] for row in results),
                'consoleEvents': sum(len(row['consoleEvents']) for row in results),
                'exceptions': sum(len(row['exceptions']) for row in results),
                'badResponses': sum(len(row['badFirstPartyResponses']) for row in results),
                'loadingFailures': sum(len(row['networkLoadingFailures']) for row in results),
                'blankCanvases': sum(not row['state']['ready'] for row in results),
                'surfaceBeforeOpening': sum(row['state']['surfaceBeforeOpening'] for row in results),
                'reducedStages': [row['state']['stage'] for row in results if row['motion'] == 'reduced'],
                'minLinkHeight': min(row['state']['minLinkHeight'] for row in results),
            }
            print(json.dumps(summary, indent=2))
        finally:
            if target_id:
                try:
                    await cdp.call('Target.closeTarget', {'targetId': target_id})
                except Exception:
                    pass
            await cdp.close()

asyncio.run(main())
