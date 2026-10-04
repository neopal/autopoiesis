import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4224;
const proofDir = resolve(ROOT, 'research/qa/proofs/naive-art-v024-2026-10-04');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v024/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-04/'
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

async function getFrame(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV024));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v024/'));
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
      field: rect('#naive-theatre'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.theatre-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      state: window.__mutineNaiveV024?.getState?.() ?? null,
      pageTitle: document.title,
      wideNodes: [...document.querySelectorAll('*')].map((node) => {
        const box = node.getBoundingClientRect();
        return { selector: node.tagName.toLowerCase() + (node.className && typeof node.className === 'string' ? `.${node.className.split(' ').join('.')}` : ''), left: box.left, right: box.right, width: box.width, scrollWidth: node.scrollWidth, marginLeft: getComputedStyle(node).marginLeft, marginRight: getComputedStyle(node).marginRight, transform: getComputedStyle(node).transform };
      }).filter((node) => node.left < -0.5 || node.right > window.innerWidth + 0.5).slice(0, 20)
    };
  });
  if (label === 'canonical') {
    const frame = await getFrame(page);
    measurements.embedded = await frame.evaluate(() => {
      const theatre = document.querySelector('#naive-theatre');
      const box = theatre?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fieldVisible: Boolean(theatre && getComputedStyle(theatre).display !== 'none'),
        fieldRect: box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null,
        state: window.__mutineNaiveV024?.getState?.() ?? null,
        controls: [...document.querySelectorAll('.theatre-controls button')].map((node) => {
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
      await page.waitForFunction(() => window.__mutineNaiveV024 || [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV024));
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
await page.waitForFunction(() => window.__mutineNaiveV024);
await page.waitForTimeout(120);
const initial = await page.evaluate(() => window.__mutineNaiveV024.getState());
const theatreBox = await page.locator('#naive-theatre').boundingBox();
await page.mouse.click(theatreBox.x + theatreBox.width * .50, theatreBox.y + theatreBox.height * .50);
const afterTap = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.mouse.move(theatreBox.x + theatreBox.width * .62, theatreBox.y + theatreBox.height * .32);
const afterApproach = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.mouse.move(theatreBox.x + theatreBox.width + 12, theatreBox.y + theatreBox.height * .32);
await page.waitForTimeout(80);
const afterDeparture = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.locator('#naive-theatre').focus();
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV024.getState());
const enterSignature = afterEnter.geometrySignature;
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.getByRole('button', { name: 'misread a shadow' }).click();
const afterButton = await page.evaluate(() => window.__mutineNaiveV024.getState());
await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
const blindConsole = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
blind.on('console', (message) => blindConsole.push(`${message.type()}: ${message.text()}`));
const blindResponse = await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v024/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForFunction(() => window.__mutineNaiveV024);
await blind.waitForTimeout(160);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#naive-theatre')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.theatre-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.theatre-controls')).display !== 'none',
  canvasVisible: Boolean(document.querySelector('#naive-stage')),
  state: window.__mutineNaiveV024.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

const interaction = { initial, afterTap, afterApproach, afterDeparture: afterDeparture, afterEnter, afterDelete, afterRelease, afterButton, pageErrors: interactionErrors, failedRequests: interactionFailed, consoleMessages: interactionConsole };
assert.equal(afterTap.memory, initial.memory, 'a short pointer tap must be refused');
assert.equal(afterApproach.memory, initial.memory, 'proximity must arm without writing');
assert.equal(afterDeparture.memory, initial.memory + 1, 'departure after approach must commit one misread');
assert.equal(afterDeparture.shadowMisreadCount, 1, 'departure must change one shadow relation');
assert.equal(afterEnter.memory, afterDeparture.memory + 1, 'Enter must be an equivalent commit path');
assert.equal(afterDelete.memory, afterEnter.memory - 1, 'Delete must lift only the latest misread');
assert.equal(afterRelease.memory, 0, 'R must release the theatre');
assert.equal(afterButton.memory, 1, 'the misread control must commit the same structural event');
assert.notEqual(enterSignature, afterDeparture.geometrySignature, 'a second event must change geometry');
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
await new Promise((resolveServer) => server.close(resolveServer));
process.stdout.write(JSON.stringify({
  status: output.status,
  counts: output.counts,
  interaction: {
    initialMemory: initial.memory,
    afterTapMemory: afterTap.memory,
    afterApproachMemory: afterApproach.memory,
    afterDepartureMemory: afterDeparture.memory,
    afterDepartureShadowMisreads: afterDeparture.shadowMisreadCount,
    afterEnterMemory: afterEnter.memory,
    afterDeleteMemory: afterDelete.memory,
    afterReleaseMemory: afterRelease.memory,
    afterButtonMemory: afterButton.memory,
    errors: interactionErrors.length + blindErrors.length + interactionConsole.length + blindConsole.length,
    failedRequests: interactionFailed.length + blindFailed.length
  },
  blind: blindEvidence
}, null, 2));
