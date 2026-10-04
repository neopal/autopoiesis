import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4213;
const proofDir = resolve(ROOT, 'research/qa/proofs/naive-art-v023-2026-10-03');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v023/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-03/'
};

await mkdir(proofDir, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const candidate = resolve(ROOT, relative);
    if (!(candidate === ROOT || candidate.startsWith(ROOT + '\\') || candidate.startsWith(ROOT + '/'))) {
      response.writeHead(403); response.end('forbidden'); return;
    }
    let file = candidate;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      response.writeHead(404); response.end('not found'); return;
    }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('server error');
  }
});
await new Promise((resolveServer) => server.listen(port, '127.0.0.1', resolveServer));

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function canonicalFrame(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV023));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v023/'));
}

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
      firstCanvas: rect('#naive-field'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.slip-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      rawState: window.__mutineNaiveV023?.getState?.() ?? null,
      pageTitle: document.title
    };
  });
  if (label === 'canonical') {
    const frame = await canonicalFrame(page);
    measurements.embedded = await frame.evaluate(() => {
      const canvas = document.querySelector('#naive-field');
      const box = canvas?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fieldVisible: Boolean(canvas && getComputedStyle(canvas).display !== 'none'),
        fieldRect: box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null,
        state: window.__mutineNaiveV023?.getState?.() ?? null,
        controls: [...document.querySelectorAll('.slip-controls button')].map((node) => {
          const button = node.getBoundingClientRect();
          return { width: button.width, height: button.height, visible: getComputedStyle(node).display !== 'none' };
        })
      };
    });
  }
  const file = `${proofDir}/${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: file, fullPage: false });
  return { label, viewport: { width: viewport[0], height: viewport[1] }, reduced, route, measurements, screenshot: file };
}

for (const [label, route] of Object.entries(routes)) {
  for (const viewport of viewports) {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
      const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(reduced ? 100 : 140);
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
await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(120);
const initial = await page.evaluate(() => window.__mutineNaiveV023.getState());
const canvasBox = await page.locator('#naive-field').boundingBox();
await page.mouse.click(canvasBox.x + canvasBox.width * .54, canvasBox.y + canvasBox.height * .46);
const afterTap = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.waitForTimeout(140);
await page.mouse.click(canvasBox.x + canvasBox.width * .54, canvasBox.y + canvasBox.height * .46);
const afterDoubleTap = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.locator('#slip-field').focus();
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.getByRole('button', { name: 'make a slip' }).click();
const afterButton = await page.evaluate(() => window.__mutineNaiveV023.getState());
await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
const blindResponse = await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v023/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForTimeout(120);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#naive-field')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.slip-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.slip-controls')).display !== 'none',
  state: window.__mutineNaiveV023.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

const interaction = { initial, afterTap, afterDoubleTap, afterEnter, afterDelete, afterRelease, afterButton, pageErrors: interactionErrors, failedRequests: interactionFailed };
assert.equal(afterTap.memory, initial.memory, 'one tap must be refused');
assert.equal(afterDoubleTap.memory, initial.memory + 1, 'two taps inside the interval must commit one slip');
assert.equal(afterDoubleTap.wrongLandingCount, 1, 'a slip must change one landing');
assert.equal(afterDoubleTap.intendedGapCount, 1, 'a slip must leave one intended gap');
assert.equal(afterEnter.memory, afterDoubleTap.memory + 1, 'Enter must be an equivalent commit path');
assert.equal(afterDelete.memory, afterEnter.memory - 1, 'Delete must lift only the latest slip');
assert.equal(afterRelease.memory, 0, 'R must release the route');
assert.equal(afterButton.memory, 1, 'the slip control must commit the same structural event');
assert.equal(blindEvidence.fieldVisible, true);
assert.equal(blindEvidence.readoutVisible, false);
assert.equal(blindEvidence.controlsVisible, false);

const output = {
  status: 'local-headless-browser-probe',
  root: `http://127.0.0.1:${port}`,
  routes,
  viewportRuns: results,
  interaction,
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth || entry.measurements.embedded?.scrollWidth > entry.measurements.embedded?.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length).length
  }
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(output, null, 2));
await blindContext.close();
await context.close();
await browser.close();
await new Promise((resolveServer) => server.close(resolveServer));
process.stdout.write(JSON.stringify({
  status: output.status,
  counts: output.counts,
  interaction: {
    initialMemory: initial.memory,
    afterTapMemory: afterTap.memory,
    afterDoubleTapMemory: afterDoubleTap.memory,
    afterDoubleTapWrongLandings: afterDoubleTap.wrongLandingCount,
    afterDoubleTapGaps: afterDoubleTap.intendedGapCount,
    afterEnterMemory: afterEnter.memory,
    afterDeleteMemory: afterDelete.memory,
    afterReleaseMemory: afterRelease.memory,
    errors: interactionErrors.length + blindErrors.length,
    failedRequests: interactionFailed.length + blindFailed.length
  },
  blind: blindEvidence
}, null, 2));
