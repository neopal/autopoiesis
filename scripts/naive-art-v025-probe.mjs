import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4237;
const proofDir = resolve(ROOT, 'research/qa/proofs/naive-art-v025-2026-10-07');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v025/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-07/'
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

async function embeddedFrame(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV025));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v025/'));
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
      field: rect('#pressure-sheet'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.pressure-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      state: window.__mutineNaiveV025?.getState?.() ?? null,
      pageTitle: document.title,
      wideNodes: [...document.querySelectorAll('*')].map((node) => {
        const box = node.getBoundingClientRect();
        return { selector: node.tagName.toLowerCase() + (node.className && typeof node.className === 'string' ? `.${node.className.split(' ').join('.')}` : ''), left: box.left, right: box.right, width: box.width, scrollWidth: node.scrollWidth, transform: getComputedStyle(node).transform };
      }).filter((node) => node.left < -0.5 || node.right > window.innerWidth + 0.5).slice(0, 20)
    };
  });
  if (label === 'canonical') {
    const frame = await embeddedFrame(page);
    measurements.embedded = await frame.evaluate(() => {
      const field = document.querySelector('#pressure-sheet');
      const box = field?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fieldVisible: Boolean(field && getComputedStyle(field).display !== 'none'),
        fieldRect: box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null,
        state: window.__mutineNaiveV025?.getState?.() ?? null,
        controls: [...document.querySelectorAll('.pressure-controls button')].map((node) => {
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
      await page.waitForFunction(() => window.__mutineNaiveV025 || [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV025));
      await page.waitForTimeout(reduced ? 160 : 120);
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
await page.waitForFunction(() => window.__mutineNaiveV025);
await page.waitForTimeout(120);
const initial = await page.evaluate(() => window.__mutineNaiveV025.getState());
const fieldBox = await page.locator('#pressure-sheet').boundingBox();
await page.mouse.click(fieldBox.x + fieldBox.width * .5, fieldBox.y + fieldBox.height * .5);
const afterTap = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.mouse.move(fieldBox.x + fieldBox.width * .72, fieldBox.y + fieldBox.height * .36);
await page.mouse.down();
await page.waitForTimeout(190);
await page.mouse.up();
const afterPress = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.locator('#pressure-sheet').focus();
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV025.getState());
const enterSignature = afterEnter.geometrySignature;
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.getByRole('button', { name: 'press the sheet' }).click();
const afterButton = await page.evaluate(() => window.__mutineNaiveV025.getState());
const touchTargets = await page.evaluate(() => [...document.querySelectorAll('.pressure-controls button')].map((node) => {
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
const blindResponse = await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v025/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForFunction(() => window.__mutineNaiveV025);
await blind.waitForTimeout(160);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#pressure-sheet')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.pressure-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.pressure-controls')).display !== 'none',
  canvasVisible: Boolean(document.querySelector('#naive-sheet-stage')),
  state: window.__mutineNaiveV025.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

const interaction = { initial, afterTap, afterPress, afterEnter, afterDelete, afterRelease, afterButton, touchTargets, pageErrors: interactionErrors, failedRequests: interactionFailed, consoleMessages: interactionConsole };
assert.equal(afterTap.memory, initial.memory, 'a short pointer tap must be refused');
assert.equal(afterTap.interaction, 'short-press-refused');
assert.equal(afterPress.memory, initial.memory + 1, 'a sustained pressure must commit one global cut');
assert.ok(afterPress.changedPieceCount > initial.changedPieceCount);
assert.equal(afterEnter.memory, afterPress.memory + 1, 'Enter must be an equivalent commit path');
assert.equal(afterDelete.memory, afterEnter.memory - 1, 'Delete must lift only the latest cut');
assert.equal(afterDelete.geometrySignature, afterPress.geometrySignature, 'Delete must restore the preceding sheet exactly');
assert.equal(afterRelease.memory, 0, 'R must release the sheet');
assert.equal(afterButton.memory, 1, 'the press control must commit a deterministic cut');
assert.notEqual(enterSignature, afterPress.geometrySignature, 'a second pressure must change geometry');
assert.ok(touchTargets.every((target) => target.height >= 44));
assert.equal(blindEvidence.fieldVisible, true);
assert.equal(blindEvidence.canvasVisible, true);
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
  interaction,
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed, consoleMessages: blindConsole },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth || entry.measurements.embedded?.scrollWidth > entry.measurements.embedded?.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length || entry.consoleMessages.length).length
  }
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(output, null, 2));
await blindContext.close();
await context.close();
await browser.close();
server.close();
console.log(JSON.stringify(output.counts));
