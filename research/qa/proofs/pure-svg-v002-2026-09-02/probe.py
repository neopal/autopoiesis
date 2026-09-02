import asyncio
import base64
import json
import pathlib
import urllib.request

import websockets

BASE = 'http://127.0.0.1:4179/studies/pure-svg/v002/?preview=1'
OUT = pathlib.Path('research/qa/proofs/pure-svg-v002-2026-09-02')
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


async def navigate(cdp, session, url, width, height, reduced):
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
        'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced else 'no-preference'}],
    }, session)
    await cdp.call('Page.navigate', {'url': url}, session)
    await asyncio.sleep(1.15)
    expression = '''(() => {
      const root = document.documentElement;
      const field = document.querySelector('.field-wrap');
      const svg = document.querySelector('#field');
      const heading = document.querySelector('h1');
      const buttons = [...document.querySelectorAll('button')];
      const rect = (node) => {
        const r = node?.getBoundingClientRect();
        return r && {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
      };
      return {
        url: location.href,
        title: document.title,
        viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
        field: rect(field),
        svg: rect(svg),
        svgMarkupLength: svg?.innerHTML.length || 0,
        svgBeforeHeading: Boolean(svg && heading && (svg.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
        stage: document.querySelector('[data-stage]')?.textContent.trim() || '',
        memory: document.querySelector('[data-memory]')?.textContent.trim() || '',
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        visibleControls: buttons.filter((button) => getComputedStyle(button).display !== 'none').map((button) => ({text:button.textContent.trim(), rect:rect(button)})),
        focusableArtwork: svg?.tabIndex === 0,
        bodyOverflowX: getComputedStyle(document.body).overflowX,
      };
    })()'''
    evaluated = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True}, session)
    state = evaluated.get('result', {}).get('value', {})
    if not state and 'exceptionDetails' in evaluated:
        state = {'evaluationError': evaluated['exceptionDetails']}

    bad_responses = []
    console_events = []
    exceptions = []
    for event in cdp.events:
        method = event.get('method')
        params = event.get('params', {})
        if method == 'Network.responseReceived':
            response = params.get('response', {})
            response_url = response.get('url', '')
            if response_url.startswith('http://127.0.0.1:4179') and response.get('status', 0) >= 400:
                bad_responses.append({'url': response_url, 'status': response.get('status')})
        elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
            console_events.append({'method': method, 'text': str(params)[:500]})
        elif method == 'Runtime.exceptionThrown':
            exceptions.append(str(params)[:1000])

    shot = await cdp.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}, session)
    variant = 'reduced' if reduced else 'normal'
    image_path = OUT / f'pure-svg-{width}x{height}-{variant}.png'
    image_path.write_bytes(base64.b64decode(shot['data']))
    return {
        'requested': [width, height],
        'variant': variant,
        'state': state,
        'errors': len(exceptions),
        'consoleEvents': len(console_events),
        'consoleEventDetails': console_events[:6],
        'badFirstPartyResponses': len(bad_responses),
        'badResponses': bad_responses,
        'exceptions': exceptions,
        'capture': str(image_path.resolve()),
        'bytes': image_path.stat().st_size,
    }


