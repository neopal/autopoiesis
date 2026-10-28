import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-10-28';
const MEMORY_WINDOW = 4;
const rawPath = '/studies/handwriting/v036/';
const canonicalPath = `/works/${workId}/`;
const proofDir = path.resolve(root, process.env.PROOF_DIR || `research/qa/proofs/handwriting-v036-2026-10-28`);
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
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV036));
  return page;
}

async function canonicalFrame(page) {
  await page.waitForFunction(() => Boolean([...document.querySelectorAll('iframe')].find((frame) => frame.contentWindow?.__mutineHandwritingV036)));
  return page.frames().find((frame) => frame.url().includes('/studies/handwriting/v036/'));
}

async function rawMetrics(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#phoneme-field');
    const canvas = document.querySelector('#phoneme-canvas');
    const frameState = window.__mutineHandwritingV036?.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
      fieldWidth: field?.getBoundingClientRect().width ?? 0,
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      slotCount: frameState?.slots.length ?? 0,
      memory: frameState?.memory.length ?? 0,
      controls: [...document.querySelectorAll('.phoneme-controls button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
      signature: window.__mutineHandwritingV036?.getSignature()
    };
  });
}

async function canonicalMetrics(page) {
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  const iframe = page.locator('iframe').first();
  await canonicalFrame(page);
  const iframeBox = await iframe.boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  return page.evaluate(({ iframeTop, headingTop, workId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
    title: document.body.innerText.includes('The sentence answers from its margins.'),
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
      const frame = await waitRawReady(rawPage);
      const raw = await rawMetrics(frame);
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
  const frame = await waitRawReady(page);
  const baseline = await frame.evaluate(() => ({ signature: window.__mutineHandwritingV036.getSignature(), state: window.__mutineHandwritingV036.getState() }));
  const field = frame.locator('#phoneme-field');
  const box = await field.boundingBox();
  if (!box) throw new Error('phoneme field has no box');
  await page.mouse.move(box.x + box.width * .22, box.y + box.height * .36);
  const attended = await frame.evaluate(() => ({ signature: window.__mutineHandwritingV036.getSignature(), state: window.__mutineHandwritingV036.getState() }));
  await frame.locator('#speech-input').fill('murmur');
  await frame.locator('#speech-input').press('Enter');
  const spoken = await frame.evaluate(() => ({ signature: window.__mutineHandwritingV036.getSignature(), state: window.__mutineHandwritingV036.getState(), frame: window.__mutineHandwritingV036.getFrame() }));
  await field.focus();
  await page.keyboard.press('Delete');
  const lifted = await frame.evaluate(() => ({ signature: window.__mutineHandwritingV036.getSignature(), state: window.__mutineHandwritingV036.getState() }));

  await visit(page, base, `${rawPath}?preview=1&interaction=1`);
  const keyboardFrame = await waitRawReady(page);
  await keyboardFrame.locator('#phoneme-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await keyboardFrame.evaluate(() => window.__mutineHandwritingV036.getState());
  await keyboardFrame.locator('#release-speech').click();
  const released = await keyboardFrame.evaluate(() => window.__mutineHandwritingV036.getState());
  const controls = await keyboardFrame.evaluate(() => [...document.querySelectorAll('.phoneme-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })));
  await context.close();
  return {
    baseline,
    attended,
    spoken: { state: spoken.state, changedSlotIds: spoken.frame.changedSlotIds, remoteChange: spoken.frame.changedSlotIds.some((id) => id !== attended.state.active) },
    lifted,
    keyboard,
    released,
    previewGeometryUnchanged: baseline.signature === attended.signature,
    committed: spoken.state.lastEvent === 'spoken' && spoken.state.memory === 1,
    changedGeometry: spoken.signature !== baseline.signature,
    liftRestored: lifted.state.lastEvent === 'lifted' && lifted.signature === baseline.signature,
    keyboardCommitted: keyboard.lastEvent === 'spoken' && keyboard.memory === 1,
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
  const frame = await waitRawReady(page);
  const evidence = await frame.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV036.getFrame();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: document.querySelector('#phoneme-canvas')?.width > 0,
      slotCount: state.slots.length,
      memory: state.memory.length,
      controls: hidden('.phoneme-controls') ? 'none' : 'visible',
      readout: hidden('.field-readout') ? 'none' : 'visible',
      hint: hidden('.field-hint') ? 'none' : 'visible',
      mark: hidden('.field-mark') ? 'none' : 'visible'
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
    if (name === 'journal') await page.waitForSelector('#journal-typography-2026-10-28', { timeout: 15000 });
    if (name === 'current') await page.waitForFunction(() => document.body.innerText.includes('The sentence answers from its margins.'), null, { timeout: 15000 });
    if (name === 'canonical') await page.waitForSelector(`[data-catalog-work-detail="${workId}"]`, { timeout: 15000 });
    if (name === 'raw') await waitRawReady(page);
    const body = await page.locator('body').innerText().catch(() => '');
    const dom = await page.evaluate(({ name, workId }) => ({
      hasJournal: name === 'journal' && Boolean(document.querySelector('#journal-typography-2026-10-28')),
      hasCurrentCard: name === 'current' && Boolean(document.querySelector(`[data-work-id="${workId}"]`)),
      hasCanonicalDetail: name === 'canonical' && Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
      hasRawEngine: name === 'raw' && Boolean(window.__mutineHandwritingV036) || name === 'raw' && [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV036)
    }), { name, workId });
    result[name] = {
      status: response?.status() ?? 0,
      hasWork: body.includes(workId) || dom.hasCurrentCard || dom.hasCanonicalDetail || dom.hasRawEngine,
      hasTitle: body.includes('The sentence answers from its margins.'),
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
  if (!interaction.previewGeometryUnchanged || !interaction.committed || !interaction.changedGeometry || !interaction.liftRestored || !interaction.keyboardCommitted || !interaction.releaseQuiet || interaction.spoken.remoteChange !== true) failures.push('interaction gate failed');
  if (blind.canvasVisible !== true || blind.memory !== MEMORY_WINDOW || blind.controls !== 'none' || blind.readout !== 'none' || blind.hint !== 'none' || blind.mark !== 'none' || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget}`);
  const coreReadbacksOk = ['works', 'publicCatalog', 'journal', 'current', 'canonical', 'raw'].every((name) => readbacks.result[name]?.status === 200 && (readbacks.result[name].hasWork || readbacks.result[name].hasJournal));
  if (!coreReadbacksOk || readbacks.result.favicon?.status !== 200) failures.push('readback gate failed');
  await (await import('node:fs/promises')).writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: output.interaction, blindPreview: output.blindPreview, readbacks: output.readbacks.result, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));
}
