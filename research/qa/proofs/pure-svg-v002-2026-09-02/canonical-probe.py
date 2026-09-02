import asyncio
import json
import pathlib
import urllib.request

import websockets

URL = 'http://127.0.0.1:4179/works/svg-2026-09-02/'
OUT = pathlib.Path('research/qa/proofs/pure-svg-v002-2026-09-02/canonical-results.json')


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


async def main():
    version = json.load(urllib.request.urlopen('http://127.0.0.1:9229/json/version'))
    async with websockets.connect(version['webSocketDebuggerUrl'], max_size=50_000_000) as websocket:
        cdp = CDP(websocket)
        await cdp.start()
        target = await cdp.call('Target.createTarget', {'url': 'about:blank'})
        attached = await cdp.call('Target.attachToTarget', {'targetId': target['targetId'], 'flatten': True})
        session = attached['sessionId']
        for method in ['Page.enable', 'Runtime.enable', 'Network.enable', 'Log.enable']:
            await cdp.call(method, session=session)
        await cdp.call('Emulation.setDeviceMetricsOverride', {
            'width': 1280,
            'height': 800,
            'deviceScaleFactor': 1,
            'mobile': False,
            'screenWidth': 1280,
            'screenHeight': 800,
        }, session)
        await cdp.call('Page.navigate', {'url': URL}, session)
        await asyncio.sleep(1.25)
        expression = '''(() => {
          const root = document.documentElement;
          const iframe = document.querySelector('iframe[title*="full artwork"]');
          const inner = iframe?.contentDocument;
          return {
            url: location.href,
            title: document.title,
            viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth},
            mountReady: document.querySelector('[data-catalog-work-detail="svg-2026-09-02"]')?.dataset.ready === 'true',
            h1: document.querySelector('h1')?.textContent.trim() || '',
            iframeSrc: iframe?.src || '',
            iframeField: Boolean(inner?.querySelector('#field')),
            iframeMarkupLength: inner?.querySelector('#field')?.innerHTML.length || 0,
            iframeControls: [...(inner?.querySelectorAll('button') ?? [])].map((button) => {
              const rect = button.getBoundingClientRect();
              return {text:button.textContent.trim(), display:getComputedStyle(button).display, width:rect.width, height:rect.height};
            }),
            timeline: document.querySelector('.work-timeline')?.textContent.trim() || '',
            primaryLinks: [...document.querySelectorAll('nav[aria-label="Studio navigation"] a')].map((a) => a.textContent.trim()),
          };
        })()'''
        evaluated = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True}, session)
        state = evaluated.get('result', {}).get('value', {})
        bad_responses = []
        console_errors = []
        exceptions = []
        for event in cdp.events:
            method = event.get('method')
            params = event.get('params', {})
            if method == 'Network.responseReceived':
                response = params.get('response', {})
                response_url = response.get('url', '')
                if response_url.startswith('http://127.0.0.1:4179') and response.get('status', 0) >= 400:
                    bad_responses.append({'url': response_url, 'status': response.get('status')})
            elif method == 'Log.entryAdded' and params.get('entry', {}).get('level') == 'error':
                console_errors.append(str(params)[:500])
            elif method == 'Runtime.exceptionThrown':
                exceptions.append(str(params)[:1000])
        output = {
            'url': URL,
            'state': state,
            'badResponses': bad_responses,
            'consoleErrors': console_errors,
            'exceptions': exceptions,
        }
        OUT.write_text(json.dumps(output, indent=2), encoding='utf-8')
        print(json.dumps(output, indent=2))
        await cdp.call('Target.closeTarget', {'targetId': target['targetId']})
        cdp.reader_task.cancel()


asyncio.run(main())
