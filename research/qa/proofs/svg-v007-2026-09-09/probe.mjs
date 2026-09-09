import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/AppData/Local/Temp/mutine-playwright/node_modules/playwright');

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/svg-2026-09-09/`;
const raw = `${base}/studies/pure-svg/v007/?preview=1&interaction=1`;
const outputDir = new URL('./', import.meta.url);
const outputPath = new URL('./results.json', outputDir);
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const targets = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const matrix = [];
const failures = [];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function observePage(page, url, reduced, screenshotName) {
  const consoleMessages = [];
  const pageErrors = [];
  const networkFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => networkFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: fileURLToPath(new URL(screenshotName, outputDir)), fullPage: true });
  return { consoleMessages, pageErrors, networkFailures, badResponses };
}

for (const reduced of [false, true]) {
  for (const [width, height] of targets) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const observation = await observePage(page, canonical, reduced, `matrix-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`);
    await page.waitForSelector('iframe[title*="full artwork"]');
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v007/'));
    if (!frame) throw new Error(`study iframe missing at ${width}x${height}, reduced=${reduced}`);
    await frame.waitForSelector('svg#field');
    const state = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeRect: (() => { const rect = document.querySelector('iframe[title*="full artwork"]')?.getBoundingClientRect(); return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null; })(),
      headingRect: (() => { const rect = document.querySelector('.work-inspect__heading h1')?.getBoundingClientRect(); return rect ? { top: rect.top, left: rect.left } : null; })(),
      workId: document.body.dataset.workId
    }));
    const frameState = await frame.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svg: Boolean(document.querySelector('svg#field')),
      buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
      preview: document.documentElement.classList.contains('preview-mode'),
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
    }));
    const item = { reduced, requested: [width, height], state, frameState, observation };
    matrix.push(item);
    if (state.innerWidth !== width || state.clientWidth !== width || state.scrollWidth !== width) failures.push({ type: 'top-level-overflow', reduced, width, height, state });
    if (frameState.clientWidth !== frameState.scrollWidth) failures.push({ type: 'frame-overflow', reduced, width, height, frameState });
    if (!state.iframeRect || !state.headingRect || state.iframeRect.top >= state.headingRect.top) failures.push({ type: 'tableau-not-first', reduced, width, height, state });
    if (!frameState.svg || !frameState.preview || frameState.buttons.some((button) => button.height < 44)) failures.push({ type: 'frame-contract', reduced, width, height, frameState });
    if (observation.consoleMessages.length || observation.pageErrors.length || observation.networkFailures.length || observation.badResponses.length) failures.push({ type: 'browser-issues', reduced, width, height, observation });
    await page.close();
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const interactionObservation = await observePage(interactionPage, raw, false, 'interaction-initial-390x844.png');
await interactionPage.waitForSelector('svg#field');
const frame = interactionPage;
const initialState = await frame.locator('[data-memory]').textContent();
const structuralSignature = () => frame.locator('#field').evaluate((node) => ({
  body: node.querySelector('.animal')?.getAttribute('d') ?? '',
  routes: [...node.querySelectorAll('.route-line')].map((route) => route.getAttribute('d')).join('|'),
  feet: [...node.querySelectorAll('.route-foot')].map((foot) => `${foot.getAttribute('cx')},${foot.getAttribute('cy')}`).join('|')
}));
const fieldBox = await frame.locator('#field').boundingBox();
if (!fieldBox) throw new Error('interactive field missing');
await frame.mouse.click(fieldBox.x + fieldBox.width * 0.68, fieldBox.y + fieldBox.height * 0.45);
const afterPointer = {
  memory: await frame.locator('[data-memory]').textContent(),
  routeCount: await frame.locator('.route--echoed').count(),
  signature: await structuralSignature()
};
await frame.locator('#field').focus();
await frame.keyboard.press('Enter');
const afterKeyboard = {
  memory: await frame.locator('[data-memory]').textContent(),
  routeCount: await frame.locator('.route--echoed').count()
};
await frame.locator('#erase-control').click();
const afterErase = {
  memory: await frame.locator('[data-memory]').textContent(),
  signature: await structuralSignature()
};
await frame.locator('#release-control').click();
const afterRelease = await frame.locator('[data-memory]').textContent();
const interactionState = { initialState, afterPointer, afterKeyboard, afterErase, afterRelease, restoredPointerFrame: JSON.stringify(afterErase.signature) === JSON.stringify(afterPointer.signature), observation: interactionObservation };
if (!afterPointer.memory?.includes('remembered afterimages') || afterPointer.routeCount < 1) failures.push({ type: 'pointer-interaction', interactionState });
if (!afterKeyboard.memory?.includes('remembered afterimages')) failures.push({ type: 'keyboard-interaction', interactionState });
if (!interactionState.restoredPointerFrame) failures.push({ type: 'erase-not-reversible', interactionState });
if (!afterRelease.includes('remembered afterimages')) failures.push({ type: 'release-readout', interactionState });
if (interactionObservation.consoleMessages.length || interactionObservation.pageErrors.length || interactionObservation.networkFailures.length || interactionObservation.badResponses.length) failures.push({ type: 'interaction-browser-issues', interactionObservation });
await interactionPage.close();

const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await staticPage.emulateMedia({ reducedMotion: 'reduce' });
const staticObservation = await observePage(staticPage, `${base}/studies/pure-svg/v007/?preview=1&static=1`, true, 'static-reduced-390x844.png');
await staticPage.waitForSelector('svg#field');
const staticState = await staticPage.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  controls: document.querySelector('.field-controls')?.getBoundingClientRect().height,
  svg: Boolean(document.querySelector('svg#field')),
  staticMode: document.documentElement.classList.contains('static-mode')
}));
if (staticState.innerWidth !== 390 || staticState.clientWidth !== 390 || staticState.scrollWidth !== 390 || !staticState.svg || !staticState.staticMode) failures.push({ type: 'static-preview-contract', staticState });
if (staticObservation.consoleMessages.length || staticObservation.pageErrors.length || staticObservation.networkFailures.length || staticObservation.badResponses.length) failures.push({ type: 'static-browser-issues', staticObservation });
await staticPage.close();

await browser.close();
const result = { generatedAt: new Date().toISOString(), base, canonical, raw, targets, matrix, interactionState, staticState, failures, passed: failures.length === 0 };
await writeFile(outputPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, matrixRuns: matrix.length, failures: failures.length, interaction: { restoredPointerFrame: interactionState.restoredPointerFrame, afterPointer: interactionState.afterPointer.memory, afterKeyboard: interactionState.afterKeyboard.memory, afterErase: interactionState.afterErase.memory, afterRelease: interactionState.afterRelease }, staticState }, null, 2));
if (failures.length) process.exitCode = 1;
