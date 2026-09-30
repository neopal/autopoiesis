import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4195;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v021-2026-09-30');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
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
  raw: '/studies/naive-art/v021/?preview=1&interaction=1',
  canonical: '/works/naive-2026-09-30/'
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
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV021), null, { timeout: 15000 });
  await page.waitForSelector('#map-field', { timeout: 15000 });
  await sleep(80);
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
    const svg = document.querySelector('#map-field');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svg: svg ? { width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, display: getComputedStyle(svg).display } : null,
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

  const interaction = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interactionDiagnostics = diagnostics(interaction);
  await interaction.emulateMedia({ reducedMotion: 'no-preference' });
  await interaction.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForRaw(interaction);
  const initial = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  const svg = interaction.locator('#map-field');
  const box = await svg.boundingBox();
  await interaction.mouse.move(box.x + box.width * 0.50, box.y + box.height * 0.24);
  const moved = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  const touchTargets = await interaction.evaluate(() => [...document.querySelectorAll('.map-controls button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  await interaction.mouse.click(box.x + box.width * 0.50, box.y + box.height * 0.24);
  const clicked = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await svg.focus();
  await interaction.keyboard.press('Enter');
  const keyboard = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.keyboard.press('Delete');
  const lifted = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.keyboard.press('r');
  const released = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
  await interaction.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const blindDiagnostics = diagnostics(blind);
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v021/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForRaw(blind);
  const blindEvidence = await blind.evaluate(() => ({
    svgVisible: getComputedStyle(document.querySelector('#map-field')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.map-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.map-controls')).display,
    annotationsDisplay: getComputedStyle(document.querySelector('.map-annotations')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineNaiveV021.getState().memory,
    openings: window.__mutineNaiveV021.getState().openings,
    closures: window.__mutineNaiveV021.getState().closures
  }));
  await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: true });
  await blind.close();

  const journal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiagnostics = diagnostics(journal);
  await journal.goto(`http://127.0.0.1:${port}/journal/`, { waitUntil: 'networkidle' });
  await journal.waitForSelector('#journal-naive-2026-09-30', { timeout: 15000 });
  const journalEvidence = await journal.evaluate(() => ({
    count: document.querySelectorAll('#journal-naive-2026-09-30').length,
    title: document.querySelector('#journal-naive-2026-09-30 h3')?.textContent?.trim() ?? null,
    canonicalHref: document.querySelector('#journal-naive-2026-09-30 h3 a')?.getAttribute('href') ?? null,
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
  const diagnosticCount = allDiagnostics.reduce((sum, items) => sum + items.length, 0);
  const summary = {
    matrixRuns: results.length,
    matrixFailures: results.filter((entry) => entry.evidence.innerWidth !== Number(entry.viewport.split('x')[0]) || entry.evidence.scrollWidth > entry.evidence.innerWidth || Object.values(entry.diagnostics).some((items) => items.length)),
    diagnosticCount,
    overflowCount: overflowFailures.length,
    interaction: { initial, moved, clicked, keyboard, lifted, released, touchTargets, diagnostics: interactionDiagnostics },
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
