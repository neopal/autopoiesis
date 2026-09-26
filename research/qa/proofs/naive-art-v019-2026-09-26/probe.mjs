import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4190;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v019-2026-09-26');
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
  raw: '/studies/naive-art/v019/?preview=1&interaction=1',
  canonical: '/works/naive-2026-09-26/'
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

async function waitForRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV019), null, { timeout: 15000 });
  await sleep(90);
}

async function waitForCanonical(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  await page.waitForSelector('.work-inspect__stage iframe', { timeout: 15000 });
  await sleep(180);
}

async function inspect(page, route, viewport, reducedMotion) {
  const diagnosticsState = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  if (route === routes.raw) await waitForRaw(page);
  else await waitForCanonical(page);
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
      title: heading?.textContent?.trim() ?? null
    };
  });
  await page.screenshot({ path: `${proofDir}/${route === routes.raw ? 'raw' : 'canonical'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`, fullPage: true });
  return { route: route === routes.raw ? 'raw' : 'canonical', viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diagnosticsState };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];

  for (const reducedMotion of [false, true]) {
    for (const route of Object.values(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        results.push(await inspect(page, route, viewport, reducedMotion));
        await page.close();
      }
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interactionDiagnostics = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForRaw(page);
  const canvas = page.locator('canvas');
  const initial = await page.evaluate(() => window.__mutineNaiveV019.getState());
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.34);
  const moved = await page.evaluate(() => window.__mutineNaiveV019.getState());
  await canvas.click({ position: { x: box.width * 0.72, y: box.height * 0.34 } });
  const clicked = await page.evaluate(() => window.__mutineNaiveV019.getState());
  await page.mouse.wheel(0, 120);
  await sleep(80);
  const wheel = await page.evaluate(() => window.__mutineNaiveV019.getState());
  await canvas.focus();
  await page.keyboard.press('ArrowDown');
  const keyboard = await page.evaluate(() => window.__mutineNaiveV019.getState());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineNaiveV019.getState());
  await page.keyboard.press('r');
  const released = await page.evaluate(() => window.__mutineNaiveV019.getState());
  const interaction = { initial, moved, clicked, wheel, keyboard, lifted, released, diagnostics: interactionDiagnostics };
  await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
  await page.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const blindDiagnostics = diagnostics(blind);
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v019/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForRaw(blind);
  const blindEvidence = await blind.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.mural-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.mural-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineNaiveV019.getState().memory
  }));
  await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: true });
  await blind.close();

  const journal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiagnostics = diagnostics(journal);
  await journal.goto(`http://127.0.0.1:${port}/journal/`, { waitUntil: 'networkidle' });
  await journal.waitForSelector('#journal-naive-2026-09-26', { timeout: 15000 });
  const journalEvidence = await journal.evaluate(() => ({
    count: document.querySelectorAll('#journal-naive-2026-09-26').length,
    title: document.querySelector('#journal-naive-2026-09-26 h3')?.textContent?.trim() ?? null,
    canonicalHref: document.querySelector('#journal-naive-2026-09-26 h3 a')?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await journal.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
  await journal.close();

  const current = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const currentDiagnostics = diagnostics(current);
  await current.goto(`http://127.0.0.1:${port}/currents/naive-art/`, { waitUntil: 'networkidle' });
  await current.waitForSelector('[data-catalog-current-header][data-ready="true"]', { timeout: 15000 });
  await current.waitForSelector('.catalog-card--work', { timeout: 15000 });
  const currentEvidence = await current.evaluate(() => ({
    header: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null,
    firstWork: document.querySelector('.catalog-card--work h3')?.textContent?.trim() ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await current.screenshot({ path: `${proofDir}/current-390x844.png`, fullPage: true });
  await current.close();

  await browser.close();
  server.close();

  const allDiagnostics = [
    ...results.flatMap((entry) => Object.values(entry.diagnostics)),
    ...Object.values(interactionDiagnostics),
    ...Object.values(blindDiagnostics),
    ...Object.values(journalDiagnostics),
    ...Object.values(currentDiagnostics)
  ];
  const overflowFailures = results.filter((entry) => entry.evidence.innerWidth !== Number(entry.viewport.split('x')[0]) || entry.evidence.scrollWidth > entry.evidence.innerWidth);
  const diagnosticsCount = allDiagnostics.reduce((sum, items) => sum + items.length, 0);
  const summary = {
    matrixRuns: results.length,
    matrixFailures: results.filter((entry) => entry.evidence.innerWidth !== Number(entry.viewport.split('x')[0]) || entry.evidence.scrollWidth > entry.evidence.innerWidth || Object.values(entry.diagnostics).some((items) => items.length)),
    diagnosticsCount,
    overflowCount: overflowFailures.length,
    interaction,
    blindEvidence,
    journalEvidence,
    currentEvidence,
    sample: results.filter((entry) => entry.route === 'raw' && (entry.viewport === '390x844' || entry.viewport === '1920x1080')).map((entry) => ({ viewport: entry.viewport, reducedMotion: entry.reducedMotion, evidence: entry.evidence, diagnostics: entry.diagnostics }))
  };
  await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
  await writeFile(`${proofDir}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  server.close();
  console.error(error.stack || error);
  process.exitCode = 1;
});
