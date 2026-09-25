import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4181;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) {
      response.writeHead(403); response.end('forbidden'); return;
    }
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v016/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-09-25/'
};

async function probePage(browser, path, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV016) || Boolean(document.querySelector('[data-catalog-work-detail][data-ready="true"]')), null, { timeout: 10000 });
  await sleep(60);
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const firstHeading = document.querySelector('h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height, display: getComputedStyle(canvas).display } : null,
      iframe: iframe ? { top: iframe.getBoundingClientRect().top, height: iframe.getBoundingClientRect().height } : null,
      headingTop: firstHeading?.getBoundingClientRect().top ?? null,
      mountReady: mount?.dataset.ready ?? null,
      controlsVisible: Boolean(document.querySelector('.field-controls') && getComputedStyle(document.querySelector('.field-controls')).display !== 'none'),
      readoutVisible: Boolean(document.querySelector('.surface-readout') && getComputedStyle(document.querySelector('.surface-readout')).display !== 'none')
    };
  });
  await page.close();
  return { path, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses } };
}

async function main() {
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const route of Object.values(routes)) {
      for (const viewport of viewports) results.push(await probePage(browser, route, viewport, reducedMotion));
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV016));
  const initial = await page.evaluate(() => window.__mutinePortraitV016.getState());
  const canvas = page.locator('#field');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .34);
  const armed = await page.evaluate(() => window.__mutinePortraitV016.getState());
  await canvas.click({ position: { x: box.width * .72, y: box.height * .34 } });
  const pointer = await page.evaluate(() => window.__mutinePortraitV016.getState());
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutinePortraitV016.getState());
  const keyboardSignature = keyboard.signature;
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutinePortraitV016.getState());
  await page.keyboard.press('r');
  const released = await page.evaluate(() => window.__mutinePortraitV016.getState());
  const interaction = { initial, armed, pointer, keyboard, lifted, released, keyboardSignature, diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses } };
  await page.screenshot({ path: 'C:/Users/ASUS/AppData/Local/hermes/profiles/autopoiesis/cache/scratch/portrait-v016-interaction.png', fullPage: true });
  await page.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`http://127.0.0.1:${port}/studies/self-portrait/v016/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await blind.waitForFunction(() => Boolean(window.__mutinePortraitV016));
  const blindEvidence = await blind.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.surface-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await blind.screenshot({ path: 'C:/Users/ASUS/AppData/Local/hermes/profiles/autopoiesis/cache/scratch/portrait-v016-blind.png', fullPage: true });
  await blind.close();

  await browser.close();
  server.close();
  const summary = {
    matrixRuns: results.length,
    matrixFailures: results.filter((result) => result.evidence.innerWidth !== Number(result.viewport.split('x')[0]) || result.evidence.scrollWidth > result.evidence.innerWidth || result.diagnostics.consoleMessages.length || result.diagnostics.pageErrors.length || result.diagnostics.failedRequests.length || result.diagnostics.badResponses.length),
    interaction,
    blindEvidence,
    sample: results.filter((result) => result.path === routes.raw && (result.viewport === '390x844' || result.viewport === '1920x1080')).map((result) => ({ viewport: result.viewport, reducedMotion: result.reducedMotion, evidence: result.evidence, diagnostics: result.diagnostics }))
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  server.close();
  console.error(error.stack || error);
  process.exitCode = 1;
});
