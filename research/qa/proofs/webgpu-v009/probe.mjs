import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/webgpu-2026-09-13/`;
const raw = `${base}/studies/webgpu/v009/?preview=1&interaction=1&blind=1`;
const outputDir = fileURLToPath(new URL('./', import.meta.url));
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const targets = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const matrix = [];
const failures = [];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

for (const reduced of [false, true]) {
  for (const [width, height] of targets) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const consoleMessages = [];
    const pageErrors = [];
    const networkFailures = [];
    const httpFailures = [];
    page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => networkFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
    page.on('response', (response) => { if (response.status() >= 400) httpFailures.push(`${response.status()} ${response.url()}`); });
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto(canonical, { waitUntil: 'networkidle' });
    const iframe = page.locator('.work-inspect__stage iframe');
    await iframe.waitFor({ state: 'visible' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/webgpu/v009/'));
    if (!frame) throw new Error(`v009 iframe missing at ${width}x${height}`);
    const outer = await page.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      tableauFirst: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top <= document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top,
      workId: document.body.dataset.workId,
      mount: Boolean(document.querySelector('[data-catalog-work-detail="webgpu-2026-09-13"]'))
    }));
    const inner = await frame.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasPixels: document.querySelector('#field')?.width * document.querySelector('#field')?.height,
      canvasCss: [document.querySelector('#field')?.getBoundingClientRect().width, document.querySelector('#field')?.getBoundingClientRect().height],
      preview: document.documentElement.classList.contains('preview-mode'),
      interactivePreview: document.documentElement.classList.contains('interactive-preview'),
      stage: document.querySelector('[data-stage]')?.textContent,
      memory: document.querySelector('[data-memory]')?.textContent
    }));
    const screenshot = `matrix-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`;
    await page.screenshot({ path: join(outputDir, screenshot), fullPage: false });
    const record = { target: `${width}x${height}`, reducedMotion: reduced, outer, inner, screenshot, consoleMessages, pageErrors, networkFailures, httpFailures };
    matrix.push(record);
    if (outer.innerWidth !== width || outer.clientWidth !== width || outer.scrollWidth > width) failures.push(`outer geometry ${width}x${height}`);
    if (!outer.tableauFirst || !outer.mount || outer.workId !== 'webgpu-2026-09-13') failures.push(`canonical shell ${width}x${height}`);
    if (inner.innerWidth !== inner.clientWidth || inner.scrollWidth > inner.innerWidth) failures.push(`inner overflow ${width}x${height}`);
    if (!inner.preview || !inner.canvasPixels || inner.canvasCss.some((value) => !value)) failures.push(`inner tableau ${width}x${height}`);
    if (reduced && (!inner.stage?.includes('17 / 17') || !inner.memory?.includes('6 countercurrents'))) failures.push(`reduced settled state ${width}x${height}`);
    if (!reduced && (!inner.stage?.includes('01 / 17') || !inner.memory?.includes('0 countercurrents'))) failures.push(`normal initial state ${width}x${height}`);
    if (consoleMessages.length || pageErrors.length || networkFailures.length || httpFailures.length) failures.push(`runtime errors ${width}x${height}`);
    await page.close();
  }
}

const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const rawConsole = [];
const rawErrors = [];
const rawNetwork = [];
const rawHttp = [];
rawPage.on('console', (message) => rawConsole.push({ type: message.type(), text: message.text() }));
rawPage.on('pageerror', (error) => rawErrors.push(String(error)));
rawPage.on('requestfailed', (request) => rawNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
rawPage.on('response', (response) => { if (response.status() >= 400) rawHttp.push(`${response.status()} ${response.url()}`); });
await rawPage.emulateMedia({ reducedMotion: 'no-preference' });
await rawPage.goto(raw, { waitUntil: 'networkidle' });
const field = rawPage.locator('#field');
await field.waitFor({ state: 'visible' });
const before = await rawPage.evaluate(() => ({
  stage: document.querySelector('[data-stage]').textContent,
  memory: document.querySelector('[data-memory]').textContent,
  signature: document.querySelector('#field').toDataURL()
}));
const rawGeometry = await rawPage.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  preview: document.documentElement.classList.contains('preview-mode'),
  interactivePreview: document.documentElement.classList.contains('interactive-preview'),
  blind: document.documentElement.classList.contains('blind-mode'),
  buttons: [...document.querySelectorAll('.field-controls button')].map((element) => ({ label: element.textContent.trim(), height: element.getBoundingClientRect().height }))
}));
const bounds = await field.boundingBox();
await field.click({ position: { x: bounds.width * 0.55, y: bounds.height * 0.42 } });
const afterPointerState = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
const afterPointer = { stage: afterPointerState.stage, memory: afterPointerState.memory, signatureChanged: afterPointerState.signature !== before.signature };
await field.press('Delete');
const afterPointerLift = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
await field.press('Enter');
const afterKeyboard = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
await field.press('Delete');
const afterKeyboardLift = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
await rawPage.locator('[data-gesture="release"]').click();
const afterRelease = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
const interactionScreenshot = 'interaction-final-390x844.png';
await rawPage.screenshot({ path: join(outputDir, interactionScreenshot), fullPage: false });
const interaction = { before: { stage: before.stage, memory: before.memory }, afterPointer, afterPointerLift: { stage: afterPointerLift.stage, memory: afterPointerLift.memory, signatureRestored: afterPointerLift.signature === before.signature }, afterKeyboard, afterKeyboardLift, afterRelease, rawGeometry, rawConsole, rawErrors, rawNetwork, rawHttp, interactionScreenshot };
if (rawPage.url() !== raw) failures.push('raw preview route changed');
if (!rawGeometry.preview || !rawGeometry.interactivePreview || !rawGeometry.blind || rawGeometry.scrollWidth > rawGeometry.innerWidth) failures.push('raw preview geometry');
if (rawGeometry.buttons.some((button) => button.height < 44)) failures.push('touch target height');
if (afterPointer.memory !== '1 countercurrent' || afterPointer.stage !== 'visitor current / paused' || !afterPointer.signatureChanged) failures.push('pointer countercurrent');
if (afterPointerLift.memory !== '0 countercurrents' || afterPointerLift.signature !== before.signature) failures.push('pointer lift restoration');
if (afterKeyboard.memory !== '1 countercurrent' || afterKeyboard.stage !== 'visitor current / paused') failures.push('keyboard countercurrent');
if (afterKeyboardLift.memory !== '0 countercurrents') failures.push('keyboard lift');
if (afterRelease.memory !== '0 countercurrents' || !afterRelease.stage?.includes('stage 01 / 17')) failures.push('release current');
if (rawConsole.length || rawErrors.length || rawNetwork.length || rawHttp.length) failures.push('raw runtime errors');
await rawPage.close();

const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const staticConsole = [];
const staticErrors = [];
const staticNetwork = [];
const staticHttp = [];
staticPage.on('console', (message) => staticConsole.push({ type: message.type(), text: message.text() }));
staticPage.on('pageerror', (error) => staticErrors.push(String(error)));
staticPage.on('requestfailed', (request) => staticNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
staticPage.on('response', (response) => { if (response.status() >= 400) staticHttp.push(`${response.status()} ${response.url()}`); });
await staticPage.emulateMedia({ reducedMotion: 'reduce' });
await staticPage.goto(`${base}/studies/webgpu/v009/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
const staticPreview = await staticPage.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  preview: document.documentElement.classList.contains('preview-mode'),
  static: document.documentElement.classList.contains('static-mode'),
  blind: document.documentElement.classList.contains('blind-mode'),
  canvas: Boolean(document.querySelector('#field')?.width),
  controlsVisible: getComputedStyle(document.querySelector('.field-controls')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.field-readout')).display !== 'none'
}));
staticPreview.consoleMessages = staticConsole;
staticPreview.pageErrors = staticErrors;
staticPreview.networkFailures = staticNetwork;
staticPreview.httpFailures = staticHttp;
const staticScreenshot = 'blind-static-390x844.png';
await staticPage.screenshot({ path: join(outputDir, staticScreenshot), fullPage: false });
if (staticPreview.innerWidth !== 390 || staticPreview.clientWidth !== 390 || staticPreview.scrollWidth > 390 || !staticPreview.preview || !staticPreview.static || !staticPreview.blind || !staticPreview.canvas || staticPreview.controlsVisible || staticPreview.readoutVisible) failures.push('static blind preview');
if (staticConsole.length || staticErrors.length || staticNetwork.length || staticHttp.length) failures.push('static runtime errors');
await staticPage.close();

const directRawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await directRawPage.goto(`${base}/studies/webgpu/v009/`, { waitUntil: 'networkidle' });
const directRawRedirect = directRawPage.url();
await directRawPage.close();
if (!directRawRedirect.endsWith('/works/webgpu-2026-09-13/')) failures.push('raw bridge redirect');

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const journalConsole = [];
const journalErrors = [];
const journalNetwork = [];
const journalHttp = [];
journalPage.on('console', (message) => journalConsole.push({ type: message.type(), text: message.text() }));
journalPage.on('pageerror', (error) => journalErrors.push(String(error)));
journalPage.on('requestfailed', (request) => journalNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
journalPage.on('response', (response) => { if (response.status() >= 400) journalHttp.push(`${response.status()} ${response.url()}`); });
await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
const journalReadback = await journalPage.evaluate(() => {
  const entries = [...document.querySelectorAll('#journal-webgpu-2026-09-13')];
  const entry = entries[0];
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    entryCount: entries.length,
    titleCount: [...document.querySelectorAll('.journal-entry h3')].filter((element) => element.textContent.trim() === 'The crowd keeps a countercurrent.').length,
    href: entry?.querySelector('a')?.getAttribute('href') ?? null
  };
});
const journalScreenshot = 'journal-390x844.png';
await journalPage.screenshot({ path: join(outputDir, journalScreenshot), fullPage: false });
if (journalReadback.entryCount !== 1 || journalReadback.titleCount !== 1 || journalReadback.href !== '/works/webgpu-2026-09-13/#journal') failures.push('Journal entry');
if (journalReadback.scrollWidth > journalReadback.innerWidth || journalConsole.length || journalErrors.length || journalNetwork.length || journalHttp.length) failures.push('Journal runtime');
await journalPage.close();

await browser.close();
const result = {
  workId: 'webgpu-2026-09-13',
  study: '/studies/webgpu/v009/',
  canonicalRoute: '/works/webgpu-2026-09-13/',
  status: failures.length ? 'held / failed browser gate' : 'candidate / held for independent perceptual review',
  observedWith: { server: 'python http.server 4173', browser: 'Playwright + Google Chrome headless', executablePath },
  directRawRedirect,
  staticPreview,
  journalReadback,
  viewportMatrix: matrix,
  interaction,
  failures,
  screenshots: matrix.map((entry) => entry.screenshot).concat(interactionScreenshot, staticScreenshot, journalScreenshot)
};
await writeFile(new URL('./results.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, failures, matrixRuns: matrix.length, directRawRedirect, journalReadback, interaction: { before: { stage: before.stage, memory: before.memory }, afterPointer, afterPointerLift: { stage: afterPointerLift.stage, memory: afterPointerLift.memory, signatureRestored: afterPointerLift.signature === before.signature }, afterKeyboard, afterKeyboardLift, afterRelease, buttons: rawGeometry.buttons }, staticPreview }, null, 2));
if (failures.length) process.exitCode = 1;
