import { mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const proofDir = resolve('research/qa/proofs/brush-v018-2026-09-24');
const baseUrl = 'http://127.0.0.1:4183';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/brush-2026-09-24/';
const rawPath = '/studies/p5-brush/v018/?preview=1&interaction=1';
const blindPath = '/studies/p5-brush/v018/?preview=1&static=1&blind=1';
const root = resolve('.');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function startStaticServer() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, baseUrl).pathname);
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const target = normalize(join(root, relative));
    if (!target.startsWith(root)) { response.writeHead(403); response.end('Forbidden'); return; }
    try {
      const stat = statSync(target);
      if (!stat.isFile()) throw new Error('not file');
      response.writeHead(200, { 'Content-Type': mimeTypes[extname(target)] ?? 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(4183, '127.0.0.1', resolveServer);
  });
  return server;
}

function diagnostics(page) {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push({ url: response.url(), status: response.status() }); });
  return output;
}

async function outerSnapshot(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    frame: (() => { const el = document.querySelector('iframe'); return el ? (() => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null; })(),
    heading: (() => { const el = document.querySelector('h1'); return el ? (() => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null; })(),
    mountReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
    title: document.title
  }));
}

async function frameEvidence(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#field');
    return {
      memory: Number(canvas?.dataset.memory ?? -1),
      apertures: Number(canvas?.dataset.apertures ?? -1),
      interaction: canvas?.dataset.interaction ?? null,
      fieldRect: (() => { const box = canvas?.getBoundingClientRect(); return box ? { width: box.width, height: box.height } : null; })(),
      signature: (() => { const value = canvas?.toDataURL('image/png') ?? ''; let hash = 2166136261; for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); return `${(hash >>> 0).toString(16)}:${value.length}`; })(),
      readout: document.querySelector('[data-memory]')?.textContent ?? null
    };
  });
}

async function openPage(browser, path, viewport, reduced, kind) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(180);
  const outer = await outerSnapshot(page);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v018/')) ?? page.mainFrame();
  const tableau = await frameEvidence(frame);
  await page.screenshot({ path: join(proofDir, `${kind}-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: false });
  await context.close();
  return { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, outer, tableau, diagnostics: diag };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(120);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v018/'));
  if (!frame) throw new Error('raw v018 frame missing');
  const initial = await frameEvidence(frame);
  const canvas = frame.locator('#field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('raw v018 canvas has no bounding box');
  await page.mouse.move(box.x + box.width * .31, box.y + box.height * .44);
  await page.mouse.move(-10, -10);
  const departed = await frameEvidence(frame);
  if (departed.memory !== 1 || departed.interaction !== 'visitor-departure-fold') throw new Error(`departure memory expected 1, got ${departed.memory}`);
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await frameEvidence(frame);
  await page.keyboard.press('Delete');
  const lifted = await frameEvidence(frame);
  const controls = await frame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
  await frame.locator('#release-control').click();
  const released = await frameEvidence(frame);
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: join(proofDir, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return {
    path: rawPath,
    httpStatus: response?.status() ?? null,
    initial,
    departed,
    keyboard,
    lifted,
    released,
    controls,
    outer,
    diagnostics: diag,
    exactLiftRestored: lifted.signature === departed.signature,
    releaseCleared: released.memory === 0,
    departureChangedImage: departed.signature !== initial.signature,
    keyboardChangedImage: keyboard.signature !== departed.signature
  };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(180);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v018/'));
  if (!frame) throw new Error('blind v018 frame missing');
  const evidence = await frame.evaluate(() => ({
    state: { memory: Number(document.querySelector('#field')?.dataset.memory ?? -1), apertures: Number(document.querySelector('#field')?.dataset.apertures ?? -1) },
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readout: getComputedStyle(document.querySelector('.field-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display,
    header: getComputedStyle(document.querySelector('.studio-header')).display,
    annotations: getComputedStyle(document.querySelector('.annotations')).display
  }));
  await page.screenshot({ path: join(proofDir, 'static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { path: blindPath, httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runJournal(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}/journal/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll('#journal-brush-2026-09-24').length,
    title: document.querySelector('#journal-brush-2026-09-24')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-brush-2026-09-24 a[href="/works/brush-2026-09-24/"]')?.getAttribute('href') ?? null
  }));
  await page.screenshot({ path: join(proofDir, 'journal-390x844.png'), fullPage: false });
  await context.close();
  return { path: '/journal/', httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runCurrent(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}/currents/brush/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    currentHeaders: document.querySelectorAll('[data-catalog-current-header="brush"]').length,
    firstArtwork: Boolean(document.querySelector('.catalog-card__art, iframe')),
    title: document.querySelector('[data-catalog-current-header="brush"] h1')?.textContent?.trim() ?? null
  }));
  await page.screenshot({ path: join(proofDir, 'current-brush-390x844.png'), fullPage: false });
  await context.close();
  return { path: '/currents/brush/', httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

await mkdir(proofDir, { recursive: true });
const server = await startStaticServer();
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
try {
  const matrix = [];
  for (const viewport of viewports) {
    matrix.push(await openPage(browser, canonicalPath, viewport, false, 'canonical'));
    matrix.push(await openPage(browser, canonicalPath, viewport, true, 'canonical'));
  }
  const rawMatrix = [];
  for (const viewport of viewports) {
    rawMatrix.push(await openPage(browser, rawPath, viewport, false, 'raw'));
    rawMatrix.push(await openPage(browser, rawPath, viewport, true, 'raw'));
  }
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runJournal(browser);
  const current = await runCurrent(browser);
  const result = { baseUrl, canonicalPath, rawPath, blindPath, viewports, matrix, rawMatrix, interaction, blind, journal, current };
  await writeFile(join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const allRuns = [...matrix, ...rawMatrix, interaction, blind, journal, current];
  console.log(JSON.stringify({
    matrixRuns: matrix.length,
    rawMatrixRuns: rawMatrix.length,
    interaction: { initial: interaction.initial, departed: interaction.departed, keyboard: interaction.keyboard, lifted: interaction.lifted, released: interaction.released, exactLiftRestored: interaction.exactLiftRestored, releaseCleared: interaction.releaseCleared, departureChangedImage: interaction.departureChangedImage, keyboardChangedImage: interaction.keyboardChangedImage },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    diagnostics: allRuns.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0)
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
