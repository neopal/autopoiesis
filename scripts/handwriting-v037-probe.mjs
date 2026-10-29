import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-10-29';
const rawPath = '/studies/handwriting/v037/';
const canonicalPath = `/works/${workId}/`;
const MEMORY_WINDOW = 4;
const proofDir = path.resolve(root, process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v037-2026-10-29');
const suppliedBase = process.env.BASE_URL || '';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const modes = ['normal', 'reduced-motion'];
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
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

function diagnosticsFor(page) {
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
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV037));
  return page;
}

async function waitCanonicalFrame(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV037));
  return page.frames().find((frame) => frame.url().includes('/studies/handwriting/v037/'));
}

async function rawMetrics(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#seam-field');
    const svg = document.querySelector('#sentence-svg');
    const state = window.__mutineHandwritingV037?.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svgVisible: Boolean(svg && svg.getBoundingClientRect().width > 0),
      svgWidth: svg?.getBoundingClientRect().width ?? 0,
      svgHeight: svg?.getBoundingClientRect().height ?? 0,
      fieldWidth: field?.getBoundingClientRect().width ?? 0,
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      glyphCount: state?.glyphs.length ?? 0,
      memory: state?.memory.length ?? 0,
      controls: [...document.querySelectorAll('.seam-controls button')].map((button) => ({ id: button.dataset.action, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
      signature: window.__mutineHandwritingV037?.getSignature()
    };
  });
}

async function canonicalMetrics(page) {
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  await waitCanonicalFrame(page);
  const iframe = page.locator('iframe').first();
  const iframeBox = await iframe.boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  return page.evaluate(({ iframeTop, headingTop, workId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
    title: document.body.innerText.includes('The line learns where to break.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, workId });
}

async function visit(page, base, url) {
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
}

async function runMatrix(browser, base, label) {
  const runs = [];
  const diagnostics = [];
  for (const mode of modes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const rawPage = await context.newPage();
      const rawDiagnostics = diagnosticsFor(rawPage);
      await visit(rawPage, base, `${rawPath}?preview=1&interaction=1`);
      const raw = await rawMetrics(await waitRawReady(rawPage));
      runs.push({ route: 'raw', mode, viewport: `${viewport.width}x${viewport.height}`, ...raw });
      await rawPage.screenshot({ path: path.join(proofDir, `${label}-raw-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...rawDiagnostics);
      await context.close();

      const canonicalContext = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const canonicalPage = await canonicalContext.newPage();
      const canonicalDiagnostics = diagnosticsFor(canonicalPage);
      await visit(canonicalPage, base, canonicalPath);
      const canonical = await canonicalMetrics(canonicalPage);
      runs.push({ route: 'canonical', mode, viewport: `${viewport.width}x${viewport.height}`, ...canonical });
      await canonicalPage.screenshot({ path: path.join(proofDir, `${label}-canonical-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...canonicalDiagnostics);
      await canonicalContext.close();
    }
  }
  return { runs, diagnostics };
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&interaction=1`);
  await waitRawReady(page);
  const baseline = await page.evaluate(() => ({ signature: window.__mutineHandwritingV037.getSignature(), state: window.__mutineHandwritingV037.getState() }));
  const field = page.locator('#seam-field');
  const box = await field.boundingBox();
  if (!box) throw new Error('seam field has no box');
  const start = { x: box.x + box.width * .19, y: box.y + box.height * .78 };
  const end = { x: box.x + box.width * .53, y: box.y + box.height * .83 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const duringDown = await page.evaluate(() => ({ signature: window.__mutineHandwritingV037.getSignature(), state: window.__mutineHandwritingV037.getState() }));
  await page.mouse.move(end.x, end.y);
  const duringMove = await page.evaluate(() => ({ signature: window.__mutineHandwritingV037.getSignature(), state: window.__mutineHandwritingV037.getState() }));
  await page.mouse.up();
  const after = await page.evaluate(() => ({ signature: window.__mutineHandwritingV037.getSignature(), state: window.__mutineHandwritingV037.getState(), frame: window.__mutineHandwritingV037.getFrame() }));
  await field.focus();
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ signature: window.__mutineHandwritingV037.getSignature(), state: window.__mutineHandwritingV037.getState() }));
  await visit(page, base, `${rawPath}?preview=1&interaction=1`);
  await waitRawReady(page);
  await page.locator('#seam-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineHandwritingV037.getState());
  await page.locator('[data-action="release"]').click();
  const released = await page.evaluate(() => window.__mutineHandwritingV037.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.seam-controls button')].map((button) => ({ id: button.dataset.action, height: button.getBoundingClientRect().height })));
  await context.close();
  return {
    baseline,
    duringDown,
    duringMove,
    after: { state: after.state, changedGlyphIds: after.frame.changedGlyphIds },
    lifted,
    keyboard,
    released,
    previewGeometryUnchanged: baseline.signature === duringDown.signature && baseline.signature === duringMove.signature,
    committed: after.state.lastEvent === 'cut' && after.state.memory === 1,
    changedGeometry: after.signature !== baseline.signature && after.frame.changedGlyphIds.length >= 3,
    liftRestored: lifted.state.lastEvent === 'lifted' && lifted.signature === baseline.signature,
    keyboardCommitted: keyboard.lastEvent === 'cut' && keyboard.memory === 1,
    releaseQuiet: released.lastEvent === 'quiet' && released.memory === 0,
    controls,
    diagnostics
  };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&static=1&blind=1`);
  await waitRawReady(page);
  const evidence = await page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV037.getFrame();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svgVisible: document.querySelector('#sentence-svg')?.getBoundingClientRect().width > 0,
      glyphCount: state.glyphs.length,
      memory: state.memory.length,
      controls: hidden('.seam-controls') ? 'none' : 'visible',
      readout: hidden('.field-readout') ? 'none' : 'visible',
      note: hidden('.field-note') ? 'none' : 'visible',
      hint: hidden('.field-hint') ? 'none' : 'visible'
    };
  });
  await page.screenshot({ path: path.join(proofDir, 'blind-390x844.png'), fullPage: true });
  await context.close();
  return { ...evidence, diagnostics };
}

async function runReadbacks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
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
    if (name === 'journal') await page.waitForSelector('#journal-typography-2026-10-29', { timeout: 15000 });
    if (name === 'current') await page.waitForFunction(() => document.body.innerText.includes('The line learns where to break.'), null, { timeout: 15000 });
    if (name === 'canonical') await page.waitForSelector(`[data-catalog-work-detail="${workId}"]`, { timeout: 15000 });
    if (name === 'raw') await waitRawReady(page);
    const body = await page.locator('body').innerText().catch(() => '');
    const dom = await page.evaluate(({ name, workId }) => ({
      hasJournal: name === 'journal' && Boolean(document.querySelector('#journal-typography-2026-10-29')),
      hasCurrentCard: name === 'current' && Boolean(document.querySelector(`[data-work-id="${workId}"]`)),
      hasCanonicalDetail: name === 'canonical' && Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
      hasRawEngine: name === 'raw' && Boolean(window.__mutineHandwritingV037) || name === 'raw' && [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV037)
    }), { name, workId });
    result[name] = {
      status: response?.status() ?? 0,
      hasWork: body.includes(workId) || dom.hasCurrentCard || dom.hasCanonicalDetail || dom.hasRawEngine,
      hasTitle: body.includes('The line learns where to break.'),
      hasJournal: dom.hasJournal
    };
  }
  await context.close();
  return { result, diagnostics };
}

