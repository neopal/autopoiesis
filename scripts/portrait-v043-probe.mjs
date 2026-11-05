import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PORTRAIT_V043_BASE_URL ?? 'http://127.0.0.1:4177';
const proofDir = path.resolve('research/qa/proofs/portrait-v043-2026-11-05-local');
const viewports = [
  { width: 320, height: 568, label: '320x568' },
  { width: 390, height: 844, label: '390x844' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1280, height: 800, label: '1280x800' },
  { width: 1920, height: 1080, label: '1920x1080' }
];
const routes = {
  raw: '/studies/self-portrait/v043/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-11-05/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PORTRAIT_V043_CHROME ? { executablePath: process.env.PORTRAIT_V043_CHROME } : {})
});
const runs = [];
const diagnostics = [];

async function waitForRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV043));
  await page.locator('[data-pressure-stage]').waitFor({ state: 'visible' });
}

async function waitForCanonical(page) {
  await page.locator('[data-catalog-work-detail="portrait-2026-11-05"] iframe').waitFor({ state: 'visible' });
  const frame = page.frames().find((entry) => entry.url().includes('/studies/self-portrait/v043/'));
  if (!frame) throw new Error('canonical tableau iframe did not load v043');
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV043));
  return frame;
}

function attachDiagnostics(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`${label}:console:${message.text()}`);
  });
  page.on('pageerror', (error) => diagnostics.push(`${label}:pageerror:${error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`${label}:request:${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
}

async function measure(page, label, frame = page) {
  return page.evaluate(({ label: name }) => {
    const stage = document.querySelector('[data-pressure-stage]');
    const canvas = document.querySelector('[data-pressure-canvas] canvas');
    const hidden = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return true;
      const style = getComputedStyle(node);
      return style.display === 'none' || style.visibility === 'hidden' || node.getBoundingClientRect().width === 0;
    };
    return {
      label: name,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stageVisible: Boolean(stage && stage.getBoundingClientRect().width > 0 && stage.getBoundingClientRect().height > 0),
      canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
      controls: hidden('.pressure-controls') ? 'none' : 'visible',
      readout: hidden('.pressure-readout') ? 'none' : 'visible',
      hint: hidden('.pressure-hint') ? 'none' : 'visible',
      minTouchTarget: Math.min(...[...document.querySelectorAll('.pressure-controls button')].map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height)), 999),
      state: window.__mutinePortraitV043?.getState?.() ?? null
    };
  }, { label });
}

async function rawRun(viewport, reduced) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage();
  const label = `raw-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}`;
  attachDiagnostics(page, label);
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForRaw(page);
  const measurement = await measure(page, label);
  measurement.viewportTarget = viewport.width;
  if (viewport.width === 390 && !reduced) {
    await page.screenshot({ path: path.join(proofDir, 'raw-390-normal.png'), fullPage: false });
  }
  await context.close();
  return measurement;
}

async function canonicalRun(viewport, reduced) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage();
  const label = `canonical-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}`;
  attachDiagnostics(page, label);
  await page.goto(`${baseUrl}${routes.canonical}`, { waitUntil: 'networkidle' });
  const frame = await waitForCanonical(page);
  const measurement = await measure(frame, label, frame);
  const outerViewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  measurement.frameInnerWidth = measurement.innerWidth;
  measurement.frameClientWidth = measurement.clientWidth;
  measurement.frameScrollWidth = measurement.scrollWidth;
  Object.assign(measurement, outerViewport, { viewportTarget: viewport.width });
  measurement.tableauFirst = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return Boolean(iframe && heading && iframe.getBoundingClientRect().top <= heading.getBoundingClientRect().top);
  });
  if (viewport.width === 390 && !reduced) await page.screenshot({ path: path.join(proofDir, 'canonical-390-normal.png'), fullPage: false });
  await context.close();
  return measurement;
}

