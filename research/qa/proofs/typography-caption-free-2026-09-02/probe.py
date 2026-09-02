import asyncio
import base64
import json
import math
import pathlib
import urllib.request
from urllib.parse import urlsplit

import websockets

BASE = 'http://127.0.0.1:4179/research/qa/proofs/typography-caption-free-2026-09-02/index.html'
OUT = pathlib.Path('research/qa/proofs/typography-caption-free-2026-09-02')
OUT.mkdir(parents=True, exist_ok=True)
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
        identifier = self.next_id
        future = asyncio.get_running_loop().create_future()
        self.pending[identifier] = future
        payload = {'id': identifier, 'method': method, 'params': params or {}}
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
    evaluated = await cdp.call('Runtime.evaluate', {
        'expression': expression,
        'returnByValue': True,
        'awaitPromise': True,
    }, session)
    if 'exceptionDetails' in evaluated:
        raise RuntimeError(f'Runtime.evaluate failed: {evaluated["exceptionDetails"]}')
    value = evaluated.get('result', {}).get('value')
    if value is None:
        raise RuntimeError(f'Runtime.evaluate returned no value: {evaluated}')
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
        elif method in ('Runtime.consoleAPICalled', 'Log.entryAdded'):
            console_events.append({'method': method, 'text': str(params)[:500]})
        elif method == 'Runtime.exceptionThrown':
            exceptions.append(str(params)[:1000])
        elif method == 'Network.loadingFailed':
            loading_failures.append({
                'requestId': params.get('requestId'),
                'errorText': params.get('errorText'),
                'blockedReason': params.get('blockedReason'),
                'canceled': params.get('canceled', False),
            })
    return bad_responses, console_events, exceptions, loading_failures


def is_finite_number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except (TypeError, OverflowError):
        return False


def is_finite_integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and is_finite_number(value)


def final_url_matches(final_url, target_url):
    if not isinstance(final_url, str) or not isinstance(target_url, str):
        return False
    try:
        actual = urlsplit(final_url)
        target = urlsplit(target_url)
    except ValueError:
        return False
    if not target.scheme or not target.netloc:
        return False

    explicit_path = target.path
    index_suffix = '/index.html'
    if not explicit_path.endswith(index_suffix):
        return False
    canonical_directory = explicit_path[:-len(index_suffix)].rstrip('/') or '/'
    allowed_paths = {explicit_path, canonical_directory}
    if canonical_directory != '/':
        allowed_paths.add(f'{canonical_directory}/')

    return (
        actual.scheme == target.scheme and
        actual.netloc == target.netloc and
        actual.path in allowed_paths and
        actual.query in ('', target.query) and
        not actual.fragment
    )