async def interaction_probe(cdp, session, reduced=False):
    await cdp.call('Emulation.setDeviceMetricsOverride', {
        'width': 1280,
        'height': 800,
        'deviceScaleFactor': 1,
        'mobile': False,
        'screenWidth': 1280,
        'screenHeight': 800,
    }, session)
    await cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce' if reduced else 'no-preference'}]}, session)
    cdp.events.clear()
    await cdp.call('Page.navigate', {'url': BASE + '&interaction=1'}, session)
    await asyncio.sleep(0.8)
    expression = '''(() => {
      const svg = document.querySelector('#field');
      const buttons = [...document.querySelectorAll('button')];
      const rect = (node) => {
        const r = node?.getBoundingClientRect();
        return r && {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
      };
      const before = svg.innerHTML;
      svg.focus();
      svg.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      const afterKey = svg.innerHTML;
      const stateAfterKey = {stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()};
      svg.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
      const afterSecondCut = svg.innerHTML;
      const stateAfterSecondCut = {stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()};
      const activeScar = svg.querySelector('.active-scar');
      document.querySelector('#delete-control').click();
      const afterDelete = svg.innerHTML;
      const stateAfterDelete = {stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim()};
      document.querySelector('#release-control').click();
      return {
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        changedAfterKeyboard: before !== afterKey,
        changedAfterSecondCut: afterSecondCut !== afterKey,
        changedAfterDelete: afterSecondCut !== afterDelete,
        stateAfterKey,
        stateAfterSecondCut,
        stateAfterDelete,
        focusedArtwork: document.activeElement === svg,
        activeScarAnimation: activeScar ? getComputedStyle(activeScar).animationName : null,
        visibleControls: buttons.map((button) => ({text:button.textContent.trim(), rect:rect(button), display:getComputedStyle(button).display}))
      };
    })()'''
    evaluated = await cdp.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True}, session)
    state = evaluated.get('result', {}).get('value', {})
    if not state and 'exceptionDetails' in evaluated:
        state = {'evaluationError': evaluated['exceptionDetails']}
    return state


async def pointer_probe(cdp, session):
    await cdp.call('Emulation.setDeviceMetricsOverride', {
        'width': 1280,
        'height': 800,
        'deviceScaleFactor': 1,
        'mobile': False,
        'screenWidth': 1280,
        'screenHeight': 800,
    }, session)
    await cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]}, session)
    cdp.events.clear()
    await cdp.call('Page.navigate', {'url': BASE + '&interaction=1'}, session)
    await asyncio.sleep(0.8)
    bounds = None
    bounds_result = None
    for _ in range(10):
        bounds_result = await cdp.call('Runtime.evaluate', {
            'expression': "(() => { const field = document.querySelector('#field'); if (!field) return null; const r = field.getBoundingClientRect(); window.__mutineBefore = field.innerHTML; return {left:r.left, top:r.top, width:r.width, height:r.height}; })()",
            'returnByValue': True,
        }, session)
        bounds = bounds_result.get('result', {}).get('value')
        if bounds:
            break
        await asyncio.sleep(0.2)
    if not bounds:
        return {'evaluationError': bounds_result or {'description': 'SVG field did not attach'}}
    gesture_x = bounds['left'] + bounds['width'] * 0.06
    gesture_y = bounds['top'] + bounds['height'] / 2
    await cdp.call('Input.dispatchMouseEvent', {
        'type': 'mousePressed', 'x': gesture_x,
        'y': gesture_y, 'button': 'left', 'buttons': 1,
        'clickCount': 1,
    }, session)
    await cdp.call('Input.dispatchMouseEvent', {
        'type': 'mouseReleased', 'x': gesture_x,
        'y': gesture_y, 'button': 'left', 'buttons': 0,
        'clickCount': 1,
    }, session)
    await asyncio.sleep(0.1)
    state_result = await cdp.call('Runtime.evaluate', {
        'expression': "(() => ({changed:document.querySelector('#field').innerHTML !== window.__mutineBefore, stage:document.querySelector('[data-stage]')?.textContent.trim(), memory:document.querySelector('[data-memory]')?.textContent.trim(), activeScarCx:document.querySelector('.active-scar circle')?.getAttribute('cx')}))()",
        'returnByValue': True,
    }, session)
    state = state_result.get('result', {}).get('value', {})
    if 'exceptionDetails' in state_result:
        state = {'evaluationError': state_result['exceptionDetails']}
    await cdp.call('Runtime.evaluate', {'expression': "document.querySelector('#release-control')?.click()", 'returnByValue': True}, session)
    return {'gesture': 'CDP mouse press/release at SVG center', 'state': state}


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
        await cdp.call('Network.setCacheDisabled', {'cacheDisabled': True}, session)
        matrix = []
        for width, height in VIEWPORTS:
            for reduced in (False, True):
                matrix.append(await navigate(cdp, session, BASE, width, height, reduced))
        interaction = await interaction_probe(cdp, session, reduced=False)
        reduced_interaction = await interaction_probe(cdp, session, reduced=True)
        pointer = await pointer_probe(cdp, session)
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
