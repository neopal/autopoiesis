import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const proofDir = path.join(root, 'research', 'qa', 'proofs', 'brush-v035-2026-10-22');
const port = 57135;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = {
  raw: '/studies/p5-brush/v035/?preview=1&interaction=1',
  canonical: '/works/brush-2026-10-22/'
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
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
    response.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

async function diagnosticsPage(page) {
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

async function probe(page, route, viewport, reducedMotion) {
  const diagnostics = await diagnosticsPage(page);
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  if (route.includes('/studies/')) {
    await page.waitForFunction(() => Boolean(window.__mutineBrushV035), { timeout: 15000 });
  } else {
    await page.waitForSelector('[data-catalog-work-detail="brush-2026-10-22"] .work-inspect__stage');
    await page.locator('iframe').first().waitFor({ state: 'attached' });
  }
  const measurement = await page.evaluate(() => {
    const canvas = document.querySelector('#membrane-canvas canvas') || document.querySelector('iframe');
    const field = document.querySelector('#reversal-field') || document.querySelector('.work-tableau');
    const buttons = [...document.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: rect.width, height: rect.height };
    });
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height } : null,
      canvas: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height } : null,
      buttons,
      title: document.title,
      hasWorkTitle: document.body.textContent.includes('The paint remembers which way you left.')
    };
  });
  const screenshot = path.join(proofDir, `${route.includes('/studies/') ? 'raw' : 'canonical'}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { route, viewport, reducedMotion, measurement, diagnostics, screenshot };
}

async function interaction(page) {
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineBrushV035));
  await page.locator('#reversal-field').focus();
  const baseline = await page.evaluate(() => ({ signature: window.__mutineBrushV035.geometrySignature(), frame: window.__mutineBrushV035.getFrame() }));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const armed = await page.evaluate(() => ({ signature: window.__mutineBrushV035.geometrySignature(), frame: window.__mutineBrushV035.getFrame() }));
  await page.keyboard.press('ArrowLeft');
  const committed = await page.evaluate(() => ({ signature: window.__mutineBrushV035.geometrySignature(), frame: window.__mutineBrushV035.getFrame() }));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ signature: window.__mutineBrushV035.geometrySignature(), frame: window.__mutineBrushV035.getFrame() }));
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ frame: window.__mutineBrushV035.getFrame() }));
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => ({ frame: window.__mutineBrushV035.getFrame() }));
  return {
    baseline: { memory: baseline.frame.memory.length, pending: baseline.frame.pending, signature: baseline.signature },
    armed: { memory: armed.frame.memory.length, pending: armed.frame.pending, signatureUnchanged: armed.signature === baseline.signature },
    committed: { memory: committed.frame.memory.length, interaction: committed.frame.interaction, shearedCount: committed.frame.shearedCount, voidCount: committed.frame.voidCount, stainedCount: committed.frame.stainedCount, signatureChanged: committed.signature !== baseline.signature },
    lifted: { memory: lifted.frame.memory.length, exactLift: lifted.signature === baseline.signature },
    keyboard: { memory: keyboard.frame.memory.length, interaction: keyboard.frame.interaction },
    released: { memory: released.frame.memory.length, interaction: released.frame.interaction }
  };
}

async function blindPreview(page) {
  await page.goto(`http://127.0.0.1:${port}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineBrushV035));
  return page.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('#membrane-canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.membrane-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.membrane-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.membrane-hint')).display,
    frame: window.__mutineBrushV035.getFrame(),
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
}

async function readbacks(page) {
  const paths = ['/journal/', '/currents/brush/', '/works/brush-2026-10-22/', '/studies/p5-brush/v035/?preview=1&interaction=1', '/studio/data/works.json', '/studio/data/catalog-public.json', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
    const body = await page.locator('body').innerText().catch(() => '');
    result[route] = { status: response.status(), hasTarget: body.includes('The paint remembers which way you left.') || body.includes('brush-2026-10-22') || route.endsWith('favicon.svg') };
  }
  const source = await page.evaluate(async () => (await fetch('/studio/data/works.json')).json());
  const publicCatalog = await page.evaluate(async () => (await fetch('/studio/data/catalog-public.json')).json());
  result.registry = {
    sourceMatches: source.works.filter((work) => work.id === 'brush-2026-10-22').length,
    publicMatches: publicCatalog.works.works.filter((work) => work.id === 'brush-2026-10-22').length,
    sourceCount: source.works.length,
    publicCount: publicCatalog.works.works.length
  };
  return result;
}

const server = await startServer();
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      for (const [name, route] of Object.entries(routes)) {
        const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        results.push({ name, ...(await probe(page, route, viewport, reducedMotion)) });
        await context.close();
      }
    }
  }
  const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const interactionPage = await interactionContext.newPage();
  const interactionResult = await interaction(interactionPage);
  const blindResult = await blindPreview(interactionPage);
  const readbackResult = await readbacks(interactionPage);
  await interactionContext.close();
  const output = {
    routeMatrix: results,
    interaction: interactionResult,
    blindPreview: blindResult,
    readbacks: readbackResult,
    totals: {
      matrixRuns: results.length,
      overflowFailures: results.filter((entry) => entry.measurement.scrollWidth > entry.measurement.innerWidth).length,
      diagnostics: results.reduce((sum, entry) => sum + Object.values(entry.diagnostics).reduce((inner, values) => inner + values.length, 0), 0)
    }
  };
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, blindPreview: { memory: output.blindPreview.frame.memory.length, voidCount: output.blindPreview.frame.voidCount, widths: [output.blindPreview.innerWidth, output.blindPreview.clientWidth, output.blindPreview.scrollWidth] }, readbacks: output.readbacks.registry }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
