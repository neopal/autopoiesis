import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const canonical = `${base}/works/brush-2026-09-10/`;
const raw = `${base}/studies/p5-brush/v008/?preview=1&interaction=1`;
const blindRaw = `${base}/studies/p5-brush/v008/?preview=1&static=1&blind=1`;
const proofDir = process.env.PROOF_DIR ?? 'research/qa/proofs/brush-v008-2026-09-10';
const targets = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const executablePath = process.env.CHROME_PATH ?? 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const matrix = [];
const failures = [];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function observePage(page, url) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  return { response, consoleMessages, pageErrors, failedRequests, badResponses };
}

for (const reduced of [false, true]) {
  for (const [width, height] of targets) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const observation = await observePage(page, canonical);
    await page.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v008/'));
    if (!frame) throw new Error(`embedded v008 frame missing at ${width}x${height}`);
    await frame.locator('#field').waitFor({ state: 'visible' });
    const outer = await page.evaluate(() => {
      const stage = document.querySelector('.work-inspect__stage')?.getBoundingClientRect();
      const heading = document.querySelector('.work-inspect__heading')?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        tableauFirst: Boolean(stage && heading && stage.top < heading.top),
        iframe: stage ? { top: stage.top, left: stage.left, width: stage.width, height: stage.height } : null,
        heading: heading ? { top: heading.top, left: heading.left } : null
      };
    });
    const inner = await frame.evaluate(() => {
      const field = document.querySelector('#field');
      const sample = field?.getContext('2d')?.getImageData(Math.max(0, Math.floor(field.width / 2)), Math.max(0, Math.floor(field.height / 2)), 1, 1).data ?? [];
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        preview: document.documentElement.classList.contains('preview-mode'),
        interactivePreview: document.documentElement.classList.contains('interactive-preview'),
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        canvasCss: [field?.getBoundingClientRect().width, field?.getBoundingClientRect().height],
        canvasPixels: [field?.width, field?.height],
        nonEmptySample: sample.length === 4 && sample.some((channel) => channel !== 0),
        buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
        memory: document.querySelector('[data-memory]')?.textContent
      };
    });
    const screenshot = `matrix-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`;
    await page.screenshot({ path: join(proofDir, screenshot), fullPage: false });
    const item = { reduced, viewport: { width, height }, status: observation.response.status(), outer, inner, screenshot, observation: { consoleMessages: observation.consoleMessages, pageErrors: observation.pageErrors, failedRequests: observation.failedRequests, badResponses: observation.badResponses } };
    matrix.push(item);

    if (observation.response.status() !== 200) failures.push(`canonical HTTP ${width}x${height}`);
    if (outer.innerWidth !== width || outer.clientWidth !== width || outer.scrollWidth > width || outer.bodyScrollWidth > width) failures.push(`outer overflow ${width}x${height}`);
    if (inner.innerWidth !== inner.clientWidth || inner.scrollWidth > inner.innerWidth || inner.bodyScrollWidth > inner.innerWidth) failures.push(`inner overflow ${width}x${height}`);
    if (!outer.tableauFirst || !inner.preview || !inner.canvasPixels[0] || !inner.canvasPixels[1] || !inner.nonEmptySample) failures.push(`tableau contract ${width}x${height}`);
    if (!inner.reduced !== !reduced) failures.push(`reduced media ${width}x${height}`);
    if (inner.buttons.some((button) => button.height < 44)) failures.push(`touch target ${width}x${height}`);
    if (observation.consoleMessages.length || observation.pageErrors.length || observation.failedRequests.length || observation.badResponses.length) failures.push(`runtime issue ${width}x${height}`);
    await context.close();
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionObservation = await observePage(interactionPage, raw);
await interactionPage.locator('#field').waitFor({ state: 'visible' });
const initial = await interactionPage.evaluate(() => ({
  memory: document.querySelector('[data-memory]')?.textContent,
  stage: document.querySelector('[data-stage]')?.textContent,
  preview: document.documentElement.classList.contains('preview-mode'),
  interactive: document.documentElement.classList.contains('interactive-preview'),
  furnitureHidden: getComputedStyle(document.querySelector('.studio-header')).display === 'none',
  geometry: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth }
}));
const buttons = await interactionPage.locator('.field-controls button').evaluateAll((elements) => elements.map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
const canvas = interactionPage.locator('#field');
const fieldBox = await canvas.boundingBox();
if (!fieldBox) throw new Error('interactive field missing');
const signature = async () => createHash('sha256').update(await canvas.evaluate((node) => node.toDataURL('image/png'))).digest('hex');
const beforeSignature = await signature();
await interactionPage.mouse.click(fieldBox.x + fieldBox.width * 0.67, fieldBox.y + fieldBox.height * 0.45);
const afterPointer = { memory: await interactionPage.locator('[data-memory]').textContent(), stage: await interactionPage.locator('[data-stage]').textContent(), signature: await signature() };
await canvas.focus();
await interactionPage.keyboard.press('Enter');
const afterKeyboard = { memory: await interactionPage.locator('[data-memory]').textContent(), stage: await interactionPage.locator('[data-stage]').textContent(), signature: await signature() };
await interactionPage.locator('#lift-membrane').click();
const afterLift = { memory: await interactionPage.locator('[data-memory]').textContent(), stage: await interactionPage.locator('[data-stage]').textContent(), signature: await signature() };
await interactionPage.locator('#release-sequence').click();
const afterRelease = { memory: await interactionPage.locator('[data-memory]').textContent(), stage: await interactionPage.locator('[data-stage]').textContent(), signature: await signature() };
const interactionScreenshot = 'interaction-final-390x844.png';
await interactionPage.screenshot({ path: join(proofDir, interactionScreenshot), fullPage: false });
const interaction = {
  initial,
  beforeSignature,
  afterPointer,
  afterKeyboard,
  afterLift,
  afterRelease,
  buttons,
  restoredExact: afterLift.signature === afterPointer.signature,
  releasedToSequence: afterRelease.memory === '0 membranes remembered' && afterRelease.stage === 'stage 01 / 12',
  observation: { consoleMessages: interactionObservation.consoleMessages, pageErrors: interactionObservation.pageErrors, failedRequests: interactionObservation.failedRequests, badResponses: interactionObservation.badResponses },
  screenshot: interactionScreenshot
};
if (interactionObservation.response.status() !== 200) failures.push('raw HTTP');
if (!initial.preview || !initial.interactive || !initial.furnitureHidden || initial.geometry.scrollWidth > initial.geometry.innerWidth || initial.geometry.bodyScrollWidth > initial.geometry.innerWidth) failures.push('raw preview contract');
if (buttons.some((button) => button.height < 44)) failures.push('raw touch target');
if (!afterPointer.memory?.includes('membranes') || afterPointer.memory === initial.memory) failures.push('pointer interaction');
if (!afterKeyboard.memory?.includes('membranes') || afterKeyboard.memory === afterPointer.memory) failures.push('keyboard interaction');
if (!interaction.restoredExact) failures.push('lift exact restore');
if (!afterRelease.memory?.includes('membranes') || afterRelease.memory !== '0 membranes remembered') failures.push('release sequence');
if (!interaction.releasedToSequence) failures.push('release sequence state');
if (interactionObservation.consoleMessages.length || interactionObservation.pageErrors.length || interactionObservation.failedRequests.length || interactionObservation.badResponses.length) failures.push('interaction runtime issue');
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
const blindObservation = await observePage(blindPage, blindRaw);
await blindPage.locator('#field').waitFor({ state: 'visible' });
const blind = {
  status: blindObservation.response.status(),
  furnitureHidden: await blindPage.evaluate(() => getComputedStyle(document.querySelector('.studio-header')).display === 'none'),
  controlsDisplay: await blindPage.evaluate(() => getComputedStyle(document.querySelector('.field-controls')).display),
  readoutDisplay: await blindPage.evaluate(() => getComputedStyle(document.querySelector('.field-readout')).display),
  geometry: await blindPage.evaluate(() => ({ innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth })),
  reduced: await blindPage.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
  screenshot: 'blind-static-390x844.png',
  observation: { consoleMessages: blindObservation.consoleMessages, pageErrors: blindObservation.pageErrors, failedRequests: blindObservation.failedRequests, badResponses: blindObservation.badResponses }
};
await blindPage.screenshot({ path: join(proofDir, blind.screenshot), fullPage: false });
if (blind.status !== 200 || !blind.furnitureHidden || blind.controlsDisplay !== 'none' || blind.readoutDisplay !== 'none' || blind.geometry.scrollWidth > blind.geometry.innerWidth || blind.geometry.bodyScrollWidth > blind.geometry.innerWidth || !blind.reduced) failures.push('blind preview contract');
if (blind.observation.consoleMessages.length || blind.observation.pageErrors.length || blind.observation.failedRequests.length || blind.observation.badResponses.length) failures.push('blind runtime issue');
await blindContext.close();

await browser.close();
const result = { generatedAt: new Date().toISOString(), base, canonical, raw, blindRaw, targets, matrix, interaction, blind, failures, passed: failures.length === 0 };
await writeFile(join(proofDir, process.env.RESULT_FILE ?? 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ passed: result.passed, matrixRuns: matrix.length, failures, interaction: { initial: initial.memory, afterPointer: afterPointer.memory, afterKeyboard: afterKeyboard.memory, afterLift: afterLift.memory, afterRelease: afterRelease.memory, restoredExact: interaction.restoredExact, releasedToSequence: interaction.releasedToSequence }, blind: { controlsDisplay: blind.controlsDisplay, readoutDisplay: blind.readoutDisplay, reduced: blind.reduced } }, null, 2));
if (failures.length) process.exitCode = 1;
