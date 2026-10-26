import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:4290';
const output = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/naive-art-v036-2026-10-26';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v036/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v036/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-10-26/';

function insideRoot(file) {
  const relative = path.relative(root, file);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function serveFile(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const requested = path.resolve(root, `.${pathname}`);
  const file = pathname.endsWith('/') ? path.join(requested, 'index.html') : requested;
  if (!insideRoot(file)) {
    response.writeHead(403); response.end('forbidden'); return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain' };
    response.writeHead(200, { 'content-type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('not found');
  }
}

const isLocal = base.startsWith('http://127.0.0.1:');
const server = isLocal ? createServer((request, response) => { void serveFile(request, response); }) : null;
if (server) await new Promise((resolve) => server.listen(new URL(base).port, '127.0.0.1', resolve));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-dev-shm-usage']
});
const diagnostics = [];

function attachDiagnostics(page, label) {
  const local = [];
  page.on('console', (message) => local.push({ label, kind: 'console', type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => local.push({ label, kind: 'pageerror', error: String(error) }));
  page.on('requestfailed', (request) => local.push({ label, kind: 'requestfailed', url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) local.push({ label, kind: 'http', url: response.url(), status: response.status() }); });
  return local;
}

async function resolveArtwork(page, canonical) {
  if (!canonical) return page;
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ timeout: 20000 });
  const frame = await iframe.elementHandle();
  const content = await frame.contentFrame();
  await content.locator('#fold-field').waitFor({ timeout: 20000 });
  return content;
}

async function probeRoute(route, width, height, reduced, label) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const local = attachDiagnostics(page, label);
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  const artwork = await resolveArtwork(page, route === canonicalPath);
  const measurements = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeCount: document.querySelectorAll('iframe').length,
    title: document.title
  }));
  const artworkMeasurements = await artwork.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    foldCount: document.querySelectorAll('.fold').length,
    canvasCount: document.querySelectorAll('canvas').length,
    svgCount: document.querySelectorAll('svg').length,
    memory: window.__mutineNaiveV036?.getState().memory.length ?? null,
    ready: Boolean(window.__mutineNaiveV036)
  }));
  await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: false });
  diagnostics.push(...local);
  const result = { label, route, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, diagnostics: local };
  await context.close();
  return result;
}