for (const viewport of viewports) {
  runs.push(await rawRun(viewport, false));
  runs.push(await rawRun(viewport, true));
  runs.push(await canonicalRun(viewport, false));
  runs.push(await canonicalRun(viewport, true));
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
const interactionPage = await interactionContext.newPage();
attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
await waitForRaw(interactionPage);
const stage = interactionPage.locator('[data-pressure-stage]');
const rect = await stage.boundingBox();
const baseline = await interactionPage.evaluate(() => ({ state: window.__mutinePortraitV043.getState(), signature: window.__mutinePortraitV043.geometrySignature() }));
const start = { x: rect.x + 26, y: rect.y + rect.height * .46 };
const end = { x: rect.x + rect.width - 26, y: rect.y + rect.height * .46 };
await interactionPage.mouse.move(start.x, start.y);
await interactionPage.mouse.down();
for (let i = 1; i <= 8; i += 1) await interactionPage.mouse.move(start.x + (end.x - start.x) * i / 8, start.y + Math.sin(i) * 3);
await interactionPage.mouse.up();
const afterPointer = await interactionPage.evaluate(() => window.__mutinePortraitV043.getState());
const pointerEvent = afterPointer.memory.at(-1);
const sourceBefore = baseline.state.channels[pointerEvent.source];
const sourceAfter = afterPointer.channels[pointerEvent.source];
const remoteBefore = baseline.state.channels[pointerEvent.receiver];
const remoteAfter = afterPointer.channels[pointerEvent.receiver];
const pointerInteraction = {
  committed: afterPointer.memory.length === 1,
  sourceQuiet: sourceAfter.state === 'quiet',
  sourceGeometryExact: ['x', 'y', 'width', 'height', 'angle', 'contours', 'density', 'grain', 'phase'].every((key) => sourceBefore[key] === sourceAfter[key]),
  remoteChanged: remoteAfter.state === 'recast' && (remoteAfter.contours !== remoteBefore.contours || remoteAfter.density !== remoteBefore.density || remoteAfter.angle !== remoteBefore.angle),
  revision: afterPointer.revision
};
await stage.focus();
await interactionPage.keyboard.press('Delete');
const lifted = await interactionPage.evaluate(() => ({ state: window.__mutinePortraitV043.getState(), signature: window.__mutinePortraitV043.geometrySignature() }));
pointerInteraction.liftRestored = lifted.signature === baseline.signature;
await interactionPage.getByRole('button', { name: 'press the grain' }).click();
const buttonState = await interactionPage.evaluate(() => window.__mutinePortraitV043.getState());
pointerInteraction.buttonCommitted = buttonState.memory.length === 1;
await stage.focus();
await interactionPage.keyboard.press('Escape');
await stage.focus();
await interactionPage.keyboard.press('ArrowRight');
await interactionPage.keyboard.press('Enter');
const keyboardState = await interactionPage.evaluate(() => window.__mutinePortraitV043.getState());
pointerInteraction.keyboardCommitted = keyboardState.memory.length === 1;

const touchBaseline = await interactionPage.evaluate(() => { window.__mutinePortraitV043.release(); return window.__mutinePortraitV043.geometrySignature(); });
await interactionPage.evaluate(() => {
  const stageNode = document.querySelector('[data-pressure-stage]');
  const rect = stageNode.getBoundingClientRect();
  const events = [
    ['pointerdown', rect.left + 24, rect.top + rect.height * .48],
    ['pointermove', rect.left + rect.width * .48, rect.top + rect.height * .48],
    ['pointermove', rect.left + rect.width - 24, rect.top + rect.height * .48],
    ['pointerup', rect.left + rect.width - 24, rect.top + rect.height * .48]
  ];
  for (const [type, clientX, clientY] of events) stageNode.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 73, pointerType: 'touch', clientX, clientY }));
});
const touchState = await interactionPage.evaluate(() => window.__mutinePortraitV043.getState());
pointerInteraction.touchCommitted = touchState.memory.length === 1;
await interactionPage.screenshot({ path: path.join(proofDir, 'interaction-390-reduced.png'), fullPage: false });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
attachDiagnostics(blindPage, 'blind');
await blindPage.goto(`${baseUrl}/studies/self-portrait/v043/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitForRaw(blindPage);
const blind = await measure(blindPage, 'blind-390-reduced');
await blindPage.screenshot({ path: path.join(proofDir, 'blind-390-reduced.png'), fullPage: false });
await blindContext.close();

const readbacks = {};
for (const [key, route] of Object.entries({
  works: '/studio/data/works.json',
  publicCatalog: '/studio/data/catalog-public.json',
  journal: '/journal/',
  canonical: routes.canonical,
  raw: routes.raw,
  favicon: '/studio/favicon.svg'
})) {
  const response = await fetch(`${baseUrl}${route}`);
  const text = await response.text();
  readbacks[key] = { status: response.status, hasWork: text.includes('portrait-2026-11-05'), hasJournal: text.includes('journal-portrait-2026-11-05'), hasTitle: text.includes('The portrait is made by resistance.') };
}

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const journalPage = await journalContext.newPage();
attachDiagnostics(journalPage, 'journal-readback');
await journalPage.goto(`${baseUrl}/journal/`, { waitUntil: 'networkidle' });
const journalEntry = journalPage.locator('#journal-portrait-2026-11-05');
await journalEntry.waitFor({ state: 'visible' });
readbacks.journal.rendered = true;
readbacks.journal.hasJournal = await journalEntry.count() === 1;
readbacks.journal.hasTitle = (await journalEntry.innerText()).includes('The portrait is made by resistance.');
await journalContext.close();

const output = {
  label: 'portrait-v043-local',
  baseUrl,
  viewports: viewports.map(({ label }) => label),
  modes: ['normal', 'reduced-motion'],
  runs,
  interaction: pointerInteraction,
  blind,
  diagnostics,
  readbacks
};
await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ runs: runs.length, diagnostics: diagnostics.length, interaction: pointerInteraction, blind: { canvasVisible: blind.canvasVisible, memory: blind.state?.memory?.length, scrollWidth: blind.scrollWidth }, readbacks }));
if (runs.length !== 20) process.exitCode = 1;
if (diagnostics.length) process.exitCode = 1;
if (runs.some((run) => run.innerWidth !== run.viewportTarget || run.clientWidth !== run.viewportTarget || run.scrollWidth > run.viewportTarget || !run.canvasVisible || !run.stageVisible || run.minTouchTarget < 44)) process.exitCode = 1;
if (!pointerInteraction.committed || !pointerInteraction.sourceQuiet || !pointerInteraction.sourceGeometryExact || !pointerInteraction.remoteChanged || !pointerInteraction.liftRestored || !pointerInteraction.buttonCommitted || !pointerInteraction.keyboardCommitted || !pointerInteraction.touchCommitted) process.exitCode = 1;
if (!blind.canvasVisible || blind.state?.memory?.length !== 4 || blind.controls !== 'none' || blind.readout !== 'none' || blind.hint !== 'none' || blind.scrollWidth > blind.innerWidth) process.exitCode = 1;
if (Object.values(readbacks).some((entry) => entry.status !== 200)) process.exitCode = 1;
if (!readbacks.works.hasWork || !readbacks.publicCatalog.hasWork || !readbacks.journal.hasJournal || !readbacks.canonical.hasTitle || !readbacks.raw.hasTitle || readbacks.favicon.status !== 200) process.exitCode = 1;
await browser.close();
