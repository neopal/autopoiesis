import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const modes = ['normal', 'reduced-motion'];
const workId = 'typography-2026-10-27';
const rawPath = '/studies/handwriting/v035/';
const canonicalPath = `/works/${workId}/`;
const proofDir = process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v035-2026-10-27';
const suppliedBase = process.env.BASE_URL || '';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function localServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const candidate = path.resolve(root, `.${requestPath}`);
      if (!candidate.startsWith(root)) throw new Error('path traversal');
      let target = candidate;
      const details = await stat(target);
      if (details.isDirectory()) target = path.join(target, 'index.html');
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function attachDiagnostics(page) {
  const diagnostics = [];
  page.on('console', (message) => diagnostics.push(`console:${message.type()}:${message.text()}`));
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed:${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.push(`http:${response.status()}:${response.url()}`);
  });
  return diagnostics;
}

async function waitRawReady(page) {
  await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV035), null, { timeout: 15000 });
}

async function rawMetrics(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#casting-field');
    const canvas = document.querySelector('#cast-canvas');
    const controls = [...document.querySelectorAll('.casting-controls button')];
    const fieldRect = field?.getBoundingClientRect();
    const frame = window.__mutineHandwritingV035?.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      fieldWidth: fieldRect?.width ?? 0,
      fieldHeight: fieldRect?.height ?? 0,
      blockCount: frame?.blocks.length ?? 0,
      memory: frame?.memory.length ?? 0,
      controls: controls.map((control) => ({ id: control.id, width: control.getBoundingClientRect().width, height: control.getBoundingClientRect().height })),
      signature: window.__mutineHandwritingV035?.getSignature(),
      renderer: document.querySelector('#casting-field')?.dataset.renderer ?? 'webgl'
    };
  });
}

