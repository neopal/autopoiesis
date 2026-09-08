import asyncio
import base64
import json
import pathlib
import urllib.request

import websockets

BASE = 'http://127.0.0.1:4179/studies/self-portrait/v002/?preview=1&static=1'
INTERACTIVE = 'http://127.0.0.1:4179/studies/self-portrait/v002/?preview=1&interaction=1'
OUT = pathlib.Path('research/qa/proofs/portrait-v002-2026-09-03')
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [(320, 568), (390, 844), (768, 1024), (1280, 800), (1920, 1080)]


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


def rect_script(selector):
    return f'''(() => {{
      const node = document.querySelector({json.dumps(selector)});
      const r = node?.getBoundingClientRect();
      return r && {{left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}};
    }})()'''


async def evaluate(cdp, session, expression):
    result = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True}, session)
    value = result.get('result', {}).get('value')
    if value is None and 'exceptionDetails' in result:
        return {'evaluationError': result['exceptionDetails']}
    return value


async def configure(cdp, session, width, height, reduced):
    await cdp.call('Emulation.setDeviceMetricsOverride', {
        'width': width, 'height': height, 'deviceScaleFactor': 1,
        'mobile': False, 'screenWidth': width, 'screenHeight': height,
    }, session)
    await cdp.call('Emulation.setEmulatedMedia', {
        'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced else 'no-preference'}],
    }, session)


async def collect_events(cdp):
    bad = []
    console = []
    exceptions = []
    for event in cdp.events:
        method = event.get('method')
        params = event.get('params', {})
        if method == 'Network.responseReceived':
            response = params.get('response', {})
            response_url = response.get('url', '')
            if response_url.startswith('http://127.0.0.1:4179') and response.get('status', 0) >= 400:
                bad.append({'url': response_url, 'status': response.get('status')})
        elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
            console.append({'method': method, 'text': str(params)[:500]})
        elif method == 'Runtime.exceptionThrown':
            exceptions.append(str(params)[:1000])
    return bad, console, exceptions


async def matrix_case(cdp, session, width, height, reduced):
    cdp.events.clear()
    await configure(cdp, session, width, height, reduced)
    await cdp.call('Page.navigate', {'url': BASE}, session)
    await asyncio.sleep(0.85)
    state = await evaluate(cdp, session, '''(() => {
      const root = document.documentElement;
      const canvas = document.querySelector('#field');
      const surface = document.querySelector('.work-surface');
      const heading = document.querySelector('h1');
      const rect = (node) => { const r = node?.getBoundingClientRect(); return r && {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}; };
      return {
        url: location.href,
        title: document.title,
        viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
        canvas: rect(canvas),
        surface: rect(surface),
        canvasBacking: canvas ? {width: canvas.width, height: canvas.height} : null,
        canvasBeforeHeading: Boolean(canvas && heading && (canvas.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
        stage: document.querySelector('[data-stage]')?.textContent.trim() || '',
        memory: document.querySelector('[data-memory]')?.textContent.trim() || '',
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        controls: [...document.querySelectorAll('button')].map((button) => ({text:button.textContent.trim(), display:getComputedStyle(button).display, width:button.getBoundingClientRect().width, height:button.getBoundingClientRect().height})),
        focusableArtwork: canvas?.tabIndex === -1 ? false : canvas?.tabIndex === 0,
        previewMode: root.classList.contains('preview-mode'),
        bodyOverflowX: getComputedStyle(document.body).overflowX,
      };
    })()''')
    shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
    variant = 'reduced' if reduced else 'normal'
    image_path = OUT / f'portrait-{width}x{height}-{variant}.png'
    image_path.write_bytes(base64.b64decode(shot['data']))
    bad, console, exceptions = await collect_events(cdp)
    return {
        'requested': [width, height], 'variant': variant, 'state': state,
        'errors': len(exceptions), 'consoleEvents': len(console),
        'consoleEventDetails': console[:6], 'badFirstPartyResponses': len(bad),
        'badResponses': bad, 'exceptions': exceptions,
        'capture': str(image_path.resolve()), 'bytes': image_path.stat().st_size,
    }