const matrix = [];
for (const reduced of [false, true]) {
  for (const [width, height] of viewports) {
    const suffix = `${width}x${height}-${reduced ? 'reduced' : 'normal'}`;
    matrix.push(await probeRoute(rawPath, width, height, reduced, `raw-${suffix}`));
    matrix.push(await probeRoute(canonicalPath, width, height, reduced, `canonical-${suffix}`));
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const interactionPage = await interactionContext.newPage();
const interactionDiagnostics = attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
const field = interactionPage.locator('#fold-field');
await field.waitFor();
const initial = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV036.geometrySignature(window.__mutineNaiveV036.getState()),
  memory: window.__mutineNaiveV036.getState().memory.length,
  folds: document.querySelectorAll('.fold').length,
  buttonHeights: [...document.querySelectorAll('.fold-controls button')].map((button) => Math.round(button.getBoundingClientRect().height))
}));
const box = await field.boundingBox();
await interactionPage.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
await interactionPage.mouse.wheel(0, 20);
const afterShallowWheel = await interactionPage.evaluate(() => ({ signature: window.__mutineNaiveV036.geometrySignature(window.__mutineNaiveV036.getState()), memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await interactionPage.mouse.wheel(0, 300);
const afterWheel = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV036.geometrySignature(window.__mutineNaiveV036.getState()),
  memory: window.__mutineNaiveV036.getState().memory.length,
  interaction: window.__mutineNaiveV036.getState().interaction,
  event: window.__mutineNaiveV036.getState().memory.at(-1),
  roles: window.__mutineNaiveV036.getState().scene.folds.filter((fold) => fold.role !== 'quiet').map((fold) => ({ id: fold.id, role: fold.role }))
}));
await field.focus();
await interactionPage.keyboard.press('Delete');
const afterLift = await interactionPage.evaluate(() => ({ signature: window.__mutineNaiveV036.geometrySignature(window.__mutineNaiveV036.getState()), memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await interactionPage.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45);
await interactionPage.mouse.down();
await interactionPage.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.75, { steps: 3 });
await interactionPage.mouse.up();
const afterSwipe = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await field.focus();
await interactionPage.keyboard.press('Delete');
await interactionPage.keyboard.press('ArrowRight');
const afterArrow = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await interactionPage.locator('[data-action="turn"]').click();
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV036.getState().memory.length, interaction: window.__mutineNaiveV036.getState().interaction }));
await interactionPage.keyboard.press('Escape');
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/naive-2026-10-26/', '/journal/', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await fetch(route);
    const text = await response.text();
    result[route] = { status: response.status, hasWork: text.includes('naive-2026-10-26'), hasJournal: text.includes('journal-naive-2026-10-26'), hasTitle: text.includes('The page reads the wrong fold.') };
  }
  return result;
});
const interaction = {
  initial,
  afterShallowWheel,
  afterWheel,
  afterLift,
  afterSwipe,
  afterArrow,
  afterRelease,
  afterControl,
  touchTargets: initial.buttonHeights,
  baselineRestored: afterLift.signature === initial.signature,
  shallowRefused: afterShallowWheel.signature === initial.signature && afterShallowWheel.memory === 0,
  wheelCommitted: afterWheel.memory === 1 && afterWheel.signature !== initial.signature,
  swipeCommitted: afterSwipe.memory === 1,
  arrowCommitted: afterArrow.memory === 1,
  controlCommitted: afterControl.memory === 1,
  readback: localReadback,
  diagnostics: interactionDiagnostics
};
diagnostics.push(...interactionDiagnostics);
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage, 'blind');
const blindResponse = await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle', timeout: 30000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const frame = window.__mutineNaiveV036.getState();
  return {
    status: document.readyState,
    memory: frame.memory.length,
    foldCount: document.querySelectorAll('.fold').length,
    roles: frame.scene.folds.filter((fold) => fold.role !== 'quiet').map((fold) => fold.role),
    readoutHidden: hidden('.fold-readout'),
    controlsHidden: hidden('.fold-controls'),
    hintHidden: hidden('.fold-hint'),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindPage.screenshot({ path: path.join(output, 'blind-390x844-reduced.png'), fullPage: false });
diagnostics.push(...blindDiagnostics);
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalPage.locator('#journal-naive-2026-10-26').count() === 1, hasTitle: journalText.includes('The page reads the wrong fold.') };
diagnostics.push(...journalDiagnostics);
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'naive-2026-10-26',
  rawPath,
  canonicalPath,
  blindPath,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interaction,
  blind: { ...blind, statusCode: blindResponse?.status() ?? null },
  journal,
  diagnostics,
  pass: matrix.length === 20
    && matrix.every((entry) => entry.status === 200 && entry.measurements.innerWidth === entry.width && entry.measurements.clientWidth === entry.width && entry.measurements.scrollWidth <= entry.width)
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.foldCount === 11 && entry.artworkMeasurements.canvasCount === 0 && entry.artworkMeasurements.svgCount === 0)
    && interaction.shallowRefused
    && interaction.wheelCommitted
    && interaction.baselineRestored
    && interaction.swipeCommitted
    && interaction.arrowCommitted
    && interaction.controlCommitted
    && interaction.touchTargets.every((height) => height >= 44)
    && Object.values(localReadback).every((entry) => entry.status === 200)
    && localReadback['/studio/data/works.json'].hasWork
    && localReadback['/studio/data/catalog-public.json'].hasWork
    && localReadback['/works/naive-2026-10-26/'].hasTitle
    && blindResponse?.status() === 200
    && blind.memory === 4
    && blind.foldCount === 11
    && blind.roles.length >= 3
    && blind.readoutHidden && blind.controlsHidden && blind.hintHidden
    && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
    && journal.status === 200 && journal.hasAnchor && journal.hasTitle
    && diagnostics.length === 0
};
await writeFile(path.join(output, 'qa-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await browser.close();
if (server) await new Promise((resolve) => server.close(resolve));
process.stdout.write(`${JSON.stringify({ pass: summary.pass, matrix: matrix.length, diagnostics: diagnostics.length, interaction: { shallowRefused: interaction.shallowRefused, wheelCommitted: interaction.wheelCommitted, baselineRestored: interaction.baselineRestored, swipeCommitted: interaction.swipeCommitted, arrowCommitted: interaction.arrowCommitted, controlCommitted: interaction.controlCommitted, touchTargets: interaction.touchTargets }, blind, journal, readback: localReadback }, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
