import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-10-30';
const rawPath = '/studies/handwriting/v038/';
const canonicalPath = `/works/${workId}/`;
const memoryWindow = 4;
const proofDir = path.resolve(root, process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v038-2026-10-30');
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

async function visit(page, base, route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
}

async function waitRawReady(page) {
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV038));
  return page;
}

async function waitCanonicalReady(page) {
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV038), null, { timeout: 15000 });
  return page.frames().find((frame) => frame.url().includes('/studies/handwriting/v038/'));
}

async function rawMetrics(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#lexicon-field');
    const state = window.__mutineHandwritingV038?.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      fieldWidth: field?.getBoundingClientRect().width ?? 0,
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      slotCount: document.querySelectorAll('.lexicon-slot').length,
      memory: state?.memory.length ?? 0,
      controls: [...document.querySelectorAll('.lexicon-controls button')].map((button) => ({ id: button.dataset.action, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
    };
  });
}

async function canonicalMetrics(page) {
  const frame = await waitCanonicalReady(page);
  const iframe = page.locator('iframe').first();
  const iframeBox = await iframe.boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  const outer = await page.evaluate(({ iframeTop, headingTop, workId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
    title: document.body.innerText.includes('The alphabet votes from the margins.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, workId });
  return { ...outer, raw: await rawMetrics(frame) };
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
  const field = page.locator('#lexicon-field');
  await field.focus();
  const baseline = await page.evaluate(() => ({ signature: window.__mutineHandwritingV038.getSignature(), state: window.__mutineHandwritingV038.getState(), slots: window.__mutineHandwritingV038.getSlots() }));
  await page.keyboard.type('KE');
  const partial = await page.evaluate(() => ({ signature: window.__mutineHandwritingV038.getSignature(), state: window.__mutineHandwritingV038.getState() }));
  await page.keyboard.type('Y');
  await page.keyboard.press('Enter');
  const after = await page.evaluate(() => ({ signature: window.__mutineHandwritingV038.getSignature(), state: window.__mutineHandwritingV038.getState(), frame: window.__mutineHandwritingV038.getFrame(), slots: window.__mutineHandwritingV038.getSlots() }));
  const sourceId = after.frame.memory[0].sourceId;
  const sourceBefore = baseline.slots.find((slot) => slot.id === sourceId);
  const sourceAfter = after.slots.find((slot) => slot.id === sourceId);
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ signature: window.__mutineHandwritingV038.getSignature(), state: window.__mutineHandwritingV038.getState() }));
  await field.focus();
  await page.locator('[data-action="ratify"]').click();
  const button = await page.evaluate(() => window.__mutineHandwritingV038.getState());
  await page.locator('[data-action="release"]').click();
  const released = await page.evaluate(() => window.__mutineHandwritingV038.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.lexicon-controls button')].map((button) => ({ id: button.dataset.action, height: button.getBoundingClientRect().height })));
  await context.close();
  return {
    baseline,
    partial,
    after: { state: after.state, changedSlotIds: after.state.changedSlotIds },
    lifted,
    button,
    released,
    previewGeometryUnchanged: baseline.signature === partial.signature,
    committed: after.state.lastEvent === 'ratified remotely' && after.state.memory === 1,
    remoteChanged: after.state.changedSlotIds.length >= 3 && !after.state.changedSlotIds.includes(sourceId),
    sourceQuiet: JSON.stringify(sourceBefore) === JSON.stringify(sourceAfter),
    liftRestored: lifted.state.lastEvent === 'lifted latest' && lifted.signature === baseline.signature,
    buttonCommitted: button.lastEvent === 'ratified remotely' && button.memory === 1,
    releaseQuiet: released.lastEvent === 'release' && released.memory === 0,
    controls,
    diagnostics
  };
}

async function runBlind(browser, base, label) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&static=1&blind=1`);
  await waitRawReady(page);
  const evidence = await page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV038.getFrame();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: document.querySelector('#lexicon-field')?.getBoundingClientRect().width > 0,
      slotCount: document.querySelectorAll('.lexicon-slot').length,
      memory: state.memory.length,
      controls: hidden('.lexicon-controls') ? 'none' : 'visible',
      readout: hidden('.field-readout') ? 'none' : 'visible',
      note: hidden('.field-note') ? 'none' : 'visible',
      hint: hidden('.field-hint') ? 'none' : 'visible',
      token: hidden('.token-chamber') ? 'none' : 'visible'
    };
  });
  await page.screenshot({ path: path.join(proofDir, `${label}-blind-390x844.png`), fullPage: true });
  await context.close();
  return { ...evidence, diagnostics };
}

async function runReadbacks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const routes = {
    works: '/studio/data/works.json',
    publicCatalog: '/studio/data/catalog-public.json',
    journal: '/journal/',
    current: '/currents/handwriting/',
    canonical: canonicalPath,
    raw: `${rawPath}?preview=1&static=1&blind=1`,
    favicon: '/studio/favicon.svg'
  };
  const result = {};
  for (const [name, route] of Object.entries(routes)) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    if (name === 'journal') await page.waitForSelector('#journal-typography-2026-10-30', { timeout: 15000 });
    if (name === 'current') await page.waitForFunction(() => document.body.innerText.includes('The alphabet votes from the margins.'), null, { timeout: 15000 });
    if (name === 'canonical') await page.waitForSelector(`[data-catalog-work-detail="${workId}"]`, { timeout: 15000 });
    if (name === 'raw') await waitRawReady(page);
    const body = await page.locator('body').innerText().catch(() => '');
    let jsonHasWork = false;
    if (name === 'works' || name === 'publicCatalog') {
      const payload = await response.json();
      const records = name === 'works' ? payload.works : payload.works?.works;
      jsonHasWork = Array.isArray(records) && records.filter((work) => work.id === workId).length === 1;
    }
    const dom = await page.evaluate(({ name, workId }) => ({
      hasJournal: name === 'journal' && Boolean(document.querySelector('#journal-typography-2026-10-30')),
      hasCurrentCard: name === 'current' && Boolean(document.querySelector(`[data-work-id="${workId}"]`)),
      hasCanonicalDetail: name === 'canonical' && Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
      hasRawEngine: name === 'raw' && Boolean(window.__mutineHandwritingV038) || name === 'raw' && [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV038)
    }), { name, workId });
    result[name] = {
      status: response?.status() ?? 0,
      hasWork: jsonHasWork || body.includes(workId) || dom.hasCurrentCard || dom.hasCanonicalDetail || dom.hasRawEngine,
      hasTitle: body.includes('The alphabet votes from the margins.'),
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
  const label = suppliedBase ? 'production' : 'local';
  const matrix = await runMatrix(browser, base, label);
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base, label);
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
  if (matrix.runs.some((run) => !run.fieldVisible && run.route === 'raw')) failures.push('raw field visibility failed');
  if (matrix.runs.some((run) => run.route === 'raw' && run.slotCount !== 7)) failures.push('slot count failed');
  if (matrix.runs.some((run) => run.route === 'canonical' && (!run.detail || !run.title || !run.tableauFirst || !run.raw.fieldVisible))) failures.push('canonical tableau-first gate failed');
  if (overflow) failures.push(`${overflow} viewport overflow failures`);
  if (allDiagnostics.length) failures.push(`${allDiagnostics.length} browser diagnostics`);
  if (!interaction.previewGeometryUnchanged || !interaction.committed || !interaction.remoteChanged || !interaction.sourceQuiet || !interaction.liftRestored || !interaction.buttonCommitted || !interaction.releaseQuiet) failures.push('interaction gate failed');
  if (blind.fieldVisible !== true || blind.slotCount !== 7 || blind.memory !== memoryWindow || blind.controls !== 'none' || blind.readout !== 'none' || blind.note !== 'none' || blind.hint !== 'none' || blind.token !== 'none' || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget} < 44px`);
  if (Object.values(readbacks.result).some((entry) => entry.status !== 200)) failures.push('readback HTTP failure');
  if (!readbacks.result.works.hasWork || !readbacks.result.publicCatalog.hasWork || !readbacks.result.journal.hasJournal || !readbacks.result.current.hasTitle || !readbacks.result.canonical.hasTitle || !readbacks.result.raw.hasWork || readbacks.result.favicon.status !== 200) failures.push('readback content failure');
  output.failures = failures;
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ label, totals: output.totals, interaction: { previewGeometryUnchanged: interaction.previewGeometryUnchanged, committed: interaction.committed, remoteChanged: interaction.remoteChanged, sourceQuiet: interaction.sourceQuiet, liftRestored: interaction.liftRestored, buttonCommitted: interaction.buttonCommitted, releaseQuiet: interaction.releaseQuiet }, blind: { memory: blind.memory, slots: blind.slotCount, widths: [blind.innerWidth, blind.clientWidth, blind.scrollWidth] }, readbacks: readbacks.result, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));
}