await mkdir(proofDir, { recursive: true });
const local = suppliedBase ? null : await localServer();
const base = suppliedBase || local.base;
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = await runMatrix(browser, base, suppliedBase ? 'production' : 'local');
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base);
  const readbacks = await runReadbacks(browser, base);
  const allDiagnostics = [...matrix.diagnostics, ...interaction.diagnostics, ...blind.diagnostics, ...readbacks.diagnostics];
  const overflow = matrix.runs.filter((run) => run.innerWidth !== run.clientWidth || run.scrollWidth > run.innerWidth).length;
  const minTouchTarget = Math.min(...interaction.controls.map((control) => control.height));
  const output = {
    matrix: matrix.runs,
    interaction,
    blindPreview: blind,
    readbacks,
    totals: {
      matrixRuns: matrix.runs.length,
      rawRuns: matrix.runs.filter((run) => run.route === 'raw').length,
      canonicalRuns: matrix.runs.filter((run) => run.route === 'canonical').length,
      overflowFailures: overflow,
      diagnostics: allDiagnostics.length,
      minTouchTarget
    }
  };
  const failures = [];
  if (matrix.runs.length !== 20) failures.push('matrix must contain 20 runs');
  if (overflow) failures.push(`${overflow} viewport overflow failures`);
  if (allDiagnostics.length) failures.push(`${allDiagnostics.length} browser diagnostics`);
  if (!interaction.previewGeometryUnchanged || !interaction.committed || !interaction.changedGeometry || !interaction.liftRestored || !interaction.keyboardCommitted || !interaction.releaseQuiet) failures.push('interaction gate failed');
  if (blind.svgVisible !== true || blind.glyphCount !== 32 || blind.memory !== MEMORY_WINDOW || blind.controls !== 'none' || blind.readout !== 'none' || blind.note !== 'none' || blind.hint !== 'none' || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget}`);
  const coreReadbacksOk = ['works', 'publicCatalog', 'journal', 'current', 'canonical', 'raw'].every((name) => readbacks.result[name]?.status === 200 && (readbacks.result[name].hasWork || readbacks.result[name].hasJournal));
  if (!coreReadbacksOk || readbacks.result.favicon?.status !== 200) failures.push('readback gate failed');
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, blindPreview: output.blindPreview, readbacks: output.readbacks.result, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));
}
