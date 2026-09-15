from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = 'https://autopoiesis-nine.vercel.app'
PROOF = Path('research/qa/proofs/naive-art-v011-2026-09-15/production')
PROOF.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [(320, 568), (390, 844), (768, 1024), (1280, 800), (1920, 1080)]


def observe(page):
    events = {'console': [], 'pageErrors': [], 'failedRequests': [], 'badResponses': []}
    page.on('console', lambda message: events['console'].append({'type': message.type, 'text': message.text}))
    page.on('pageerror', lambda error: events['pageErrors'].append(str(error)))
    page.on('requestfailed', lambda request: events['failedRequests'].append({'url': request.url, 'failure': request.failure or 'unknown'}))
    page.on('response', lambda response: events['badResponses'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
    return events


def read_outer(page):
    return page.evaluate("""() => {
      const overflow = [...document.querySelectorAll('*')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, name: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''), left: rect.left, right: rect.right };
      }).filter((item) => (item.left < -1 || item.right > innerWidth + 1) && !item.element.closest('.work-timeline-bar')).map(({ name, left, right }) => ({ name, left, right }));
      const stage = document.querySelector('.work-inspect__stage');
      const heading = document.querySelector('.work-inspect__heading');
      const mount = document.querySelector('[data-catalog-work-detail]');
      return {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflow: overflow.slice(0, 12),
        ready: mount?.dataset.ready === 'true',
        iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
        tableauBeforeHeading: Boolean(stage && heading && (stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
        title: document.querySelector('.work-inspect__heading h1')?.textContent ?? null,
        journalAnchor: document.querySelector('[data-work-region="journal"]')?.id ?? null
      };
    }""")


def study_frame(page):
    page.wait_for_function("""() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.src.includes('/studies/naive-art/v011/'))""")
    page.wait_for_timeout(100)
    frame = next((candidate for candidate in page.frames if '/studies/naive-art/v011/' in candidate.url), None)
    if frame is None:
        raise RuntimeError('study iframe did not attach')
    frame.wait_for_selector('#field')
    return frame


def read_study(frame):
    return frame.evaluate("""() => {
      const canvas = document.querySelector('#field');
      const wrap = document.querySelector('.field-wrap');
      const controls = [...document.querySelectorAll('.field-controls button')];
      const state = window.__mutineNaiveV011?.getState?.();
      const canvasRect = canvas.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonTransparent = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 8) { nonTransparent += 1; if (nonTransparent > 120) break; }
      return {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasVisible: getComputedStyle(canvas).display !== 'none' && canvasRect.width > 0 && canvasRect.height > 0,
        canvasRect: { width: canvasRect.width, height: canvasRect.height },
        wrapRect: { width: wrapRect.width, height: wrapRect.height },
        nonTransparentPixels: nonTransparent,
        memory: document.querySelector('[data-memory]')?.textContent ?? null,
        stage: document.querySelector('[data-stage]')?.textContent ?? null,
        controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
        readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
        buttonHeights: controls.map((button) => Math.round(button.getBoundingClientRect().height)),
        buttonLabels: controls.map((button) => button.textContent.trim()),
        state
      };
    }""")


def assert_no_issues(events, label):
    if any(events.values()):
        raise AssertionError(f'{label} browser issues: {events}')


results = {'local': {'canonical': [], 'raw': None, 'blind': None}}
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for reduced in (False, True):
        context = browser.new_context(reduced_motion='reduce' if reduced else 'no-preference')
        for width, height in VIEWPORTS:
            page = context.new_page()
            events = observe(page)
            page.set_viewport_size({'width': width, 'height': height})
            page.goto(f'{ROOT}/works/naive-2026-09-15/', wait_until='networkidle')
            outer = read_outer(page)
            frame = study_frame(page)
            study = read_study(frame)
            path = PROOF / f'canonical-{"reduced" if reduced else "normal"}-{width}x{height}.png'
            page.screenshot(path=str(path), full_page=True)
            assert outer['innerWidth'] == width and outer['clientWidth'] == width and outer['scrollWidth'] == width, outer
            assert outer['ready'] and outer['iframeCount'] == 1 and outer['tableauBeforeHeading'], outer
            assert study['canvasVisible'] and study['nonTransparentPixels'] > 120, study
            assert_no_issues(events, f'canonical {width}x{height} reduced={reduced}')
            results['local']['canonical'].append({'reduced': reduced, 'width': width, 'height': height, 'outer': outer, 'study': study, 'issues': events})
            page.close()
        context.close()

    context = browser.new_context(reduced_motion='no-preference')
    page = context.new_page()
    events = observe(page)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{ROOT}/studies/naive-art/v011/?preview=1&interaction=1', wait_until='networkidle')
    frame = page.main_frame
    frame.wait_for_selector('#field')
    initial_outer = page.evaluate('() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })')
    initial = read_study(frame)
    initial_image = frame.locator('#field').evaluate('(canvas) => canvas.toDataURL()')
    rect = frame.locator('#field').bounding_box()
    assert rect is not None
    page.mouse.click(rect['x'] + rect['width'] * 0.64, rect['y'] + rect['height'] * 0.51)
    after_pointer = read_study(frame)
    pointer_image = frame.locator('#field').evaluate('(canvas) => canvas.toDataURL()')
    frame.locator('#field').press('Enter')
    after_keyboard = read_study(frame)
    keyboard_image = frame.locator('#field').evaluate('(canvas) => canvas.toDataURL()')
    frame.locator('#undo-control').click()
    after_lift = read_study(frame)
    lift_image = frame.locator('#field').evaluate('(canvas) => canvas.toDataURL()')
    frame.locator('#undo-control').click()
    after_second_lift = read_study(frame)
    frame.locator('#release-control').click()
    after_release = read_study(frame)
    page.screenshot(path=str(PROOF / 'raw-interaction-390x844.png'), full_page=False)
    assert initial_outer == {'innerWidth': 390, 'clientWidth': 390, 'scrollWidth': 390}, initial_outer
    assert initial['controlsDisplay'] == 'flex' and all(height >= 44 for height in initial['buttonHeights']), initial
    assert after_pointer['memory'] == '1 bump retained' and after_pointer['state']['interaction'] == 'visitor-bump', after_pointer
    assert after_keyboard['memory'] == '2 bumps retained' and keyboard_image != pointer_image, after_keyboard
    assert after_lift['memory'] == '1 bump retained' and lift_image == pointer_image, after_lift
    assert after_second_lift['memory'] == '0 bumps retained', after_second_lift
    assert after_release['memory'] == '0 bumps retained' and after_release['stage'] == 'stage 01 / 16', after_release
    assert pointer_image != initial_image, 'pointer must change the canvas'
    assert_no_issues(events, 'raw interaction')
    results['local']['raw'] = {
        'initialOuter': initial_outer,
        'initial': initial,
        'afterPointer': after_pointer,
        'afterKeyboard': after_keyboard,
        'afterLift': after_lift,
        'afterSecondLift': after_second_lift,
        'afterRelease': after_release,
        'canvasChangedOnPointer': pointer_image != initial_image,
        'canvasChangedOnKeyboard': keyboard_image != pointer_image,
        'liftRestoredPointerState': lift_image == pointer_image,
        'secondLiftReturnedToZero': after_second_lift['memory'] == '0 bumps retained',
        'releaseReturnedToZero': after_release['memory'] == '0 bumps retained',
        'issues': events
    }
    page.close()
    context.close()

    context = browser.new_context(reduced_motion='reduce')
    page = context.new_page()
    events = observe(page)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.goto(f'{ROOT}/studies/naive-art/v011/?preview=1&static=1&blind=1', wait_until='networkidle')
    page.wait_for_selector('#field')
    study = read_study(page.main_frame)
    page.screenshot(path=str(PROOF / 'static-blind-390x844.png'), full_page=False)
    assert study['canvasVisible'] and study['nonTransparentPixels'] > 120, study
    assert study['controlsDisplay'] == 'none' and study['readoutDisplay'] == 'none', study
    assert study['scrollWidth'] == 390, study
    assert_no_issues(events, 'static blind')
    results['local']['blind'] = {'study': study, 'issues': events}
    page.close()
    context.close()
    browser.close()

(PROOF / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
