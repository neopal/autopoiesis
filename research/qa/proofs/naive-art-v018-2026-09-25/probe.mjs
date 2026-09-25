import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, normalize, resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v018-2026-09-25');
const port = 4185;
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
  raw: '/studies/naive-art/v018/?preview=1&interaction=1',
  canonical: '/works/naive-2026-09-25/'
};

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function probePage(browser, path, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const diagnostic = diagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV018) || Boolean(document.querySelector('[data-catalog-work-detail][data-ready="true"]')), null, { timeout: 10000 });
  await sleep(80);
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height, display: getComputedStyle(canvas).display } : null,
      iframe: iframe ? { top: iframe.getBoundingClientRect().top, height: iframe.getBoundingClientRect().height } : null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      mountReady: mount?.dataset.ready ?? null,
      controlsVisible: Boolean(document.querySelector('.field-controls') && getComputedStyle(document.querySelector('.field-controls')).display !== 'none'),
      canvasVisible: Boolean(canvas && getComputedStyle(canvas).display !== 'none'),
      state: window.__mutineNaiveV018?.getState?.() ?? null
    };
  });
  await page.screenshot({ path: join(proofDir, `${path.startsWith('/works') ? 'canonical' : 'raw'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { path, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diagnostic };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
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
  const interactionDiagnostics = diagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV018));
  const initial = await page.evaluate(() => window.__mutineNaiveV018.getState());
  const canvas = page.locator('#field');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * .48, box.y + box.height * .46);
  const shortClick = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await page.mouse.move(box.x + box.width * .20, box.y + box.height * .40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .78, box.y + box.height * .56, { steps: 4 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineNaiveV018.getState());
  const keyboardSignature = keyboard.foldSignature;
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineNaiveV018.getState());
  const restoredDragged = lifted.foldSignature === dragged.foldSignature;
  await page.locator('#release-control').click();
  const released = await page.evaluate(() => window.__mutineNaiveV018.getState());
  const interaction = { initial, shortClick, dragged, keyboard, lifted, restoredDragged, released, keyboardSignature, diagnostics: interactionDiagnostics };
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  const blindDiagnostics = diagnostics(blind);
  await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v018/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await blind.waitForFunction(() => Boolean(window.__mutineNaiveV018));
  const blindEvidence = await blind.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineNaiveV018.getState()
  }));
  await blind.screenshot({ path: join(proofDir, 'blind-390x844.png'), fullPage: true });
  await blind.close();

  await browser.close();
  server.close();
  const matrixFailures = results.filter((result) => {
    const width = Number(result.viewport.split('x')[0]);
    return result.evidence.innerWidth !== width || result.evidence.scrollWidth > result.evidence.innerWidth || Object.values(result.diagnostics).some((items) => items.length);
  });
  const summary = {
    matrixRuns: results.length,
    matrixFailures,
    interaction,
    blindEvidence,
    blindDiagnostics,
    sample: results.filter((result) => result.path === routes.raw && (result.viewport === '390x844' || result.viewport === '1920x1080')).map((result) => ({ viewport: result.viewport, reducedMotion: result.reducedMotion, evidence: result.evidence, diagnostics: result.diagnostics }))
  };
  await (await import('node:fs/promises')).writeFile(join(proofDir, 'results.json'), `${JSON.stringify({ results, ...summary }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  server.close();
  console.error(error.stack || error);
  process.exitCode = 1;
});
