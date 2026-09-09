import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/typography-2026-09-10/`;
const raw = `${base}/studies/handwriting/v006/?preview=1&interaction=1`;
const proofDir = 'research/qa/proofs/typography-v006-2026-09-10';
const targets = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const matrix = [];
const failures = [];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe'
});

async function loadPage(context, url) {
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  return { page, response, consoleMessages, pageErrors, failedRequests, badResponses };
}

for (const reduced of [false, true]) {
  for (const [viewportWidth, viewportHeight] of targets) {
    const context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const loaded = await loadPage(context, canonical);
    const { page, response, consoleMessages, pageErrors, failedRequests, badResponses } = loaded;
    const mount = page.locator('[data-catalog-work-detail="typography-2026-09-10"]');
    await mount.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
    const iframe = mount.locator('.work-inspect__stage iframe');
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v006/'));
    if (!frame) throw new Error(`embedded v006 frame missing at ${viewportWidth}x${viewportHeight}`);
    await frame.locator('#piece').waitFor({ state: 'visible' });
    const outer = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tableauFirst: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top < document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top
    }));
    const inner = await frame.evaluate(() => {
      const canvas = document.querySelector('#piece');
      const buttons = [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height, display: getComputedStyle(button).display }));
      const sample = canvas?.getContext('2d')?.getImageData(Math.max(0, Math.floor(canvas.width / 2)), Math.max(0, Math.floor(canvas.height / 2)), 1, 1).data ?? [];
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        preview: document.documentElement.classList.contains('preview-mode'),
        interactivePreview: document.documentElement.classList.contains('interactive-preview'),
        canvasCss: [canvas?.getBoundingClientRect().width, canvas?.getBoundingClientRect().height],
        canvasPixels: [canvas?.width, canvas?.height],
        nonEmptySample: sample.length === 4 && sample.some((channel) => channel !== 0),
        buttons,
        state: window.__mutineHandwritingV006?.getState()
      };
    });
    const screenshot = `canonical-${reduced ? 'reduced' : 'normal'}-${viewportWidth}x${viewportHeight}.png`;
    await page.screenshot({ path: join(proofDir, screenshot), fullPage: false });
    const record = { reducedMotion: reduced, viewport: { width: viewportWidth, height: viewportHeight }, status: response.status(), outer, inner, screenshot, consoleMessages, pageErrors, failedRequests, badResponses };
    matrix.push(record);

    if (response.status() !== 200) failures.push(`canonical HTTP ${viewportWidth}x${viewportHeight}`);
    if (outer.innerWidth !== viewportWidth || outer.clientWidth !== viewportWidth || outer.scrollWidth > viewportWidth || outer.bodyScrollWidth > viewportWidth) failures.push(`outer overflow ${viewportWidth}x${viewportHeight}`);
    if (inner.innerWidth !== inner.clientWidth || inner.scrollWidth > inner.innerWidth || inner.bodyScrollWidth > inner.innerWidth) failures.push(`inner overflow ${viewportWidth}x${viewportHeight}`);
    if (!outer.tableauFirst || !inner.preview || !inner.canvasPixels[0] || !inner.canvasPixels[1] || !inner.nonEmptySample) failures.push(`tableau ${viewportWidth}x${viewportHeight}`);
    if (inner.buttons.some((button) => button.height < 44)) failures.push(`touch target ${viewportWidth}x${viewportHeight}`);
    if (consoleMessages.length || pageErrors.length || failedRequests.length || badResponses.length) failures.push(`runtime issue ${viewportWidth}x${viewportHeight}`);
    await context.close();
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const interactionLoaded = await loadPage(interactionContext, raw);
const interactionPage = interactionLoaded.page;
const rawCanvas = interactionPage.locator('#piece');
await rawCanvas.waitFor({ state: 'visible' });
const before = await interactionPage.evaluate(() => window.__mutineHandwritingV006.getState());
const rawGeometry = await interactionPage.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
  preview: document.documentElement.classList.contains('preview-mode'),
  interactivePreview: document.documentElement.classList.contains('interactive-preview'),
  furnitureHidden: getComputedStyle(document.querySelector('.studio-header')).display === 'none'
}));
const buttons = await interactionPage.locator('button').evaluateAll((elements) => elements.map((button) => ({ id: button.id, height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
await rawCanvas.click({ position: { x: 195, y: 290 } });
const afterPointer = await interactionPage.evaluate(() => window.__mutineHandwritingV006.getState());
await rawCanvas.focus();
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => window.__mutineHandwritingV006.getState());
await interactionPage.locator('#lift-gap').click();
const afterLift = await interactionPage.evaluate(() => window.__mutineHandwritingV006.getState());
await interactionPage.locator('#release-sequence').click();
const afterRelease = await interactionPage.evaluate(() => window.__mutineHandwritingV006.getState());
const interactionScreenshot = 'interaction-390x844.png';
await interactionPage.screenshot({ path: join(proofDir, interactionScreenshot), fullPage: false });
const interaction = {
  before,
  afterPointer,
  afterKeyboard,
  afterLift,
  afterRelease,
  buttons,
  rawGeometry,
  screenshot: interactionScreenshot,
  consoleMessages: interactionLoaded.consoleMessages,
  pageErrors: interactionLoaded.pageErrors,
  failedRequests: interactionLoaded.failedRequests,
  badResponses: interactionLoaded.badResponses
};
if (interactionLoaded.response.status() !== 200) failures.push('raw HTTP');
if (!rawGeometry.preview || !rawGeometry.interactivePreview || !rawGeometry.furnitureHidden || rawGeometry.scrollWidth > rawGeometry.innerWidth || rawGeometry.bodyScrollWidth > rawGeometry.innerWidth) failures.push('raw geometry');
if (buttons.some((button) => button.height < 44)) failures.push('raw touch target');
if (afterPointer.memoryCount !== before.memoryCount + 1 || !afterPointer.latestVisitorId || !afterPointer.paused || afterPointer.structuralGapRoutes < 3) failures.push('pointer interaction');
if (afterKeyboard.memoryCount !== afterPointer.memoryCount + 1 || !afterKeyboard.latestVisitorId) failures.push('keyboard interaction');
if (afterLift.memoryCount !== afterPointer.memoryCount || JSON.stringify(afterLift.routeSignature) !== JSON.stringify(afterPointer.routeSignature)) failures.push('lift exact restore');
if (afterRelease.memoryCount !== 0 || afterRelease.stage !== 0 || afterRelease.paused) failures.push('release sequence');
if (interactionLoaded.consoleMessages.length || interactionLoaded.pageErrors.length || interactionLoaded.failedRequests.length || interactionLoaded.badResponses.length) failures.push('interaction runtime issue');
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const blindLoaded = await loadPage(blindContext, `${base}/studies/handwriting/v006/?preview=1&static=1&blind=1`);
await blindLoaded.page.locator('#piece').waitFor({ state: 'visible' });
const blind = {
  status: blindLoaded.response.status(),
  furnitureHidden: await blindLoaded.page.evaluate(() => getComputedStyle(document.querySelector('.studio-header')).display === 'none'),
  textNodes: await blindLoaded.page.evaluate(() => document.querySelectorAll('.canvas-corner, .interaction-panel, .studio-header, .studio-path, figcaption').length),
  geometry: await blindLoaded.page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
  screenshot: 'blind-static-390x844.png',
  consoleMessages: blindLoaded.consoleMessages,
  pageErrors: blindLoaded.pageErrors,
  failedRequests: blindLoaded.failedRequests,
  badResponses: blindLoaded.badResponses
};
await blindLoaded.page.screenshot({ path: join(proofDir, blind.screenshot), fullPage: false });
if (blind.status !== 200 || !blind.furnitureHidden || blind.geometry.scrollWidth > blind.geometry.innerWidth || blind.consoleMessages.length || blind.pageErrors.length || blind.failedRequests.length || blind.badResponses.length) failures.push('blind preview');
await blindContext.close();
await browser.close();

const result = { status: failures.length ? 'failed' : 'passed', route: canonical, rawRoute: raw, matrix, interaction, blind, failures };
await mkdir(proofDir, { recursive: true });
await writeFile(join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: result.status, matrixRuns: matrix.length, failures, interaction: { before, afterPointer, afterKeyboard, afterLift, afterRelease, buttons }, blind }, null, 2));
if (failures.length) process.exitCode = 1;