async function canonicalMetrics(page) {
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?._p5Ready === true), null, { timeout: 15000 });
  const iframe = page.locator('iframe').first();
  const iframeBox = await iframe.boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  return page.evaluate(({ iframeTop, headingTop, workId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
    title: document.body.innerText.includes('The letter is cast elsewhere.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, workId });
}

async function runViewportMatrix(browser, base, label) {
  const runs = [];
  const diagnostics = [];
  for (const mode of modes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const pageDiagnostics = attachDiagnostics(page);
      await page.goto(`${base}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
      await waitRawReady(page);
      const metrics = await rawMetrics(page);
      runs.push({ route: 'raw', mode, viewport: `${viewport.width}x${viewport.height}`, ...metrics });
      await page.screenshot({ path: path.join(root, proofDir, `${label}-raw-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...pageDiagnostics);
      await context.close();

      const canonicalContext = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const canonicalPage = await canonicalContext.newPage();
      const canonicalDiagnostics = attachDiagnostics(canonicalPage);
      await canonicalPage.goto(`${base}${canonicalPath}`, { waitUntil: 'networkidle' });
      const metricsForCanonical = await canonicalMetrics(canonicalPage);
      runs.push({ route: 'canonical', mode, viewport: `${viewport.width}x${viewport.height}`, ...metricsForCanonical });
      await canonicalPage.screenshot({ path: path.join(root, proofDir, `${label}-canonical-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...canonicalDiagnostics);
      await canonicalContext.close();
    }
  }
  return { runs, diagnostics };
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await waitRawReady(page);
  const baseline = await page.evaluate(() => window.__mutineHandwritingV035.getSignature());
  const field = page.locator('#casting-field');
  const box = await field.boundingBox();
  if (!box) throw new Error('casting field has no box');
  const sourcePoint = { x: box.x + box.width * .87, y: box.y + box.height * .31 };
  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  const during = await page.evaluate(() => ({ state: window.__mutineHandwritingV035.getState(), signature: window.__mutineHandwritingV035.getSignature() }));
  await page.waitForTimeout(160);
  await page.mouse.up();
  await page.waitForTimeout(30);
  const after = await page.evaluate(() => ({ state: window.__mutineHandwritingV035.getState(), signature: window.__mutineHandwritingV035.getSignature() }));
  await page.evaluate(() => document.querySelector('#casting-field').focus());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ state: window.__mutineHandwritingV035.getState(), signature: window.__mutineHandwritingV035.getSignature() }));
  await page.reload({ waitUntil: 'networkidle' });
  await waitRawReady(page);
  await page.evaluate(() => document.querySelector('#casting-field').focus());
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineHandwritingV035.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.casting-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })));
  await context.close();
  return {
    committed: after.state.lastEvent === 'cast' && after.state.history.length === 1,
    previewGeometryUnchanged: during.state.lastEvent === 'charging' && during.state.history.length === 0 && during.state.active !== null && during.signature === baseline,
    changedGeometry: after.state.history.length === 1 && after.state.changedBlockIds.length >= 3 && after.signature !== baseline,
    remoteChange: after.state.changedBlockIds.some((id) => id !== during.state.active),
    liftRestored: lifted.state.lastEvent === 'lifted' && lifted.state.history.length === 0 && lifted.signature === baseline,
    keyboardCommitted: keyboard.lastEvent === 'cast' && keyboard.history.length === 1,
    controls,
    diagnostics
  };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitRawReady(page);
  const result = await page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV035.getState();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: document.querySelector('#cast-canvas')?.width > 0,
      blockCount: state.history.length ? window.__mutineHandwritingV035.getFrame().blocks.length : window.__mutineHandwritingV035.getFrame().blocks.length,
      memory: state.memory,
      controls: hidden('.casting-controls') ? 'none' : 'visible',
      readout: hidden('.field-readout') ? 'none' : 'visible',
      hint: hidden('.field-hint') ? 'none' : 'visible',
      coordinates: hidden('.field-coordinates') ? 'none' : 'visible'
    };
  });
  await page.screenshot({ path: path.join(root, proofDir, 'blind-390x844.png'), fullPage: true });
  await context.close();
  return { ...result, diagnostics };
}

async function runReadbacks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  const targets = {
    works: '/studio/data/works.json',
    publicCatalog: '/studio/data/catalog-public.json',
    journal: '/journal/',
    current: '/currents/handwriting/',
    canonical: canonicalPath,
    raw: `${rawPath}?preview=1&static=1&blind=1`,
    favicon: '/studio/favicon.svg'
  };
  const result = {};
  for (const [name, route] of Object.entries(targets)) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    if (name === 'journal') await page.waitForSelector('#journal-typography-2026-10-27', { timeout: 15000 });
    if (name === 'current') await page.waitForFunction(() => document.body.innerText.includes('The letter is cast elsewhere.'), null, { timeout: 15000 });
    if (name === 'canonical') await page.waitForSelector(`[data-catalog-work-detail="${workId}"]`, { timeout: 15000 });
    if (name === 'raw') await waitRawReady(page);
    const body = await page.locator('body').innerText().catch(() => '');
    const dom = await page.evaluate(({ name, workId }) => ({
      hasJournal: name === 'journal' && Boolean(document.querySelector(`#journal-${workId}`)),
      hasCurrentCard: name === 'current' && Boolean(document.querySelector(`[data-work-id="${workId}"]`)),
      hasCanonicalDetail: name === 'canonical' && Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
      hasRawEngine: name === 'raw' && Boolean(window.__mutineHandwritingV035),
    }), { name, workId });
    result[name] = { status: response?.status() ?? 0, hasWork: body.includes(workId) || dom.hasCurrentCard || dom.hasCanonicalDetail || dom.hasRawEngine, hasTitle: body.includes('The letter is cast elsewhere.'), hasJournal: dom.hasJournal };
  }
  await context.close();
  return { result, diagnostics };
}

async function run() {
  await mkdir(path.join(root, proofDir), { recursive: true });
  const local = suppliedBase ? null : await localServer();
  const base = suppliedBase || local.base;
  const production = Boolean(suppliedBase);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runViewportMatrix(browser, base, production ? 'production' : 'local');
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base);
  const readbacks = await runReadbacks(browser, base);
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));

  const allDiagnostics = [...matrix.diagnostics, ...interaction.diagnostics, ...blind.diagnostics, ...readbacks.diagnostics];
  const viewportRuns = matrix.runs.length;
  const rawRuns = matrix.runs.filter((run) => run.route === 'raw');
  const canonicalRuns = matrix.runs.filter((run) => run.route === 'canonical');
  const overflow = matrix.runs.filter((run) => run.innerWidth !== run.clientWidth || run.scrollWidth > run.innerWidth).length;
  const minTouchTarget = Math.min(...interaction.controls.map((control) => control.height));
  const output = {
    schema: 'mutine-qa/v1',
    base,
    production,
    viewportRuns,
    rawViewportRuns: rawRuns.length,
    canonicalViewportRuns: canonicalRuns.length,
    diagnostics: allDiagnostics.length,
    overflow,
    minTouchTarget,
    interaction,
    blind,
    readbacks,
    matrix
  };
  const outputPath = path.join(root, proofDir, production ? 'production-qa-summary.json' : 'qa-summary.json');
  await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ outputPath, base, viewportRuns, rawViewportRuns: rawRuns.length, canonicalViewportRuns: canonicalRuns.length, diagnostics: output.diagnostics, overflow, minTouchTarget, interaction: { committed: interaction.committed, previewGeometryUnchanged: interaction.previewGeometryUnchanged, changedGeometry: interaction.changedGeometry, remoteChange: interaction.remoteChange, liftRestored: interaction.liftRestored, keyboardCommitted: interaction.keyboardCommitted }, blind, readbacks: readbacks.result }, null, 2));
}

await run();
