import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-11-01';
const rawPath = '/studies/handwriting/v039/';
const canonicalPath = `/works/${workId}/`;
const memoryWindow = 4;
const proofDir = path.resolve(root, process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v039-2026-11-01');
const suppliedBase = process.env.BASE_URL || '';
const includeCanonical = process.env.RUN_CANONICAL === '1';
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
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV039));
  return page;
}

async function rawMetrics(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#route-field');
    const state = window.__mutineHandwritingV039?.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      fieldWidth: field?.getBoundingClientRect().width ?? 0,
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      canvasVisible: Boolean(document.querySelector('#route-canvas')?.getBoundingClientRect().width),
      junctionCount: state?.field.junctions.length ?? 0,
      memory: state?.memory.length ?? 0,
      controls: [...document.querySelectorAll('.route-controls button')].map((button) => ({ id: button.dataset.action, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
    };
  });
}

async function canonicalMetrics(page) {
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV039), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v039/'));
  const iframeBox = await page.locator('iframe').first().boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  const outer = await page.evaluate(({ iframeTop, headingTop, workId: targetWorkId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${targetWorkId}"]`)),
    title: document.body.innerText.includes('The route forgets its first letter.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, workId });
  return { ...outer, raw: await frame.evaluate(() => ({
    fieldVisible: Boolean(document.querySelector('#route-field')?.getBoundingClientRect().width),
    junctionCount: window.__mutineHandwritingV039.getFrame().field.junctions.length
  })) };
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

      if (includeCanonical) {
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
  }
  return { runs, diagnostics };
}

async function junctionPoint(page, id) {
  return page.evaluate((junctionId) => {
    const field = document.querySelector('#route-field');
    const rect = field.getBoundingClientRect();
    const junction = window.__mutineHandwritingV039.getJunctions()[junctionId];
    return { x: rect.left + junction.x * rect.width, y: rect.top + junction.y * rect.height };
  }, id);
}

async function clickRoute(page, ids) {
  for (const id of ids) {
    const point = await junctionPoint(page, id);
    await page.mouse.click(point.x, point.y);
  }
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&interaction=1`);
  await waitRawReady(page);
  const baseline = await page.evaluate(() => ({ signature: window.__mutineHandwritingV039.getSignature(), junctions: window.__mutineHandwritingV039.getJunctions() }));
  await page.locator('#route-field').focus();
  await clickRoute(page, [0, 3, 7, 10]);
  const after = await page.evaluate(() => ({ signature: window.__mutineHandwritingV039.getSignature(), state: window.__mutineHandwritingV039.getState(), junctions: window.__mutineHandwritingV039.getJunctions() }));
  const selectedExact = [0, 3, 7, 10].every((id) => JSON.stringify(baseline.junctions[id]) === JSON.stringify(after.junctions[id]));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ signature: window.__mutineHandwritingV039.getSignature(), state: window.__mutineHandwritingV039.getState() }));
  const field = page.locator('#route-field');
  await field.focus();
  for (let index = 0; index < 4; index += 1) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineHandwritingV039.getState());
  await page.locator('[data-action="rewire"]').click();
  const button = await page.evaluate(() => window.__mutineHandwritingV039.getState());
  await page.locator('[data-action="release"]').click();
  const released = await page.evaluate(() => window.__mutineHandwritingV039.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.route-controls button')].map((button) => ({ id: button.dataset.action, height: button.getBoundingClientRect().height })));
  await context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await touchContext.newPage();
  const touchDiagnostics = diagnosticsFor(touchPage);
  await visit(touchPage, base, `${rawPath}?preview=1&interaction=1`);
  await waitRawReady(touchPage);
  for (const id of [0, 3, 7, 10]) {
    const point = await junctionPoint(touchPage, id);
    await touchPage.touchscreen.tap(point.x, point.y);
  }
  const touch = await touchPage.evaluate(() => window.__mutineHandwritingV039.getState());
  await touchContext.close();

  return {
    baseline,
    after,
    lifted,
    keyboard,
    button,
    released,
    touch,
    selectedExact,
    previewGeometryUnchanged: after.state.memory === 1 && after.state.changedJunctionIds.every((id) => ![0, 3, 7, 10].includes(id)),
    committed: after.state.lastEvent === 'route rewired remotely' && after.state.memory === 1,
    remoteChanged: after.state.changedJunctionIds.length === 3 && after.signature !== baseline.signature,
    liftRestored: lifted.state.lastEvent === 'lifted latest' && lifted.signature === baseline.signature,
    keyboardCommitted: keyboard.lastEvent === 'route rewired remotely' && keyboard.memory === 1,
    buttonCommitted: button.lastEvent === 'route rewired remotely' && button.memory === 2,
    releaseQuiet: released.lastEvent === 'release' && released.memory === 0,
    touchCommitted: touch.lastEvent === 'route rewired remotely' && touch.memory === 1,
    controls,
    diagnostics: [...diagnostics, ...touchDiagnostics]
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
    const state = window.__mutineHandwritingV039.getFrame();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: document.querySelector('#route-field')?.getBoundingClientRect().width > 0,
      canvasVisible: document.querySelector('#route-canvas')?.getBoundingClientRect().width > 0,
      junctionCount: state.field.junctions.length,
      memory: state.memory.length,
      controls: hidden('.route-controls') ? 'none' : 'visible',
      readout: hidden('.route-readout') ? 'none' : 'visible',
      note: hidden('.route-note') ? 'none' : 'visible',
      hint: hidden('.route-hint') ? 'none' : 'visible'
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
    if (name === 'journal') await page.waitForSelector('#journal-typography-2026-11-01', { timeout: 15000 });
    if (name === 'current') await page.waitForFunction(() => document.body.innerText.includes('The route forgets its first letter.'), null, { timeout: 15000 });
    if (name === 'canonical') await page.waitForSelector(`[data-catalog-work-detail="${workId}"]`, { timeout: 15000 });
    if (name === 'raw') await waitRawReady(page);
    const body = await page.locator('body').innerText().catch(() => '');
    let jsonHasWork = false;
    if (name === 'works' || name === 'publicCatalog') {
      const payload = await response.json();
      const records = name === 'works' ? payload.works : payload.works?.works;
      jsonHasWork = Array.isArray(records) && records.filter((work) => work.id === workId).length === 1;
    }
    const dom = await page.evaluate(({ name, workId: targetWorkId }) => ({
      hasJournal: name === 'journal' && Boolean(document.querySelector('#journal-typography-2026-11-01')),
      hasCurrentCard: name === 'current' && Boolean(document.querySelector(`[data-work-id="${targetWorkId}"]`)),
      hasCanonicalDetail: name === 'canonical' && Boolean(document.querySelector(`[data-catalog-work-detail="${targetWorkId}"]`)),
      hasRawEngine: name === 'raw' && Boolean(window.__mutineHandwritingV039) || name === 'raw' && [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV039)
    }), { name, workId });
    result[name] = {
      status: response?.status() ?? 0,
      hasWork: jsonHasWork || body.includes(workId) || dom.hasCurrentCard || dom.hasCanonicalDetail || dom.hasRawEngine,
      hasTitle: body.includes('The route forgets its first letter.'),
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
  const readbacks = includeCanonical ? await runReadbacks(browser, base) : null;
  const allDiagnostics = [...matrix.diagnostics, ...interaction.diagnostics, ...blind.diagnostics, ...(readbacks?.diagnostics ?? [])];
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
  if (matrix.runs.length !== (includeCanonical ? 20 : 10)) failures.push(`matrix must contain ${includeCanonical ? 20 : 10} runs`);
  if (matrix.runs.some((run) => run.route === 'raw' && (!run.fieldVisible || !run.canvasVisible || run.junctionCount !== 12))) failures.push('raw field visibility or junction count failed');
  if (includeCanonical && matrix.runs.some((run) => run.route === 'canonical' && (!run.detail || !run.title || !run.tableauFirst || !run.raw.fieldVisible))) failures.push('canonical tableau-first gate failed');
  if (overflow) failures.push(`${overflow} viewport overflow failures`);
  if (allDiagnostics.length) failures.push(`${allDiagnostics.length} browser diagnostics`);
  if (!interaction.previewGeometryUnchanged || !interaction.committed || !interaction.remoteChanged || !interaction.selectedExact || !interaction.liftRestored || !interaction.keyboardCommitted || !interaction.buttonCommitted || !interaction.releaseQuiet || !interaction.touchCommitted) failures.push('interaction gate failed');
  if (blind.fieldVisible !== true || blind.canvasVisible !== true || blind.junctionCount !== 12 || blind.memory !== memoryWindow || blind.controls !== 'none' || blind.readout !== 'none' || blind.note !== 'none' || blind.hint !== 'none' || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget} < 44px`);
  if (includeCanonical && Object.values(readbacks.result).some((entry) => entry.status !== 200)) failures.push('readback HTTP failure');
  if (includeCanonical && (!readbacks.result.works.hasWork || !readbacks.result.publicCatalog.hasWork || !readbacks.result.journal.hasJournal || !readbacks.result.current.hasTitle || !readbacks.result.canonical.hasTitle || !readbacks.result.raw.hasWork || readbacks.result.favicon.status !== 200)) failures.push('readback content failure');
  output.failures = failures;
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ label, totals: output.totals, interaction: { previewGeometryUnchanged: interaction.previewGeometryUnchanged, committed: interaction.committed, remoteChanged: interaction.remoteChanged, selectedExact: interaction.selectedExact, liftRestored: interaction.liftRestored, keyboardCommitted: interaction.keyboardCommitted, buttonCommitted: interaction.buttonCommitted, releaseQuiet: interaction.releaseQuiet, touchCommitted: interaction.touchCommitted }, blind: { memory: blind.memory, junctions: blind.junctionCount, widths: [blind.innerWidth, blind.clientWidth, blind.scrollWidth] }, readbacks: readbacks?.result ?? null, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));
}
