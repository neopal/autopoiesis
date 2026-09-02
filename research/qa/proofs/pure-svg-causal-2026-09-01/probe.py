import asyncio, base64, json, pathlib, urllib.request
import websockets

BASE = 'http://127.0.0.1:4179/chantiers/pure-svg/v001/'
OUT = pathlib.Path('research/qa/proofs/pure-svg-causal-2026-09-01')
OUT.mkdir(parents=True, exist_ok=True)
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
            msg = json.loads(raw)
            if 'id' in msg and msg['id'] in self.pending:
                future = self.pending.pop(msg['id'])
                if not future.done():
                    future.set_result(msg)
            else:
                self.events.append(msg)

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


async def main():
    version = json.load(urllib.request.urlopen('http://127.0.0.1:9229/json/version'))
    async with websockets.connect(version['webSocketDebuggerUrl'], max_size=50_000_000) as ws:
        cdp = CDP(ws)
        await cdp.start()
        target = await cdp.call('Target.createTarget', {'url': 'about:blank'})
        attached = await cdp.call('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True})
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
                await cdp.call('Page.navigate', {'url': BASE + f'?pulse={width}x{height}-{variant}'}, session)
                await asyncio.sleep(1.35)
                expression = '''(() => {
                  const root = document.documentElement;
                  const svg = document.querySelector('#field');
                  const field = document.querySelector('.field-wrap');
                  const svgRect = svg?.getBoundingClientRect();
                  const fieldRect = field?.getBoundingClientRect();
                  const links = [...document.querySelectorAll('a')].map(a => {
                    const r = a.getBoundingClientRect();
                    return {text: a.textContent.trim(), width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom};
                  });
                  const stage = document.querySelector('[data-stage]')?.textContent.trim() || '';
                  const memory = document.querySelector('[data-memory]')?.textContent.trim() || '';
                  return {
                    viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
                    field: fieldRect && {left: fieldRect.left, top: fieldRect.top, right: fieldRect.right, bottom: fieldRect.bottom, width: fieldRect.width, height: fieldRect.height},
                    svg: svgRect && {left: svgRect.left, top: svgRect.top, right: svgRect.right, bottom: svgRect.bottom, width: svgRect.width, height: svgRect.height},
                    firstViewportVisibleSvgPx: svgRect ? Math.max(0, Math.min(innerHeight, svgRect.bottom) - Math.max(0, svgRect.top)) : 0,
                    links,
                    minLinkWidth: links.length ? Math.min(...links.map(x => x.width)) : null,
                    minLinkHeight: links.length ? Math.min(...links.map(x => x.height)) : null,
                    controls: document.querySelectorAll('button,input,select,textarea').length,
                    stage,
                    memory,
                    svgMarkupLength: svg?.innerHTML.length || 0,
                    bodyOverflowX: getComputedStyle(document.body).overflowX,
                    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                    title: document.title,
                  };
                })()'''
                evaluated = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True}, session)
                state = evaluated.get('result', {}).get('value', {})
                if not state and 'exceptionDetails' in evaluated:
                    state = {'evaluationError': evaluated['exceptionDetails']}
                bad = []
                console_events = []
                exceptions = []
                for event in cdp.events:
                    method = event.get('method')
                    params = event.get('params', {})
                    if method == 'Network.responseReceived':
                        response = params.get('response', {})
                        url = response.get('url', '')
                        if url.startswith('http://127.0.0.1:4179') and response.get('status', 0) >= 400:
                            bad.append({'url': url, 'status': response.get('status')})
                    elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
                        console_events.append({'method': method, 'text': str(params)[:500]})
                    elif method == 'Runtime.exceptionThrown':
                        exceptions.append(str(params)[:1000])
                shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
                image_path = OUT / f'pure-svg-{width}x{height}-{variant}.png'
                image_path.write_bytes(base64.b64decode(shot['data']))
                results.append({
                    'requested': [width, height],
                    'variant': variant,
                    'state': state,
                    'errors': len(exceptions),
                    'consoleEvents': len(console_events),
                    'badFirstPartyResponses': len(bad),
                    'badResponses': bad,
                    'exceptions': exceptions,
                    'capture': str(image_path.resolve()),
                    'bytes': image_path.stat().st_size,
                })
        for reduced, media in [(False, 'no-preference'), (True, 'reduce')]:
            cdp.events.clear()
            await cdp.call('Emulation.setDeviceMetricsOverride', {
                'width': 1280,
                'height': 800,
                'deviceScaleFactor': 1,
                'mobile': False,
                'screenWidth': 1280,
                'screenHeight': 800,
            }, session)
            await cdp.call('Emulation.setEmulatedMedia', {
                'features': [{'name': 'prefers-reduced-motion', 'value': media}],
            }, session)
            variant = 'late-reduced' if reduced else 'late-normal'
            await cdp.call('Page.navigate', {'url': BASE + '?late=1'}, session)
            await asyncio.sleep(9.5)
            late_evaluated = await cdp.call('Runtime.evaluate', {
                'expression': "({stage: document.querySelector('[data-stage]')?.textContent.trim(), memory: document.querySelector('[data-memory]')?.textContent.trim(), svgMarkupLength: document.querySelector('#field')?.innerHTML.length || 0})",
                'returnByValue': True,
            }, session)
            state = late_evaluated.get('result', {}).get('value', {})
            if not state and 'exceptionDetails' in late_evaluated:
                state = {'evaluationError': late_evaluated['exceptionDetails']}
            shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
            image_path = OUT / f'pure-svg-{variant}-1280x800.png'
            image_path.write_bytes(base64.b64decode(shot['data']))
            results.append({
                'requested': [1280, 800],
                'variant': variant,
                'state': state,
                'capture': str(image_path.resolve()),
                'bytes': image_path.stat().st_size,
            })
        await cdp.call('Target.closeTarget', {'targetId': target['targetId']})
        output = {
            'route': BASE,
            'probe': 'cache-isolated Chrome 151 CDP; real device metrics and emulated media',
            'matrix': results,
        }
        (OUT / 'results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
        print(json.dumps({'route': BASE, 'runs': len(results), 'matrix': results[:10], 'late': results[10:]}, indent=2))
        await cdp.close()


asyncio.run(main())
