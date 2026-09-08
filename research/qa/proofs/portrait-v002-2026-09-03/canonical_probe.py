import asyncio
import json
import pathlib
import urllib.request

import websockets

ROOT = 'http://127.0.0.1:4179'
RAW = ROOT + '/studies/self-portrait/v002/'
CANONICAL = ROOT + '/works/portrait-2026-09-03/'
OUT = pathlib.Path('research/qa/proofs/portrait-v002-2026-09-03')


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


async def evaluate(cdp, session, expression):
    result = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True}, session)
    value = result.get('result', {}).get('value')
    if value is None and 'exceptionDetails' in result:
        return {'evaluationError': result['exceptionDetails']}
    return value


async def inspect(cdp, session, url, width, height, reduced):
    cdp.events.clear()
    await cdp.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': False, 'screenWidth': width, 'screenHeight': height}, session)
    await cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced else 'no-preference'}]}, session)
    await cdp.call('Page.navigate', {'url': url}, session)
    await asyncio.sleep(1.35)
    state = await evaluate(cdp, session, '''(() => {
      const root = document.documentElement;
      const mount = document.querySelector('[data-catalog-work-detail]');
      const iframe = document.querySelector('.work-inspect__stage iframe');
      const rect = (node) => { const r = node?.getBoundingClientRect(); return r && {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
      return {
        url: location.href,
        title: document.title,
        viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth},
        mountReady: mount?.dataset.ready || null,
        timelineLabel: document.querySelector('.work-timeline-bar__heading strong')?.textContent.trim() || null,
        iframe: rect(iframe),
        iframeSrc: iframe?.getAttribute('src') || null,
        iframeLoaded: Boolean(iframe?.contentDocument?.querySelector('#field')),
        iframePreviewMode: iframe?.contentDocument?.documentElement.classList.contains('preview-mode') || false,
        iframeCanvas: rect(iframe?.contentDocument?.querySelector('#field')),
        firstMainChild: document.querySelector('.studio-main')?.firstElementChild?.className || null,
        errorsText: document.querySelector('.catalog-state--error')?.textContent.trim() || null,
      };
    })()''')
    shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
    name = 'canonical-mobile-reduced' if width == 320 else 'canonical-desktop'
    capture = OUT / f'{name}.png'
    capture.write_bytes(__import__('base64').b64decode(shot['data']))
    bad = []
    console = []
    exceptions = []
    for event in cdp.events:
        method = event.get('method')
        params = event.get('params', {})
        if method == 'Network.responseReceived':
            response = params.get('response', {})
            if response.get('url', '').startswith(ROOT) and response.get('status', 0) >= 400:
                bad.append({'url': response.get('url'), 'status': response.get('status')})
        elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
            console.append({'method': method, 'text': str(params)[:500]})
        elif method == 'Runtime.exceptionThrown':
            exceptions.append(str(params)[:1000])
    return {'requestedUrl': url, 'reduced': reduced, 'state': state, 'errors': len(exceptions), 'consoleEvents': len(console), 'consoleEventDetails': console[:6], 'badFirstPartyResponses': len(bad), 'badResponses': bad, 'exceptions': exceptions}


async def main():
    version = json.load(urllib.request.urlopen('http://127.0.0.1:9223/json/version'))
    async with websockets.connect(version['webSocketDebuggerUrl'], max_size=50_000_000) as websocket:
        cdp = CDP(websocket)
        await cdp.start()
        target = await cdp.call('Target.createTarget', {'url': 'about:blank'})
        attached = await cdp.call('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True})
        session = attached['sessionId']
        for method in ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']:
            await cdp.call(method, session=session)
        await cdp.call('Network.setCacheDisabled', {'cacheDisabled': True}, session)
        raw = await inspect(cdp, session, RAW, 1280, 800, False)
        canonical = await inspect(cdp, session, CANONICAL, 1280, 800, False)
        canonical_mobile = await inspect(cdp, session, CANONICAL, 320, 568, True)
        await cdp.call('Target.closeTarget', {'targetId': target['targetId']})
        output = {'rawBridge': raw, 'canonical': canonical, 'canonicalMobileReduced': canonical_mobile}
        (OUT / 'canonical-results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
        print(json.dumps(output, indent=2))
        await cdp.close()


asyncio.run(main())
