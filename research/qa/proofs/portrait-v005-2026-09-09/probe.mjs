import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/portrait-2026-09-09/`;
const raw = `${base}/studies/self-portrait/v005/?preview=1&interaction=1`;
const outputDir = fileURLToPath(new URL('./', import.meta.url));
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const targets = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const matrix = [];
const failures = [];

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
    await page.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
    const iframe = page.locator('.work-inspect__stage iframe');
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v005/'));
    if (!frame) throw new Error(`embedded v005 frame missing at ${width}x${height}`);
    await frame.locator('#field').waitFor({ state: 'visible' });
    const outer = await page.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      tableauFirst: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top < document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top
    }));
    const inner = await frame.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasPixels: document.querySelector('#field')?.width * document.querySelector('#field')?.height,
      canvasCss: [document.querySelector('#field')?.getBoundingClientRect().width, document.querySelector('#field')?.getBoundingClientRect().height],
      preview: document.documentElement.classList.contains('preview-mode'),
      interactionPreview: document.documentElement.classList.contains('interactive-preview'),
      state: window.__mutinePortraitV005?.getState()
    }));
    const screenshot = `mutine-v005-target-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`;
    await page.screenshot({ path: join(outputDir, screenshot), fullPage: false });
    const record = { requested: [width, height], reducedMotion: reduced, outer, inner, screenshot, consoleMessages, pageErrors, networkFailures, httpFailures };
    matrix.push(record);
    if (outer.innerWidth !== width || outer.clientWidth !== width || outer.scrollWidth > width) failures.push(`outer geometry ${width}x${height}`);
    if (inner.innerWidth !== inner.clientWidth) failures.push(`inner width ${width}x${height}`);
    if (inner.scrollWidth > inner.innerWidth) failures.push(`inner overflow ${width}x${height}`);
    if (!inner.preview || !inner.canvasPixels) failures.push(`inner tableau ${width}x${height}`);
    if (!outer.tableauFirst) failures.push(`tableau order ${width}x${height}`);
    if (consoleMessages.length || pageErrors.length || networkFailures.length || httpFailures.length) failures.push(`runtime errors ${width}x${height}`);
    await page.close();
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const interactionConsole = [];
const interactionErrors = [];
const interactionNetwork = [];
interactionPage.on('console', (message) => interactionConsole.push({ type: message.type(), text: message.text() }));
interactionPage.on('pageerror', (error) => interactionErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
await interactionPage.emulateMedia({ reducedMotion: 'reduce' });
await interactionPage.goto(raw, { waitUntil: 'networkidle' });
await interactionPage.locator('#field').waitFor({ state: 'visible' });
const before = await interactionPage.evaluate(() => window.__mutinePortraitV005.getState());
const buttons = await interactionPage.locator('.field-controls button').evaluateAll((elements) => elements.map((element) => ({ label: element.textContent.trim(), height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width })));
const rawGeometry = await interactionPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, preview: document.documentElement.classList.contains('preview-mode'), interactionPreview: document.documentElement.classList.contains('interactive-preview') }));
await interactionPage.locator('#decision-control').click();
const afterPointer = await interactionPage.evaluate(() => window.__mutinePortraitV005.getState());
await interactionPage.locator('#field').focus();
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => window.__mutinePortraitV005.getState());
await interactionPage.locator('#undo-control').click();
const afterUndo = await interactionPage.evaluate(() => window.__mutinePortraitV005.getState());
await interactionPage.locator('#release-control').click();
const afterRelease = await interactionPage.evaluate(() => window.__mutinePortraitV005.getState());
const interactionScreenshot = 'mutine-v005-interaction-390x844.png';
await interactionPage.screenshot({ path: join(outputDir, interactionScreenshot), fullPage: false });
const interaction = { before, afterPointer, afterKeyboard, afterUndo, afterRelease, buttons, rawGeometry, interactionConsole, interactionErrors, interactionNetwork, screenshot: interactionScreenshot };
if (!rawGeometry.preview || !rawGeometry.interactionPreview || rawGeometry.scrollWidth > rawGeometry.innerWidth) failures.push('raw preview geometry');
if (buttons.some((button) => button.height < 44)) failures.push('touch target height');
if (afterPointer.interaction !== 'visitor-decision' || !afterPointer.paused) failures.push('pointer interaction');
if (afterKeyboard.memory <= afterPointer.memory || afterKeyboard.interaction !== 'visitor-decision') failures.push('keyboard interaction');
if (afterUndo.interaction !== 'decision-lifted' || afterUndo.memory !== afterPointer.memory) failures.push('undo interaction');
if (afterRelease.interaction !== null || afterRelease.memory !== 0 || afterRelease.paused) failures.push('release interaction');
if (interactionConsole.length || interactionErrors.length || interactionNetwork.length) failures.push('interaction runtime errors');
await interactionPage.close();
await browser.close();

const result = {
  status: failures.length ? 'failed' : 'passed',
  route: canonical,
  rawRoute: raw,
  matrix,
  interaction,
  failures
};
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, matrixRuns: matrix.length, failures, interaction: { before, afterPointer, afterKeyboard, afterUndo, afterRelease, buttons } }, null, 2));
if (failures.length) process.exitCode = 1;