def validate_state(state, width, height, target_url, bad_responses, console_events, exceptions, loading_failures):
    if not isinstance(state, dict):
        raise RuntimeError(f'Missing Runtime.evaluate state at {width}x{height}: {state!r}')

    final_url = state.get('url')
    if not final_url_matches(final_url, target_url):
        raise RuntimeError(f'Final location.href is missing or outside the harness route at {width}x{height}: {final_url!r}')
    if state.get('readyState') != 'complete':
        raise RuntimeError(f'Page did not settle at {width}x{height}: {state.get("readyState")!r}')

    comparison = state.get('state')
    if (
        not isinstance(comparison, dict) or
        any(
            not is_finite_integer(comparison.get(key)) or comparison[key] != expected
            for key, expected in {
                'stage': 3,
                'intactMemoryCount': 9,
                'deletedMemoryCount': 8,
                'changedPointCount': 5,
                'panelCount': 2,
            }.items()
        ) or
        not is_finite_number(comparison.get('maxDisplacement')) or
        comparison['maxDisplacement'] <= 0.01
    ):
        raise RuntimeError(f'Invalid deterministic comparison state at {width}x{height}: {comparison!r}')

    viewport = state.get('viewport')
    if (
        not isinstance(viewport, dict) or
        any(
            not is_finite_integer(viewport.get(key)) or viewport[key] != expected
            for key, expected in {
                'innerWidth': width,
                'innerHeight': height,
                'clientWidth': width,
                'clientHeight': height,
                'scrollWidth': width,
                'scrollHeight': height,
            }.items()
        )
    ):
        raise RuntimeError(f'Invalid viewport/client/scroll dimensions at {width}x{height}: {viewport!r}')

    canvas = state.get('canvas')
    if not isinstance(canvas, dict) or any(not is_finite_number(canvas.get(key)) for key in (
        'left', 'top', 'right', 'bottom', 'width', 'height', 'backingWidth', 'backingHeight'
    )):
        raise RuntimeError(f'Missing canvas bounds/backing size at {width}x{height}: {canvas!r}')
    if (
        canvas['left'] != 0 or canvas['top'] != 0 or
        canvas['right'] != width or canvas['bottom'] != height or
        canvas['width'] != width or canvas['height'] != height or
        canvas['backingWidth'] != width or canvas['backingHeight'] != height
    ):
        raise RuntimeError(f'Invalid canvas bounds/backing size at {width}x{height}: {canvas!r}')

    if not is_finite_integer(state.get('nonPaperSamples')) or state['nonPaperSamples'] <= 0:
        raise RuntimeError(f'Canvas contains no non-paper pixels at {width}x{height}: {state.get("nonPaperSamples")!r}')
    if not is_finite_integer(state.get('comparedSampleCount')) or state['comparedSampleCount'] <= 0:
        raise RuntimeError(f'No rendered panel samples compared at {width}x{height}: {state.get("comparedSampleCount")!r}')
    if not is_finite_number(state.get('renderedPanelDifference')) or state['renderedPanelDifference'] <= 0:
        raise RuntimeError(f'Rendered panel difference is not positive at {width}x{height}: {state.get("renderedPanelDifference")!r}')
    if state.get('bodyText') != '':
        raise RuntimeError(f'Body text is not empty at {width}x{height}: {state.get("bodyText")!r}')
    if (
        not is_finite_integer(state.get('controls')) or
        not is_finite_integer(state.get('links')) or
        state['controls'] != 0 or
        state['links'] != 0
    ):
        raise RuntimeError(f'Controls or links found at {width}x{height}: controls={state.get("controls")!r}, links={state.get("links")!r}')
    if bad_responses or console_events or exceptions or loading_failures:
        raise RuntimeError(
            f'Browser failures at {width}x{height}: '
            f'console={console_events!r}, exceptions={exceptions!r}, '
            f'badResponses={bad_responses!r}, loadingFailures={loading_failures!r}'
        )


