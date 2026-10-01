import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4197';
const evidenceDir = 'research/qa/proofs/naive-art-v022-2026-10-01';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = {
  raw: '/studies/naive-art/v022/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-01/'
};

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function inspect(page, label, viewport, reduced, route) {
  const measurements = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
      firstCanvas: rect('#misfile-field'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.misfile-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      rawState: window.__mutineNaiveV022?.getState?.() ?? null,
      pageTitle: document.title
    };
  });
  if (label === 'canonical') {
    const embedded = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v022/'));
    if (embedded) {
      measurements.embedded = await embedded.evaluate(() => {
        const field = document.querySelector('#misfile-field');
        const rect = field?.getBoundingClientRect();
        return {
          innerWidth: window.innerWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          fieldVisible: Boolean(field && getComputedStyle(field).display !== 'none'),
          fieldRect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null,
          state: window.__mutineNaiveV022?.getState?.() ?? null,
          controls: [...document.querySelectorAll('.misfile-controls button')].map((node) => {
            const box = node.getBoundingClientRect();
            return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
          })
        };
      });
    }
  }
  const file = `${evidenceDir}/${label}-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: file, fullPage: false });
  return { label, viewport, reduced, route, measurements, screenshot: file };
}

for (const [label, route] of Object.entries(routes)) {
  for (const viewport of viewports) {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
      const response = await page.goto(`${ROOT}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(reduced ? 80 : 120);
      const entry = await inspect(page, label, viewport, reduced, route);
      entry.httpStatus = response?.status() ?? null;
      entry.pageErrors = errors;
      entry.failedRequests = failed;
      results.push(entry);
      await context.close();
    }
  }
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const interactionErrors = [];
const interactionFailed = [];
page.on('pageerror', (error) => interactionErrors.push(String(error)));
page.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
await page.goto(`${ROOT}${routes.raw}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(90);
const initial = await page.evaluate(() => window.__mutineNaiveV022.getState());
const piece = page.locator('.piece').nth(1);
const pieceBox = await piece.boundingBox();
await page.mouse.click(pieceBox.x + pieceBox.width / 2, pieceBox.y + pieceBox.height / 2);
const afterTap = await page.evaluate(() => window.__mutineNaiveV022.getState());
const sourceSlot = page.locator('.slot').nth(1);
const targetSlot = page.locator('.slot').nth(7);
const sourceBox = await sourceSlot.boundingBox();
const targetBox = await targetSlot.boundingBox();
await page.mouse.move(pieceBox.x + pieceBox.width / 2, pieceBox.y + pieceBox.height / 2);
await page.mouse.down();
await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(100);
const afterDrag = await page.evaluate(() => window.__mutineNaiveV022.getState());
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV022.getState());
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV022.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV022.getState());
await page.screenshot({ path: `${evidenceDir}/interaction-390x844.png`, fullPage: false });
const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
const blindResponse = await blind.goto(`${ROOT}/studies/naive-art/v022/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForTimeout(100);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#misfile-field')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.ledger-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.misfile-controls')).display !== 'none',
  headingVisible: getComputedStyle(document.querySelector('.ledger-heading')).display !== 'none',
  state: window.__mutineNaiveV022.getState()
}));
await blind.screenshot({ path: `${evidenceDir}/blind-390x844.png`, fullPage: false });
const blindHttp = blindResponse?.status() ?? null;
await blindContext.close();
await context.close();
await browser.close();

const interaction = {
  initial,
  afterTap,
  afterDrag,
  afterEnter,
  afterDelete,
  afterRelease,
  sourceBox,
  targetBox,
  pageErrors: interactionErrors,
  failedRequests: interactionFailed
};
assert.equal(afterTap.memory, initial.memory, 'a short tap must be refused');
assert.equal(afterDrag.memory, initial.memory + 1, 'a traveled drag must commit one misfile');
assert.equal(afterDrag.vacancies, 1, 'a committed drag must leave one vacancy');
assert.equal(afterDrag.railCount, 1, 'a committed drag must file one displaced piece');
assert.equal(afterEnter.memory, afterDrag.memory + 1, 'keyboard Enter must be an equivalent commit path');
assert.equal(afterDelete.memory, afterEnter.memory - 1, 'Delete must lift only the latest misfile');
assert.equal(afterRelease.memory, 0, 'R must release the picture');
const output = {
  status: 'local-headless-browser-probe',
  root: ROOT,
  routes,
  viewportRuns: results,
  interaction,
  blind: { httpStatus: blindHttp, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length).length
  }
};
await writeFile(`${evidenceDir}/results.json`, JSON.stringify(output, null, 2));
process.stdout.write(JSON.stringify({
  status: output.status,
  counts: output.counts,
  interaction: {
    initialMemory: initial.memory,
    afterTapMemory: afterTap.memory,
    afterDragMemory: afterDrag.memory,
    afterDragVacancies: afterDrag.vacancies,
    afterDragRailCount: afterDrag.railCount,
    afterEnterMemory: afterEnter.memory,
    afterDeleteMemory: afterDelete.memory,
    afterReleaseMemory: afterRelease.memory,
    errors: interactionErrors.length + blindErrors.length,
    failedRequests: interactionFailed.length + blindFailed.length
  },
  blind: blindEvidence
}, null, 2));