async def interaction_case(cdp, session, reduced=False):
    cdp.events.clear()
    await configure(cdp, session, 1280, 800, reduced)
    await cdp.call('Page.navigate', {'url': INTERACTIVE}, session)
    await asyncio.sleep(0.85)
    state = await evaluate(cdp, session, '''(() => {
      const canvas = document.querySelector('#field');
      const before = canvas.toDataURL('image/png');
      canvas.focus();
      canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      const afterKey = canvas.toDataURL('image/png');
      const afterKeyState = {stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()};
      canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      const afterSecondKey = canvas.toDataURL('image/png');
      document.querySelector('#undo-control').click();
      const afterUndo = canvas.toDataURL('image/png');
      const afterUndoState = {stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()};
      document.querySelector('#release-control').click();
      return {
        changedAfterKeyboard: before !== afterKey,
        changedAfterSecondKeyboard: afterKey !== afterSecondKey,
        changedAfterUndo: afterSecondKey !== afterUndo,
        afterKeyState, afterUndoState,
        focusedArtwork: document.activeElement === canvas,
        controls: [...document.querySelectorAll('button')].map((button) => ({text:button.textContent.trim(), display:getComputedStyle(button).display, width:button.getBoundingClientRect().width, height:button.getBoundingClientRect().height})),
      };
    })()''')
    bad, console, exceptions = await collect_events(cdp)
    return {
        'reducedMotion': reduced, 'state': state, 'errors': len(exceptions),
        'consoleEvents': len(console), 'consoleEventDetails': console[:6],
        'badFirstPartyResponses': len(bad), 'badResponses': bad, 'exceptions': exceptions,
    }


async def pointer_case(cdp, session):
    cdp.events.clear()
    await configure(cdp, session, 1280, 800, False)
    await cdp.call('Page.navigate', {'url': INTERACTIVE}, session)
    await asyncio.sleep(0.85)
    bounds = await evaluate(cdp, session, rect_script('#field'))
    x = bounds['left'] + bounds['width'] * 0.14
    y = bounds['top'] + bounds['height'] * 0.46
    before = await evaluate(cdp, session, "document.querySelector('#field').toDataURL('image/png')")
    await cdp.call('Input.dispatchMouseEvent', {'type':'mousePressed', 'x':x, 'y':y, 'button':'left', 'buttons':1, 'clickCount':1}, session)
    await cdp.call('Input.dispatchMouseEvent', {'type':'mouseReleased', 'x':x, 'y':y, 'button':'left', 'buttons':0, 'clickCount':1}, session)
    await asyncio.sleep(.1)
    after = await evaluate(cdp, session, "document.querySelector('#field').toDataURL('image/png')")
    state = await evaluate(cdp, session, "(() => ({stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()}))()")
    bad, console, exceptions = await collect_events(cdp)
    return {
        'gesture': 'CDP mouse press/release at 14% field width',
        'state': state, 'changed': before != after, 'errors': len(exceptions),
        'consoleEvents': len(console), 'consoleEventDetails': console[:6],
        'badFirstPartyResponses': len(bad), 'badResponses': bad, 'exceptions': exceptions,
    }


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
        matrix = []
        for width, height in VIEWPORTS:
            for reduced in (False, True):
                matrix.append(await matrix_case(cdp, session, width, height, reduced))
        interaction = await interaction_case(cdp, session, False)
        reduced_interaction = await interaction_case(cdp, session, True)
        pointer = await pointer_case(cdp, session)
        await cdp.call('Target.closeTarget', {'targetId': target['targetId']})
        output = {
            'route': BASE,
            'probe': 'cache-isolated Chrome 151 CDP; real device metrics and emulated media',
            'matrix': matrix,
            'interaction': interaction,
            'reducedInteraction': reduced_interaction,
            'pointer': pointer,
        }
        (OUT / 'results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
        print(json.dumps(output, indent=2))
        await cdp.close()


asyncio.run(main())
