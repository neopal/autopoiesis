import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--production');
const smoke = process.argv.includes('--smoke');
const port = 57139;
const base = production ? 'https://autopoiesis-nine.vercel.app' : `http://127.0.0.1:${port}`;
const proofDir = path.join(root, 'research', 'qa', 'proofs', `naive-v035-2026-10-25${production ? '-production' : ''}`);
const viewports = smoke ? [{ width: 390, height: 844 }] : [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = smoke ? {
  raw: '/studies/naive-art/v035/?preview=1&interaction=1'
} : {
  raw: '/studies/naive-art/v035/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-25/'
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

function attachDiagnostics(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitForWork(page, name) {
  if (name === 'raw') await page.waitForFunction(() => Boolean(window.__mutineNaiveV035), null, { timeout: 15000 });
  else {
    await page.waitForSelector('[data-catalog-work-detail="naive-2026-10-25"]', { timeout: 15000 });
    await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?._p5Ready || document.querySelector('iframe')?.getAttribute('data-ready') === 'true', null, { timeout: 15000 }).catch(() => {});
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#plate-field') || document.querySelector('.work-tableau');
    const tableau = document.querySelector('iframe') || field;
    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
    const canvas = document.querySelector('canvas');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      tableau: tableau ? { width: Number(tableau.getBoundingClientRect().width.toFixed(2)), height: Number(tableau.getBoundingClientRect().height.toFixed(2)) } : null,
      canvasVisible: Boolean(canvas && canvas.width > 0 && getComputedStyle(canvas).display !== 'none'),
      buttonCount: buttons.length,
      buttons,
      title: document.title,
      hasWorkTitle: document.body.textContent.includes('The model')
    };
  });
}

async function state(page) {
  return page.evaluate(() => ({ signature: window.__mutineNaiveV035.geometrySignature(), frame: window.__mutineNaiveV035.getState(), pointer: window.__mutineNaiveV035.getPointerPoints() }));
}

async function probe(page, name, route, viewport, reducedMotion) {
  const diagnostics = attachDiagnostics(page);
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitForWork(page, name);
  const measurement = await measure(page);
  const shouldCapture = viewport.width === 390 && (name === 'raw' || reducedMotion);
  const screenshot = shouldCapture ? path.join(proofDir, `${name}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`) : null;
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: false });
  return { name, viewport: `${viewport.width}x${viewport.height}`, reducedMotion, status: response.status(), measurement, diagnostics, screenshot };
}

async function interaction(page) {
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV035));
  const baseline = await state(page);
  const canvas = page.locator('#plate-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('plate canvas has no pointer box');
  const points = [
    [box.x + box.width * 0.18, box.y + box.height * 0.62],
    [box.x + box.width * 0.25, box.y + box.height * 0.54],
    [box.x + box.width * 0.34, box.y + box.height * 0.49],
    [box.x + box.width * 0.42, box.y + box.height * 0.43]
  ];
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  const armed = await state(page);
  for (const point of points.slice(1)) await page.mouse.move(point[0], point[1]);
  const preview = await state(page);
  await page.mouse.up();
  const committed = await state(page);
  await page.keyboard.press('Delete');
  const lifted = await state(page);
  await page.keyboard.press('Enter');
  const keyboard = await state(page);
  await page.keyboard.press('Escape');
  const released = await state(page);
  await page.screenshot({ path: path.join(proofDir, 'interaction-390x844.png'), fullPage: false });
  return {
    armed: { memory: armed.frame.memory.length, signatureUnchanged: armed.signature === baseline.signature },
    preview: { pointCount: preview.pointer.length, memory: preview.frame.memory.length, signatureUnchanged: preview.signature === baseline.signature },
    committed: { memory: committed.frame.memory.length, changedSignature: committed.signature !== baseline.signature, event: committed.frame.memory.at(-1)?.kind },
    lifted: { memory: lifted.frame.memory.length, exactLift: lifted.signature === baseline.signature },
    keyboard: { memory: keyboard.frame.memory.length, changedSignature: keyboard.signature !== baseline.signature },
    released: { memory: released.frame.memory.length, exactRelease: released.signature === baseline.signature }
  };
}

async function blindPreview(page) {
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV035));
  const result = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#plate-field')).display !== 'none',
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.plate-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.plate-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.plate-hint')).display,
    frame: window.__mutineNaiveV035.getState(),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: path.join(proofDir, 'blind-390x844.png'), fullPage: false });
  return result;
}

async function readbacks(page) {
  const paths = ['/journal/', '/currents/naive-art/', '/works/naive-2026-10-25/', '/studies/naive-art/v035/?preview=1&interaction=1', '/studio/data/works.json', '/studio/data/catalog-public.json', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    if (route.startsWith('/studies/')) await page.waitForFunction(() => Boolean(window.__mutineNaiveV035));
    const body = route.endsWith('favicon.svg') ? '' : await page.locator('body').innerText().catch(() => '');
    result[route] = {
      status: response.status(),
      hasTarget: route.startsWith('/studies/') ? Boolean(await page.evaluate(() => window.__mutineNaiveV035)) : body.includes('The model mistakes the hole.') || body.includes('naive-2026-10-25') || route.endsWith('favicon.svg')
    };
  }
  const source = await page.evaluate(async () => (await fetch('/studio/data/works.json')).json());
  const publicCatalog = await page.evaluate(async () => (await fetch('/studio/data/catalog-public.json')).json());
  result.registry = {
    sourceMatches: source.works.filter((work) => work.id === 'naive-2026-10-25').length,
    publicMatches: publicCatalog.works.works.filter((work) => work.id === 'naive-2026-10-25').length,
    sourceCount: source.works.length,
    publicCount: publicCatalog.works.works.length
  };
  return result;
}

const server = production ? null : await startServer();
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
  const blindResult = await blindPreview(page);
  const readbackResult = await readbacks(page);
  await context.close();
  const diagnostics = results.flatMap((entry) => Object.values(entry.diagnostics).flat());
  const overflow = results.filter((entry) => entry.measurement.scrollWidth > entry.measurement.innerWidth || entry.measurement.clientWidth !== entry.measurement.innerWidth);
  const touchHeights = results.flatMap((entry) => entry.measurement.buttons.map((button) => button.height));
  const output = {
    target: 'naive-2026-10-25',
    base,
    routeMatrix: results,
    interaction: interactionResult,
    blindPreview: blindResult,
    readbacks: readbackResult,
    totals: {
      matrixRuns: results.length,
      overflowFailures: overflow.length,
      diagnostics: diagnostics.length,
      minTouchTarget: Math.min(...touchHeights, Infinity),
      non200: results.filter((entry) => entry.status >= 400).length,
      blindWidths: [blindResult.innerWidth, blindResult.clientWidth, blindResult.scrollWidth]
    }
  };
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, blind: { memory: output.blindPreview.frame.memory.length, widths: output.totals.blindWidths }, readbacks: output.readbacks.registry }, null, 2));
  if (output.totals.overflowFailures || output.totals.diagnostics || output.totals.non200 || output.totals.minTouchTarget < 44) process.exitCode = 1;
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}
