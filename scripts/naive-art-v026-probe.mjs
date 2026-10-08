import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4254;
const proofDir = resolve(ROOT, 'research/qa/proofs/naive-art-v026-2026-10-08');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v026/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-08/'
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
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500); response.end('server error');
  }
});
await new Promise((resolveServer) => server.listen(port, '127.0.0.1', resolveServer));

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function embeddedFrame(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV026));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v026/'));
}

async function measurements(page, label) {
  const read = () => {
    const documentNode = document;
    const rect = (selector) => {
      const node = documentNode.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: documentNode.documentElement.clientWidth,
      scrollWidth: documentNode.documentElement.scrollWidth,
      field: rect('#miscount-field'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...documentNode.querySelectorAll('.miscount-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      state: window.__mutineNaiveV026?.getState?.() ?? null,
      wideNodes: [...documentNode.querySelectorAll('*')].map((node) => {
        const box = node.getBoundingClientRect();
        return { selector: node.tagName.toLowerCase(), left: box.left, right: box.right, width: box.width, scrollWidth: node.scrollWidth };
      }).filter((node) => node.left < -0.5 || node.right > window.innerWidth + 0.5).slice(0, 20)
    };
  };
  const main = await page.evaluate(read);
  if (label !== 'canonical') return { main };
  const frame = await embeddedFrame(page);
  const embedded = await frame.evaluate(read);
  return { main, embedded };
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
      await page.waitForFunction(() => window.__mutineNaiveV026 || [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV026));
      await page.waitForTimeout(60);
      const measured = await measurements(page, label);
      const file = `${proofDir}/${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`;
      await page.screenshot({ path: file, fullPage: false });
      results.push({ label, viewport, reduced, route, httpStatus: response?.status() ?? null, measured, pageErrors: errors, failedRequests: failed, consoleMessages, screenshot: file });
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
await page.waitForFunction(() => window.__mutineNaiveV026);
const initial = await page.evaluate(() => window.__mutineNaiveV026.getState());
await page.locator('[data-witness-index="3"]').focus();
const afterFocus = await page.evaluate(() => window.__mutineNaiveV026.getState());
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV026.getState());
const enterSignature = afterEnter.geometrySignature;
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV026.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV026.getState());
await page.getByRole('button', { name: 'miscount focused witness' }).click();
const afterButton = await page.evaluate(() => window.__mutineNaiveV026.getState());
await page.getByRole('button', { name: 'lift latest' }).click();
const afterLift = await page.evaluate(() => window.__mutineNaiveV026.getState());
const touchTargets = await page.evaluate(() => [...document.querySelectorAll('.miscount-controls button')].map((node) => {
  const box = node.getBoundingClientRect();
  return { width: box.width, height: box.height };
}));
await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
const blindConsole = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
blind.on('console', (message) => blindConsole.push(`${message.type()}: ${message.text()}`));
const blindResponse = await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v026/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForFunction(() => window.__mutineNaiveV026);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#miscount-field')).display !== 'none',
  witnessCount: document.querySelectorAll('[data-witness-index]').length,
  readoutVisible: getComputedStyle(document.querySelector('.miscount-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.miscount-controls')).display !== 'none',
  state: window.__mutineNaiveV026.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

assert.equal(afterFocus.memory.length, initial.memory.length, 'focus must not write memory');
assert.equal(afterFocus.interaction, 'witness-selected');
assert.equal(afterEnter.memory.length, initial.memory.length + 1, 'Enter must commit a miscount');
assert.equal(afterEnter.scene.trace.changedWitnessCount, 3);
assert.equal(afterDelete.memory.length, 0, 'Delete must lift the latest event');
assert.equal(afterDelete.geometrySignature, initial.geometrySignature, 'Delete must restore the exact baseline field');
assert.equal(afterRelease.memory.length, 0, 'R must release the count');
assert.equal(afterButton.memory.length, 1, 'the commit button must be causal');
assert.equal(afterLift.memory.length, 0, 'the lift button must restore the baseline');
assert.equal(afterButton.geometrySignature, enterSignature, 'the button must share the deterministic commit geometry');
assert.ok(touchTargets.every((target) => target.height >= 44));
assert.equal(blindEvidence.fieldVisible, true);
assert.equal(blindEvidence.witnessCount, 9);
assert.equal(blindEvidence.readoutVisible, false);
assert.equal(blindEvidence.controlsVisible, false);
assert.equal(results.flatMap((entry) => entry.pageErrors).length, 0);
assert.equal(results.flatMap((entry) => entry.failedRequests).length, 0);
assert.equal(results.flatMap((entry) => entry.consoleMessages).length, 0);
assert.equal(interactionErrors.length + interactionConsole.length + blindErrors.length + blindConsole.length, 0);

const output = {
  status: 'local-headless-browser-probe',
  root: `http://127.0.0.1:${port}`,
  routes,
  viewportRuns: results,
  interaction: { initial, afterFocus, afterEnter, afterDelete, afterRelease, afterButton, afterLift, touchTargets, pageErrors: interactionErrors, failedRequests: interactionFailed, consoleMessages: interactionConsole },
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed, consoleMessages: blindConsole },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measured.main.scrollWidth > entry.measured.main.innerWidth || entry.measured.embedded?.scrollWidth > entry.measured.embedded?.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length || entry.consoleMessages.length).length
  }
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(output, null, 2));
await blindContext.close();
await context.close();
await browser.close();
server.close();
console.log(JSON.stringify(output.counts));