async def main():
    with urllib.request.urlopen('http://127.0.0.1:9229/json/version') as response:
        version = json.load(response)
    browser = version.get('Browser')
    if not isinstance(browser, str) or not browser.startswith('Chrome/151.'):
        raise RuntimeError(f'Expected /json/version Browser starting with Chrome/151., received {browser!r}')
    websocket_url = version.get('webSocketDebuggerUrl')
    if not isinstance(websocket_url, str) or not websocket_url:
        raise RuntimeError(f'/json/version did not provide webSocketDebuggerUrl: {version!r}')

    async with websockets.connect(websocket_url, max_size=50_000_000) as ws:
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
                cdp.events.clear()
                await cdp.call('Emulation.setDeviceMetricsOverride', {
                    'width': width,
                    'height': height,
                    'deviceScaleFactor': 1,
                    'mobile': False,
                    'screenWidth': width,
                    'screenHeight': height,
                }, session)
                target_url = BASE + f'?pulse={width}x{height}'
                navigation = await cdp.call('Page.navigate', {'url': target_url}, session)
                if navigation.get('errorText'):
                    raise RuntimeError(f'Navigation failed at {width}x{height}: {navigation["errorText"]}')
                await asyncio.sleep(0.8)

                expression = '''(() => {
                  const canvas = document.querySelector('#comparison');
                  const comparisonState = window.__typographyComparison;
                  const root = document.documentElement;
                  const rect = canvas?.getBoundingClientRect();
                  let nonPaperSamples = 0;
                  let comparedSampleCount = 0;
                  let renderedPanelDifference = 0;
                  if (canvas?.width && canvas?.height && rect?.width > 0 && rect?.height > 0) {
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('comparison canvas 2D context missing');
                    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
                    for (let index = 0; index < pixels.length; index += 32) {
                      if (pixels[index] < 215 || pixels[index + 1] < 210 || pixels[index + 2] < 195) nonPaperSamples += 1;
                    }

                    const stacked = rect.width < 720;
                    const gap = Math.max(1, Math.round(Math.min(rect.width, rect.height) * 0.012));
                    const panelWidth = stacked ? rect.width : (rect.width - gap) / 2;
                    const panelHeight = stacked ? (rect.height - gap) / 2 : rect.height;
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const clampPixel = (value, maximum) => Math.max(0, Math.min(maximum, value));
                    const toPixels = (x, y, width, height) => ({
                      left: clampPixel(Math.round(x * scaleX), canvas.width),
                      top: clampPixel(Math.round(y * scaleY), canvas.height),
                      right: clampPixel(Math.round((x + width) * scaleX), canvas.width),
                      bottom: clampPixel(Math.round((y + height) * scaleY), canvas.height),
                    });
                    const firstPanel = toPixels(0, 0, panelWidth, panelHeight);
                    const secondPanel = toPixels(
                      stacked ? 0 : panelWidth + gap,
                      stacked ? panelHeight + gap : 0,
                      panelWidth,
                      panelHeight,
                    );
                    const sampleWidth = Math.max(0, Math.min(
                      firstPanel.right - firstPanel.left,
                      secondPanel.right - secondPanel.left,
                    ));
                    const sampleHeight = Math.max(0, Math.min(
                      firstPanel.bottom - firstPanel.top,
                      secondPanel.bottom - secondPanel.top,
                    ));
                    for (let y = 0; y < sampleHeight; y += 1) {
                      for (let x = 0; x < sampleWidth; x += 1) {
                        const firstIndex = ((firstPanel.top + y) * canvas.width + firstPanel.left + x) * 4;
                        const secondIndex = ((secondPanel.top + y) * canvas.width + secondPanel.left + x) * 4;
                        renderedPanelDifference += Math.abs(pixels[firstIndex] - pixels[secondIndex]);
                        renderedPanelDifference += Math.abs(pixels[firstIndex + 1] - pixels[secondIndex + 1]);
                        renderedPanelDifference += Math.abs(pixels[firstIndex + 2] - pixels[secondIndex + 2]);
                        comparedSampleCount += 1;
                      }
                    }
                  }
                  return {
                    url: location.href,
                    readyState: document.readyState,
                    viewport: {innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth, clientHeight: root.clientHeight, scrollHeight: root.scrollHeight},
                    canvas: rect && {left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, backingWidth: canvas.width, backingHeight: canvas.height},
                    state: comparisonState,
                    nonPaperSamples,
                    comparedSampleCount,
                    renderedPanelDifference,
                    bodyText: document.body?.innerText.trim(),
                    controls: document.querySelectorAll('button,input,select,textarea').length,
                    links: document.querySelectorAll('a').length,
                    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
                    title: document.title
                  };
                })()'''
                state = await evaluate(cdp, expression, session)
                bad_responses, console_events, exceptions, loading_failures = event_failures(cdp)
                validate_state(state, width, height, target_url, bad_responses, console_events, exceptions, loading_failures)

                shot = await cdp.call('Page.captureScreenshot', {
                    'format': 'png',
                    'captureBeyondViewport': False,
                }, session)
                image_path = OUT / f'typography-caption-free-{width}x{height}.png'
                image_path.write_bytes(base64.b64decode(shot['data']))
                results.append({
                    'requested': [width, height],
                    'url': state['url'],
                    'state': state,
                    'consoleEvents': len(console_events),
                    'exceptions': len(exceptions),
                    'badFirstPartyResponses': bad_responses,
                    'loadingFailures': loading_failures,
                    'capture': str(image_path.resolve()),
                    'bytes': image_path.stat().st_size,
                })

            output = {
                'route': BASE,
                'browser': browser,
                'probe': f'cache-isolated {browser} CDP; real device metrics',
                'matrix': results,
            }
            (OUT / 'results.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
            print(json.dumps(output, indent=2))
        finally:
            if target_id:
                try:
                    await cdp.call('Target.closeTarget', {'targetId': target_id})
                except Exception:
                    pass
            await cdp.close()


asyncio.run(main())
