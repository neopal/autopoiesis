import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const proofDir = new URL('./', import.meta.url);
const proofPath = (name) => fileURLToPath(new URL(name, proofDir));
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const results = {
  base,
  viewportMatrix: [],
  rawInteraction: null,
  staticBlind: null,
  journal: null,
  redirect: null,
  favicon: null,
  issues: []
};

async function makeContext(reducedMotion = false) {
  return browser.newContext({
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1
  });
}

async function captureIssues(page, bucket) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'failed' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  bucket.__listeners = { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function outerEvidence(page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      iframeVisible: Boolean(iframe && iframe.getBoundingClientRect().width > 0 && iframe.getBoundingClientRect().height > 0),
      tableauFirst: Boolean(iframe && heading && iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)
    };
  });
}

async function frameFor(page) {
  await page.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v012/'));
  if (!frame) throw new Error('v012 tableau frame not found');
  await frame.locator('#field').waitFor({ state: 'visible' });
  return frame;
}

for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    const context = await makeContext(reducedMotion);
    const page = await context.newPage();
    const bucket = { reducedMotion, viewport, issues: [] };
    await captureIssues(page, bucket);
    await page.setViewportSize(viewport);
    await page.goto(`${base}/works/portrait-2026-09-17/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(reducedMotion ? 80 : 30);
    const frame = await frameFor(page);
    const state = await frame.evaluate(() => window.__mutinePortraitV012?.getState());
    bucket.outer = await outerEvidence(page);
    bucket.tableau = await frame.evaluate(() => {
      const canvas = document.querySelector('#field');
      const buttons = [...document.querySelectorAll('button')].map((button) => ({
        id: button.id,
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height
      }));
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
        state: window.__mutinePortraitV012?.getState(),
        buttons
      };
    });
    await page.screenshot({ path: proofPath(`canonical-${reducedMotion ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`), fullPage: true });
    bucket.issues = bucket.__listeners;
    delete bucket.__listeners;
    results.viewportMatrix.push(bucket);
    await context.close();
  }
}

{
  const context = await makeContext(false);
  const page = await context.newPage();
  const bucket = { viewport: { width: 390, height: 844 }, issues: [] };
  await captureIssues(page, bucket);
  await page.setViewportSize(bucket.viewport);
  await page.goto(`${base}/studies/self-portrait/v012/?preview=1&interaction=1&blind=1`, { waitUntil: 'networkidle' });
  const frame = await page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v012/'));
  await frame.locator('#field').waitFor({ state: 'visible' });
  const canvas = frame.locator('#field');
  const before = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const initial = await frame.evaluate(() => window.__mutinePortraitV012.getState());
  await canvas.click({ position: { x: 294, y: 230 } });
  const pointer = await frame.evaluate(() => window.__mutinePortraitV012.getState());
  const afterPointer = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await canvas.focus();
  await canvas.press('Enter');
  const keyboard = await frame.evaluate(() => window.__mutinePortraitV012.getState());
  await frame.locator('#undo-control').click();
  const undone = await frame.evaluate(() => window.__mutinePortraitV012.getState());
  const restored = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await frame.locator('#release-control').click();
  const released = await frame.evaluate(() => window.__mutinePortraitV012.getState());
  bucket.outer = await frame.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  bucket.initial = initial;
  bucket.pointer = pointer;
  bucket.keyboard = keyboard;
  bucket.undone = undone;
  bucket.released = released;
  bucket.pixelChangedAfterPointer = before !== afterPointer;
  bucket.exactRestoreAfterUndo = afterPointer === restored;
  bucket.buttons = await frame.evaluate(() => [...document.querySelectorAll('button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  await page.screenshot({ path: proofPath('./raw-interaction-390x844.png'), fullPage: true });
  bucket.issues = bucket.__listeners;
  delete bucket.__listeners;
  results.rawInteraction = bucket;
  await context.close();
}

{
  const context = await makeContext(true);
  const page = await context.newPage();
  const bucket = { viewport: { width: 390, height: 844 }, issues: [] };
  await captureIssues(page, bucket);
  await page.setViewportSize(bucket.viewport);
  await page.goto(`${base}/studies/self-portrait/v012/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('#field');
    const readout = document.querySelector('.surface-readout');
    const controls = document.querySelector('.field-controls');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
      readoutDisplay: getComputedStyle(readout).display,
      controlsDisplay: getComputedStyle(controls).display,
      marksVisible: document.documentElement.classList.contains('blind-mode'),
      state: window.__mutinePortraitV012.getState()
    };
  });
  bucket.evidence = evidence;
  await page.screenshot({ path: proofPath('./static-blind-390x844.png'), fullPage: true });
  bucket.issues = bucket.__listeners;
  delete bucket.__listeners;
  results.staticBlind = bucket;
  await context.close();
}

{
  const context = await makeContext(true);
  const page = await context.newPage();
  const bucket = { viewport: { width: 390, height: 844 }, issues: [] };
  await captureIssues(page, bucket);
  await page.setViewportSize(bucket.viewport);
  await page.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  bucket.evidence = await page.evaluate(() => {
    const entry = document.querySelector('#journal-portrait-2026-09-17');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      count: document.querySelectorAll('#journal-portrait-2026-09-17').length,
      title: entry?.querySelector('h3')?.textContent ?? null,
      href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null
    };
  });
  await page.screenshot({ path: proofPath('./journal-390x844.png'), fullPage: true });
  bucket.issues = bucket.__listeners;
  delete bucket.__listeners;
  results.journal = bucket;
  await context.close();
}

{
  const context = await makeContext(false);
  const page = await context.newPage();
  const bucket = { issues: [] };
  await captureIssues(page, bucket);
  await page.goto(`${base}/studies/self-portrait/v012/`, { waitUntil: 'networkidle' });
  bucket.finalUrl = page.url();
  bucket.hasTableau = await page.locator('.work-inspect__stage iframe').count() === 1;
  bucket.issues = bucket.__listeners;
  delete bucket.__listeners;
  results.redirect = bucket;
  await context.close();
}

{
  const context = await makeContext(false);
  const response = await context.request.get(`${base}/studio/favicon.svg`);
  results.favicon = { status: response.status(), contentType: response.headers()['content-type'] ?? null };
  await context.close();
}

for (const bucket of [...results.viewportMatrix, results.rawInteraction, results.staticBlind, results.journal, results.redirect]) {
  if (!bucket) continue;
  for (const category of Object.values(bucket.issues ?? {})) results.issues.push(...category);
}

await writeFile(proofPath('./results.json'), `${JSON.stringify(results, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({
  matrixRuns: results.viewportMatrix.length,
  issues: results.issues.length,
  rawInteraction: results.rawInteraction,
  staticBlind: results.staticBlind?.evidence,
  journal: results.journal?.evidence,
  redirect: results.redirect,
  favicon: results.favicon
}, null, 2));
