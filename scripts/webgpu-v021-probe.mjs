import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4214;
const proofDir = resolve(ROOT, 'research/qa/proofs/webgpu-v021-2026-10-03');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/webgpu/v021/?preview=1&interaction=1',
  canonical: '/works/webgpu-2026-10-03/'
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
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebgpuV021));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/webgpu/v021/'));
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
      firstCanvas: rect('#field'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.chorus-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      rawState: window.__mutineWebgpuV021?.getState?.() ?? null,
      pageTitle: document.title
    };
  });
  if (label === 'canonical') {
    const frame = await canonicalFrame(page);
    measurements.embedded = await frame.evaluate(() => {
      const canvas = document.querySelector('#field');
      const box = canvas?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fieldVisible: Boolean(canvas && getComputedStyle(canvas).display !== 'none'),
        fieldRect: box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null,
        state: window.__mutineWebgpuV021?.getState?.() ?? null,
        controls: [...document.querySelectorAll('.chorus-controls button')].map((node) => {
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
      const consoleMessages = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
      page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
      const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(reduced ? 120 : 180);
      const entry = await inspect(page, label, viewport, reduced, route);
      entry.httpStatus = response?.status() ?? null;
      entry.pageErrors = errors;
      entry.failedRequests = failed;
      entry.consoleMessages = consoleMessages;
      results.push(entry);
      await context.close();
    }
  }
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const interactionErrors = [];
const interactionFailed = [];
const interactionConsole = [];
page.on('pageerror', (error) => interactionErrors.push(String(error)));
page.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
page.on('console', (message) => interactionConsole.push(`${message.type()}: ${message.text()}`));
await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(160);
const initial = await page.evaluate(() => window.__mutineWebgpuV021.getState());
const canvasBox = await page.locator('#field').boundingBox();
await page.mouse.move(canvasBox.x + canvasBox.width * .54, canvasBox.y + canvasBox.height * .46);
await page.mouse.click(canvasBox.x + canvasBox.width * .54, canvasBox.y + canvasBox.height * .46);
const afterTap = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.locator('#field').focus();
await page.keyboard.press('3');
const afterTune = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.getByRole('button', { name: 'send the call' }).click();
const afterButton = await page.evaluate(() => window.__mutineWebgpuV021.getState());
await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
const blindConsole = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
blind.on('console', (message) => blindConsole.push(`${message.type()}: ${message.text()}`));
const blindResponse = await blind.goto(`http://127.0.0.1:${port}/studies/webgpu/v021/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForTimeout(130);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.chorus-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.chorus-controls')).display !== 'none',
  state: window.__mutineWebgpuV021.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

const interaction = { initial, afterTap, afterTune, afterEnter, afterDelete, afterRelease, afterButton, pageErrors: interactionErrors, failedRequests: interactionFailed, consoleMessages: interactionConsole };
assert.equal(afterTap.memory, initial.memory, 'a pointer tap must be refused');
assert.notEqual(afterTune.carrier, initial.carrier, 'carrier tuning must be causal only after a later call');
assert.equal(afterTune.memory, initial.memory, 'carrier tuning must not write history');
assert.equal(afterEnter.memory, afterTune.memory + 1, 'Enter must commit one chorus call');
assert.ok(afterEnter.replies > 0, 'a call must create reciprocal replies');
assert.ok(afterEnter.vacancies > 0, 'a call must create withheld vacancies');
assert.equal(afterDelete.memory, afterEnter.memory - 1, 'Delete must lift only the latest call');
assert.equal(afterRelease.memory, 0, 'R must release the lattice');
assert.equal(afterButton.memory, 1, 'the call control must commit the same structural event');
assert.equal(blindEvidence.fieldVisible, true);
assert.equal(blindEvidence.readoutVisible, false);
assert.equal(blindEvidence.controlsVisible, false);

const output = {
  status: 'local-headless-browser-probe',
  root: `http://127.0.0.1:${port}`,
  routes,
  viewportRuns: results,
  interaction,
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed, consoleMessages: blindConsole },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth || entry.measurements.embedded?.scrollWidth > entry.measurements.embedded?.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length || entry.consoleMessages.some((message) => /^error:/i.test(message))).length
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
    afterTuneCarrier: afterTune.carrier,
    afterEnterMemory: afterEnter.memory,
    afterEnterReplies: afterEnter.replies,
    afterEnterVacancies: afterEnter.vacancies,
    afterDeleteMemory: afterDelete.memory,
    afterReleaseMemory: afterRelease.memory,
    afterButtonMemory: afterButton.memory,
    errors: interactionErrors.length + blindErrors.length,
    failedRequests: interactionFailed.length + blindFailed.length
  },
  blind: blindEvidence
}, null, 2));
