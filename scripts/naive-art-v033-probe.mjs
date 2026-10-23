import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const proofDir = path.join(root, 'research', 'qa', 'proofs', process.env.MUTINE_BASE_URL ? 'naive-v033-2026-10-23-production' : 'naive-v033-2026-10-23');
const port = 57137;
const base = process.env.MUTINE_BASE_URL || `http://127.0.0.1:${port}`;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = {
  raw: '/studies/naive-art/v033/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-23/'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let requested = decoded === '/' ? '/index.html' : decoded;
  if (requested.endsWith('/')) requested += 'index.html';
  const resolved = path.resolve(root, `.${requested}`);
  return resolved.startsWith(root) ? resolved : null;
}

function startServer() {
  const server = http.createServer((request, response) => {
    const filePath = safePath(request.url || '/');
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
    response.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function diagnosticsPage(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function probe(page, name, route, viewport, reducedMotion) {
  const diagnostics = diagnosticsPage(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  if (name === 'raw') await page.waitForFunction(() => Boolean(window.__mutineNaiveV033), null, { timeout: 15000 });
  else {
    await page.waitForSelector('[data-catalog-work-detail="naive-2026-10-23"]');
    await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 15000 });
  }
  const measurement = await page.evaluate(() => {
    const field = document.querySelector('#proof-sheet') || document.querySelector('.work-tableau');
    const tableau = document.querySelector('iframe') || field;
    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
    const canvas = document.querySelector('canvas');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      tableau: tableau ? { width: Number(tableau.getBoundingClientRect().width.toFixed(2)), height: Number(tableau.getBoundingClientRect().height.toFixed(2)) } : null,
      canvasVisible: Boolean(canvas && canvas.width > 0 && getComputedStyle(canvas).display !== 'none'),
      buttonCount: buttons.length,
      buttons,
      title: document.title,
      hasWorkTitle: document.body.textContent.includes('The proof misheard itself.')
    };
  });
  const screenshot = path.join(proofDir, `${name}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { name, viewport: `${viewport.width}x${viewport.height}`, reducedMotion, measurement, diagnostics, screenshot };
}

async function interaction(page) {
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV033));
  const state = () => page.evaluate(() => ({ signature: window.__mutineNaiveV033.geometrySignature(), frame: window.__mutineNaiveV033.getState() }));
  const baseline = await state();
  await page.locator('[data-token="1"]').click();
  const first = await state();
  await page.locator('[data-token="4"]').click();
  const second = await state();
  await page.locator('[data-token="2"]').click();
  await page.locator('[data-action="witness"]').click();
  const committed = await state();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('2');
  await page.keyboard.press('5');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  const keyboard = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await page.screenshot({ path: path.join(proofDir, 'interaction-390x844.png'), fullPage: false });
  return {
    baseline: { memory: baseline.frame.memory.length, pending: baseline.frame.pending, signature: baseline.signature },
    first: { memory: first.frame.memory.length, pending: first.frame.pending, signatureUnchanged: first.signature === baseline.signature },
    second: { memory: second.frame.memory.length, pending: second.frame.pending, signatureUnchanged: second.signature === baseline.signature },
    committed: { memory: committed.frame.memory.length, interaction: committed.frame.interaction, changedGlyphs: committed.frame.glyphs.filter((glyph, index) => glyph.state !== baseline.frame.glyphs[index].state).length, signatureChanged: committed.signature !== baseline.signature },
    lifted: { memory: lifted.frame.memory.length, exactLift: lifted.signature === baseline.signature },
    keyboard: { memory: keyboard.frame.memory.length, interaction: keyboard.frame.interaction },
    released: { memory: released.frame.memory.length, interaction: released.frame.interaction }
  };
}

async function pointerInteraction(page) {
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV033));
  const state = () => page.evaluate(() => ({ signature: window.__mutineNaiveV033.geometrySignature(), frame: window.__mutineNaiveV033.getState() }));
  const baseline = await state();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no pointer box');
  await canvas.click({ position: { x: box.width * 0.18, y: box.height * 0.5 } });
  await canvas.click({ position: { x: box.width * 0.52, y: box.height * 0.5 } });
  await canvas.click({ position: { x: box.width * 0.84, y: box.height * 0.5 } });
  const armed = await state();
  await page.keyboard.press('Enter');
  const committed = await state();
  return {
    armed: { pending: armed.frame.pending, memory: armed.frame.memory.length, signatureUnchanged: armed.signature === baseline.signature },
    committed: { memory: committed.frame.memory.length, signatureChanged: committed.signature !== baseline.signature }
  };
}

async function blindPreview(page) {
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV033));
  return page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#proof-sheet')).display !== 'none',
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.proof-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.proof-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.proof-hint')).display,
    frame: window.__mutineNaiveV033.getState(),
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
}

async function readbacks(page) {
  const paths = ['/journal/', '/currents/naive-art/', '/works/naive-2026-10-23/', '/studies/naive-art/v033/?preview=1&interaction=1', '/studio/data/works.json', '/studio/data/catalog-public.json', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    if (route.startsWith('/studies/')) await page.waitForFunction(() => Boolean(window.__mutineNaiveV033));
    const body = route.endsWith('favicon.svg') ? '' : await page.locator('body').innerText().catch(() => '');
    result[route] = {
      status: response.status(),
      hasTarget: route.startsWith('/studies/') ? Boolean(await page.evaluate(() => window.__mutineNaiveV033)) : body.includes('The proof misheard itself.') || body.includes('naive-2026-10-23') || route.endsWith('favicon.svg')
    };
  }
  const source = await page.evaluate(async () => (await fetch('/studio/data/works.json')).json());
  const publicCatalog = await page.evaluate(async () => (await fetch('/studio/data/catalog-public.json')).json());
  result.registry = {
    sourceMatches: source.works.filter((work) => work.id === 'naive-2026-10-23').length,
    publicMatches: publicCatalog.works.works.filter((work) => work.id === 'naive-2026-10-23').length,
    sourceCount: source.works.length,
    publicCount: publicCatalog.works.works.length
  };
  return result;
}

const server = process.env.MUTINE_BASE_URL ? null : await startServer();
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      for (const [name, route] of Object.entries(routes)) {
        const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        results.push(await probe(page, name, route, viewport, reducedMotion));
        await context.close();
      }
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const interactionResult = await interaction(page);
  const pointerResult = await pointerInteraction(page);
  const blindResult = await blindPreview(page);
  const readbackResult = await readbacks(page);
  await context.close();
  const output = {
    routeMatrix: results,
    interaction: interactionResult,
    pointerInteraction: pointerResult,
    blindPreview: blindResult,
    readbacks: readbackResult,
    totals: {
      matrixRuns: results.length,
      overflowFailures: results.filter((entry) => entry.measurement.scrollWidth > entry.measurement.innerWidth).length,
      diagnostics: results.reduce((sum, entry) => sum + Object.values(entry.diagnostics).reduce((inner, values) => inner + values.length, 0), 0),
      minTouchTarget: Math.min(...results.flatMap((entry) => entry.measurement.buttons.map((button) => button.height)), Infinity)
    }
  };
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, pointerInteraction: output.pointerInteraction, blindPreview: { memory: output.blindPreview.frame.memory.length, widths: [output.blindPreview.innerWidth, output.blindPreview.clientWidth, output.blindPreview.scrollWidth] }, readbacks: output.readbacks.registry }, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
