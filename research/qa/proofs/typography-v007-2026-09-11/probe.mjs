import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173';
const work = `${base}/works/typography-2026-09-11/`;
const raw = `${base}/studies/handwriting/v007/?preview=1&interaction=1`;
const proofDir = 'research/qa/proofs/typography-v007-2026-09-11';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function observePage(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  return { consoleMessages, pageErrors, requestFailures, badResponses };
}

async function canonicalRun(viewport, reducedMotion, index) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const observations = await observePage(page);
  await page.goto(work, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForTimeout(120);
  const evidence = await page.evaluate(() => {
    const firstCanvas = document.querySelector('iframe');
    const title = document.querySelector('h1');
    const root = document.documentElement;
    const rect = (node) => node ? node.getBoundingClientRect().toJSON() : null;
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      workId: document.body.dataset.workId,
      firstTableauTop: rect(firstCanvas)?.top ?? null,
      titleTop: rect(title)?.top ?? null,
      iframeCount: document.querySelectorAll('iframe').length,
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
      navLabels: [...document.querySelectorAll('nav[aria-label="Studio navigation"] a')].map((node) => node.textContent.trim())
    };
  });
  assert.equal(evidence.innerWidth, viewport.width);
  assert.equal(evidence.clientWidth, viewport.width);
  assert.equal(evidence.scrollWidth, viewport.width);
  assert.equal(evidence.bodyScrollWidth, viewport.width);
  assert.equal(evidence.workId, 'typography-2026-09-11');
  assert.equal(evidence.ready, true);
  assert.equal(evidence.iframeCount, 1);
  assert.ok(evidence.firstTableauTop < evidence.titleTop, 'tableau must precede title in the rendered shell');
  assert.deepEqual(evidence.navLabels, ['gallery', 'journal']);
  await page.screenshot({ path: `${proofDir}/canonical-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`, fullPage: true });
  results.push({ kind: 'canonical', viewport, reducedMotion, evidence, ...observations });
  await context.close();
}

for (let index = 0; index < viewports.length; index += 1) {
  await canonicalRun(viewports[index], false, index);
  await canonicalRun(viewports[index], true, index);
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionObservations = await observePage(interactionPage);
await interactionPage.goto(raw, { waitUntil: 'networkidle' });
await interactionPage.waitForSelector('#piece');
await interactionPage.waitForTimeout(120);
const initial = await interactionPage.evaluate(() => window.__mutineHandwritingV007.getState());
const canvasRect = await interactionPage.locator('#piece').boundingBox();
assert.ok(canvasRect && canvasRect.width > 0 && canvasRect.height > 0);
await interactionPage.mouse.click(canvasRect.x + canvasRect.width * 0.46, canvasRect.y + canvasRect.height * 0.42);
const afterPointer = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
await interactionPage.locator('#piece').focus();
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
await interactionPage.locator('#lift-stutter').click();
const afterLift = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
assert.equal(initial.memory, 0);
assert.equal(afterPointer.state.memory, 1);
assert.ok(afterPointer.state.affectedRoutes >= 4);
assert.equal(afterKeyboard.state.memory, 2);
assert.equal(afterLift.state.memory, 1);
assert.equal(afterLift.signature, afterPointer.signature, 'lifting latest stutter must restore pointer state exactly');
const touchTargets = await interactionPage.locator('button').evaluateAll((buttons) => buttons.map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })));
assert.equal(touchTargets.length, 3);
assert.ok(touchTargets.every((button) => button.height >= 44));
await interactionPage.locator('#release-sequence').click();
const afterRelease = await interactionPage.evaluate(() => window.__mutineHandwritingV007.getState());
assert.equal(afterRelease.memory, 0);
await interactionPage.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: true });
results.push({ kind: 'raw-interaction', viewport: { width: 390, height: 844 }, initial, afterPointer, afterKeyboard, afterLift, afterRelease, touchTargets, ...interactionObservations });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
const blindObservations = await observePage(blindPage);
await blindPage.goto(`${base}/studies/handwriting/v007/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blindPage.waitForSelector('#piece');
await blindPage.waitForTimeout(120);
const blindEvidence = await blindPage.evaluate(() => {
  const root = document.documentElement;
  const canvas = document.querySelector('#piece');
  return {
    innerWidth: window.innerWidth,
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    canvasWidth: canvas.getBoundingClientRect().width,
    canvasHeight: canvas.getBoundingClientRect().height,
    headerDisplay: getComputedStyle(document.querySelector('.studio-header')).display,
    cornerDisplay: getComputedStyle(document.querySelector('.canvas-corner')).display,
    panelDisplay: getComputedStyle(document.querySelector('.interaction-panel')).display
  };
});
assert.equal(blindEvidence.innerWidth, 390);
assert.equal(blindEvidence.clientWidth, 390);
assert.equal(blindEvidence.scrollWidth, 390);
assert.equal(blindEvidence.canvasWidth, 390);
assert.equal(blindEvidence.headerDisplay, 'none');
assert.equal(blindEvidence.cornerDisplay, 'none');
assert.equal(blindEvidence.panelDisplay, 'none');
await blindPage.screenshot({ path: `${proofDir}/raw-blind-reduced-390x844.png`, fullPage: true });
results.push({ kind: 'raw-blind', viewport: { width: 390, height: 844 }, reducedMotion: true, blindEvidence, ...blindObservations });
await blindContext.close();

await browser.close();
const summary = {
  status: 'passed',
  route: work,
  rawRoute: raw,
  matrix: results,
  counts: {
    canonicalRuns: results.filter((entry) => entry.kind === 'canonical').length,
    rawInteractionRuns: results.filter((entry) => entry.kind === 'raw-interaction').length,
    rawBlindRuns: results.filter((entry) => entry.kind === 'raw-blind').length,
    screenshots: 12,
    consoleMessages: results.reduce((sum, entry) => sum + entry.consoleMessages.length, 0),
    pageErrors: results.reduce((sum, entry) => sum + entry.pageErrors.length, 0),
    requestFailures: results.reduce((sum, entry) => sum + entry.requestFailures.length, 0),
    badResponses: results.reduce((sum, entry) => sum + entry.badResponses.length, 0)
  }
};
assert.equal(summary.counts.canonicalRuns, 10);
assert.equal(summary.counts.screenshots, 12);
assert.equal(summary.counts.consoleMessages, 0);
assert.equal(summary.counts.pageErrors, 0);
assert.equal(summary.counts.requestFailures, 0);
assert.equal(summary.counts.badResponses, 0);
await writeFile(`${proofDir}/results.json`, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ status: summary.status, counts: summary.counts, interaction: { initial, afterPointer: afterPointer.state, afterKeyboard: afterKeyboard.state, afterLift: afterLift.state, afterRelease } }, null, 2));
