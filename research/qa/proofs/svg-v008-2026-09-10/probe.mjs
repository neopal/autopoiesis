import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/AppData/Local/Temp/mutine-playwright/node_modules/playwright');

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/svg-2026-09-10/`;
const raw = `${base}/studies/pure-svg/v008/?preview=1&interaction=1`;
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
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v008/'));
    if (!frame) throw new Error(`study iframe missing at ${width}x${height}, reduced=${reduced}`);
    await frame.waitForSelector('svg#field');
    const state = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeRect: (() => { const rect = document.querySelector('iframe[title*="full artwork"]')?.getBoundingClientRect(); return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null; })(),
      headingRect: (() => { const rect = document.querySelector('.work-inspect__heading h1')?.getBoundingClientRect(); return rect ? { top: rect.top, left: rect.left } : null; })(),
      workId: document.body.dataset.workId,
      title: document.title
    }));
    const frameState = await frame.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svg: Boolean(document.querySelector('svg#field')),
      buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
      preview: document.documentElement.classList.contains('preview-mode'),
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      memory: document.querySelector('[data-memory]')?.textContent
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
const structuralSignature = () => interactionPage.locator('#field').evaluate((node) => ({
  body: node.querySelector('.animal')?.getAttribute('d') ?? '',
  routes: [...node.querySelectorAll('.route-line')].map((route) => route.getAttribute('d')).join('|'),
  feet: [...node.querySelectorAll('.route-foot')].map((foot) => `${foot.getAttribute('cx')},${foot.getAttribute('cy')}`).join('|')
}));
const initial = {
  memory: await interactionPage.locator('[data-memory]').textContent(),
  preview: await interactionPage.evaluate(() => document.documentElement.classList.contains('preview-mode')),
  interactive: await interactionPage.evaluate(() => document.documentElement.classList.contains('interactive-preview')),
  overflow: await interactionPage.evaluate(() => ({ innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
};
const fieldBox = await interactionPage.locator('#field').boundingBox();
if (!fieldBox) throw new Error('interactive field missing');
await interactionPage.mouse.click(fieldBox.x + fieldBox.width * 0.68, fieldBox.y + fieldBox.height * 0.45);
const afterPointer = {
  memory: await interactionPage.locator('[data-memory]').textContent(),
  routeCount: await interactionPage.locator('.route--relayed').count(),
  signature: await structuralSignature()
};
await interactionPage.locator('#field').focus();
await interactionPage.keyboard.press('Enter');
const afterKeyboard = {
  memory: await interactionPage.locator('[data-memory]').textContent(),
  routeCount: await interactionPage.locator('.route--relayed').count(),
  signature: await structuralSignature()
};
await interactionPage.locator('#unlink-control').click();
const afterUnlink = {
  memory: await interactionPage.locator('[data-memory]').textContent(),
  signature: await structuralSignature(),
  readout: await interactionPage.locator('[data-stage]').textContent()
};
await interactionPage.locator('#release-control').click();
const afterRelease = {
  memory: await interactionPage.locator('[data-memory]').textContent(),
  readout: await interactionPage.locator('[data-stage]').textContent()
};
await interactionPage.screenshot({ path: fileURLToPath(new URL('interaction-final-390x844.png', outputDir)), fullPage: true });
const interactionState = {
  initial,
  afterPointer,
  afterKeyboard,
  afterUnlink,
  afterRelease,
  restoredPointerFrame: JSON.stringify(afterUnlink.signature) === JSON.stringify(afterPointer.signature),
  observation: interactionObservation
};
if (!initial.preview || !initial.interactive || initial.overflow.clientWidth !== initial.overflow.scrollWidth) failures.push({ type: 'raw-preview-contract', interactionState });
if (!afterPointer.memory?.includes('remembered relays') || afterPointer.routeCount < 1) failures.push({ type: 'pointer-interaction', interactionState });
if (!afterKeyboard.memory?.includes('remembered relays') || afterKeyboard.routeCount < afterPointer.routeCount) failures.push({ type: 'keyboard-interaction', interactionState });
if (!interactionState.restoredPointerFrame) failures.push({ type: 'unlink-not-reversible', interactionState });
if (!afterRelease.memory?.includes('remembered relays')) failures.push({ type: 'release-readout', interactionState });
if (interactionObservation.consoleMessages.length || interactionObservation.pageErrors.length || interactionObservation.networkFailures.length || interactionObservation.badResponses.length) failures.push({ type: 'interaction-browser-issues', interactionObservation });
await interactionPage.close();

const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const staticObservation = await observePage(staticPage, `${base}/studies/pure-svg/v008/?preview=1&static=1`, true, 'static-reduced-390x844.png');
await staticPage.waitForSelector('svg#field');
const staticState = await staticPage.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
  readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
  witnessCount: document.querySelectorAll('.relay-witness,.handoff-thread,.relay-stitch').length,
  svg: Boolean(document.querySelector('svg#field')),
  staticMode: document.documentElement.classList.contains('static-mode'),
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
}));
if (staticState.innerWidth !== 390 || staticState.clientWidth !== 390 || staticState.scrollWidth !== 390 || !staticState.svg || !staticState.staticMode || staticState.controlsDisplay !== 'none' || staticState.readoutDisplay !== 'none') failures.push({ type: 'static-preview-contract', staticState });
if (staticObservation.consoleMessages.length || staticObservation.pageErrors.length || staticObservation.networkFailures.length || staticObservation.badResponses.length) failures.push({ type: 'static-browser-issues', staticObservation });
await staticPage.close();

await browser.close();
const result = { generatedAt: new Date().toISOString(), base, canonical, raw, targets, matrix, interactionState, staticState, failures, passed: failures.length === 0 };
await writeFile(outputPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, matrixRuns: matrix.length, failures: failures.length, interaction: { restoredPointerFrame: interactionState.restoredPointerFrame, initial: interactionState.initial.memory, afterPointer: interactionState.afterPointer.memory, afterKeyboard: interactionState.afterKeyboard.memory, afterUnlink: interactionState.afterUnlink.memory, afterRelease: interactionState.afterRelease.memory }, staticState }, null, 2));
if (failures.length) process.exitCode = 1;
