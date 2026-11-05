import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const base = 'http://127.0.0.1:59048';
const proofDir = new URL('../research/qa/proofs/brush-v048-2026-11-05-local/', import.meta.url);
const proofDirPath = fileURLToPath(proofDir);
await mkdir(proofDir, { recursive: true });
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
const modes = ['normal', 'reduced-motion'];
const results = [];
let diagnostics = [];

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  for (const mode of modes) {
    for (const [width, height] of viewports) {
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference',
        deviceScaleFactor: 1,
        serviceWorkers: 'block'
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const requestFailures = [];
      page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('requestfailed', (request) => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));

      const rawPath = `/studies/p5-brush/v048/?preview=1&${mode === 'reduced-motion' ? 'static=1&blind=1' : 'interaction=1'}`;
      const rawResponse = await page.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 30000 });
      const raw = await page.evaluate(() => {
        const root = document.documentElement;
        const canvas = document.querySelector('canvas');
        const field = document.querySelector('#wash-field');
        const buttons = [...document.querySelectorAll('button')];
        return {
          innerWidth: window.innerWidth,
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          canvas: Boolean(canvas),
          canvasRect: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height } : null,
          fieldRect: field ? { width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height } : null,
          controlsVisible: buttons.some((button) => getComputedStyle(button).display !== 'none'),
          minTouchTarget: buttons.length ? Math.min(...buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))) : null,
          state: window.__mutineBrushV048?.getState?.() ?? null
        };
      });
      const canonicalPath = '/works/brush-2026-11-05/';
      const canonicalResponse = await page.goto(`${base}${canonicalPath}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 30000 });
      await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#wash-field'), null, { timeout: 30000 });
      const canonical = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? null,
        iframe: Boolean(document.querySelector('iframe[title*="full artwork"]')),
        tableau: Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('#wash-field'))
      }));
      const row = { mode, viewport: `${width}x${height}`, rawStatus: rawResponse?.status(), canonicalStatus: canonicalResponse?.status(), raw, canonical, diagnostics: { consoleErrors, requestFailures } };
      results.push(row);
      diagnostics.push(...consoleErrors, ...requestFailures);
      if (mode === 'reduced-motion' && width === 390) await page.screenshot({ path: join(proofDirPath, 'blind-390x844.png'), fullPage: true });
      await context.close();
    }
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  await page.goto(`${base}/studies/p5-brush/v048/?preview=1&interaction=1`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 30000 });
  const before = await page.evaluate(() => ({ signature: window.__mutineBrushV048.geometrySignature(), state: window.__mutineBrushV048.getState(), gates: [0, 1, 2].map((index) => window.__mutineBrushV048.gatePoint(index)) }));
  const canvas = page.locator('canvas');
  const rect = await canvas.boundingBox();
  const points = before.gates.map((point) => ({ x: rect.x + point.x * rect.width, y: rect.y + point.y * rect.height }));
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 8 });
  await page.mouse.move(points[2].x, points[2].y, { steps: 8 });
  await page.mouse.move(rect.x + rect.width * 0.94, rect.y + rect.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const pointer = await page.evaluate(() => ({ signature: window.__mutineBrushV048.geometrySignature(), state: window.__mutineBrushV048.getState() }));
  await page.evaluate(() => window.__mutineBrushV048.release());
  await page.locator('#wash-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineBrushV048.getState());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineBrushV048.getState());
  await page.evaluate(() => window.__mutineBrushV048.release());
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[2].x, points[2].y, { steps: 8 });
  await page.mouse.move(rect.x + rect.width * 0.94, rect.y + rect.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const wrongOrder = await page.evaluate(() => window.__mutineBrushV048.getState());
  await page.evaluate(() => window.__mutineBrushV048.release());
  const touchPoints = points.concat({ x: rect.x + rect.width * 0.94, y: rect.y + rect.height * 0.5 });
  await page.evaluate((coords) => {
    const target = document.querySelector('canvas');
    const emit = (type, point, buttons) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, pointerId: 77, pointerType: 'touch', isPrimary: true, buttons }));
    emit('pointerdown', coords[0], 1);
    emit('pointermove', coords[1], 1);
    emit('pointermove', coords[2], 1);
    emit('pointermove', coords[3], 0);
    emit('pointerup', coords[3], 0);
  }, touchPoints);
  const touch = await page.evaluate(() => window.__mutineBrushV048.getState());
  await page.screenshot({ path: join(proofDirPath, 'interaction-390x844.png'), fullPage: true });
  diagnostics.push(...consoleErrors, ...requestFailures);
  await context.close();

  const summary = {
    rawViewportRuns: results.length,
    canonicalViewportRuns: results.length,
    passedRawViewportRuns: results.filter((row) => row.rawStatus === 200 && row.raw.innerWidth === Number(row.viewport.split('x')[0]) && row.raw.clientWidth === Number(row.viewport.split('x')[0]) && row.raw.scrollWidth <= Number(row.viewport.split('x')[0]) && row.raw.canvas).length,
    passedCanonicalViewportRuns: results.filter((row) => row.canonicalStatus === 200 && row.canonical.scrollWidth <= Number(row.viewport.split('x')[0]) && row.canonical.tableau).length,
    passedViewportRuns: results.filter((row) => row.rawStatus === 200 && row.canonicalStatus === 200 && row.raw.innerWidth === Number(row.viewport.split('x')[0]) && row.raw.clientWidth === Number(row.viewport.split('x')[0]) && row.raw.scrollWidth <= Number(row.viewport.split('x')[0]) && row.raw.canvas && row.canonical.scrollWidth <= Number(row.viewport.split('x')[0]) && row.canonical.tableau).length * 2,
    diagnostics: diagnostics.length,
    minTouchTarget: Math.min(...results.filter((row) => row.raw.minTouchTarget).map((row) => row.raw.minTouchTarget)),
    pointerCommit: pointer.state.memory === 1 && pointer.state.interaction === 'stroke-committed' && before.signature !== pointer.signature,
    keyboardCommit: keyboard.memory === 1 && keyboard.interaction === 'stroke-committed',
    liftExact: lifted.memory === 0,
    wrongOrderRefused: wrongOrder.memory === 0 && wrongOrder.interaction === 'stroke-refused-order',
    touchCommit: touch.memory === 1 && touch.interaction === 'stroke-committed'
  };
  const evidence = { summary, before, pointer, keyboard, lifted, wrongOrder, touch, results };
  await writeFile(new URL('evidence.json', proofDir), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.passedViewportRuns !== 20 || summary.diagnostics !== 0 || summary.minTouchTarget < 44 || !summary.pointerCommit || !summary.keyboardCommit || !summary.liftExact || !summary.wrongOrderRefused || !summary.touchCommit) process.exitCode = 1;
} finally {
  await browser.close();
}
