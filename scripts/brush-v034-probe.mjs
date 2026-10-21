import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const proofDir = path.join(root, 'research', 'qa', 'proofs', 'brush-v034-2026-10-21');
const port = 4244;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = {
  raw: '/studies/p5-brush/v034/?preview=1&interaction=1',
  canonical: '/works/brush-2026-10-21/'
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

async function probe(page, route, viewport, reducedMotion) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  if (route.includes('/studies/')) {
    try {
      await page.waitForFunction(() => Boolean(window.__mutineBrushV034), { timeout: 12000 });
    } catch (error) {
      console.log(JSON.stringify({ missingApi: true, url: page.url(), body: await page.locator('body').innerText().catch(() => ''), diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses } }, null, 2));
      throw error;
    }
  } else {
    await page.waitForSelector('[data-catalog-work-detail="brush-2026-10-21"] .work-inspect__stage');
    await page.locator('iframe').first().waitFor({ state: 'attached' });
  }
  const measurement = await page.evaluate(() => {
    const canvas = document.querySelector('#attention-canvas canvas') || document.querySelector('iframe');
    const field = document.querySelector('#attention-field') || document.querySelector('.work-tableau');
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
      hasWorkTitle: document.body.textContent.includes('The paint keeps the unlooked-for.')
    };
  });
  const screenshot = path.join(proofDir, `${route.includes('/studies/') ? 'raw' : 'canonical'}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { route, viewport, reducedMotion, measurement, diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses }, screenshot };
}

async function interaction(page) {
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineBrushV034));
  const baseline = await page.evaluate(() => ({ signature: window.__mutineBrushV034.geometrySignature(), memory: window.__mutineBrushV034.getFrame().memory.length }));
  const points = await page.evaluate(() => {
    const canvas = document.querySelector('#attention-canvas canvas').getBoundingClientRect();
    const frame = window.__mutineBrushV034.getFrame();
    return [0, 3, 6, 9, 11].map((index) => ({ x: canvas.left + frame.pools[index].cx * canvas.width, y: canvas.top + frame.pools[index].cy * canvas.height }));
  });
  for (const point of points) {
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(30);
  }
  const committed = await page.evaluate(() => ({ signature: window.__mutineBrushV034.geometrySignature(), memory: window.__mutineBrushV034.getFrame().memory.length, pending: window.__mutineBrushV034.getFrame().pending.length, dried: window.__mutineBrushV034.getFrame().driedCount, ridged: window.__mutineBrushV034.getFrame().ridgedCount, counterflow: window.__mutineBrushV034.getFrame().counterflowCount }));
  await page.locator('#attention-field').press('Delete');
  const lifted = await page.evaluate(() => ({ signature: window.__mutineBrushV034.geometrySignature(), memory: window.__mutineBrushV034.getFrame().memory.length }));
  await page.locator('#attention-field').press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: window.__mutineBrushV034.getFrame().memory.length, interaction: window.__mutineBrushV034.getFrame().interaction }));
  await page.locator('#attention-field').press('Escape');
  const released = await page.evaluate(() => ({ memory: window.__mutineBrushV034.getFrame().memory.length, interaction: window.__mutineBrushV034.getFrame().interaction }));
  return { baseline, points, committed, lifted, keyboard, released, exactLift: baseline.signature === lifted.signature, committedChanged: baseline.signature !== committed.signature };
}

async function blindPreview(page) {
  await page.goto(`http://127.0.0.1:${port}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineBrushV034));
  return page.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('#attention-canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.attention-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.attention-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.attention-hint')).display,
    memory: window.__mutineBrushV034.getFrame().memory.length,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
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
  await interactionContext.close();
  const output = {
    routeMatrix: results,
    interaction: interactionResult,
    blindPreview: blindResult,
    totals: {
      matrixRuns: results.length,
      overflowFailures: results.filter((entry) => entry.measurement.scrollWidth > entry.measurement.innerWidth).length,
      diagnostics: results.reduce((sum, entry) => sum + Object.values(entry.diagnostics).reduce((inner, values) => inner + values.length, 0), 0)
    }
  };
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, blindPreview: output.blindPreview }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
