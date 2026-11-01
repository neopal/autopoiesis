import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-11-02';
const rawPath = '/studies/handwriting/v040/';
const canonicalPath = `/works/${workId}/`;
const suppliedBase = process.env.BASE_URL || '';
const includeCanonical = process.env.RUN_CANONICAL === '1';
const proofDir = path.resolve(root, process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v040-2026-11-02');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
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
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
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
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.push(`http:${response.status()}:${response.url()}`); });
  return diagnostics;
}

async function visit(page, base, route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV040));
}

async function chamberPoint(page, id) {
  return page.evaluate((chamberId) => {
    const field = document.querySelector('#pressure-field');
    const rect = field.getBoundingClientRect();
    const chamber = window.__mutineHandwritingV040.getChambers()[chamberId];
    return { x: rect.left + chamber.x * rect.width, y: rect.top + chamber.y * rect.height };
  }, id);
}

async function rawEvidence(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#pressure-field');
    const state = window.__mutineHandwritingV040.getFrame();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      canvasVisible: Boolean(document.querySelector('#pressure-canvas')?.getBoundingClientRect().width),
      chamberCount: state.field.chambers.length,
      memory: state.memory.length,
      controls: [...document.querySelectorAll('.pressure-controls button')].map((button) => ({ id: button.dataset.action, height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  });
}

async function canonicalFrame(page, base) {
  await page.goto(`${base}${canonicalPath}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineHandwritingV040), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v040/'));
  if (!frame) throw new Error('canonical v040 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window.__mutineHandwritingV040), null, { timeout: 15000 });
  return frame;
}

async function canonicalEvidence(page, frame) {
  const iframeBox = await page.locator('.work-inspect__stage iframe').first().boundingBox();
  const headingBox = await page.locator('.work-inspect__heading h1').first().boundingBox();
  const shell = await page.evaluate(({ iframeTop, headingTop, targetWorkId }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${targetWorkId}"]`)),
    title: document.body.innerText.includes('The letter keeps its pressure debt.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, targetWorkId: workId });
  return { ...shell, raw: await frame.evaluate(() => ({
    fieldVisible: Boolean(document.querySelector('#pressure-field')?.getBoundingClientRect().width),
    canvasVisible: Boolean(document.querySelector('#pressure-canvas')?.getBoundingClientRect().width),
    chamberCount: window.__mutineHandwritingV040.getFrame().field.chambers.length
  })) };
}

async function runReadbacks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const result = {};
  const responseFor = async (name, route, wait) => {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    if (wait) await wait();
    const body = await page.locator('body').innerText().catch(() => '');
    return { status: response?.status() ?? 0, body };
  };
  const worksResponse = await page.goto(`${base}/studio/data/works.json`, { waitUntil: 'networkidle' });
  const worksPayload = await worksResponse.json();
  result.works = { status: worksResponse.status(), hasWork: worksPayload.works.filter((work) => work.id === workId).length === 1 };
  const catalogResponse = await page.goto(`${base}/studio/data/catalog-public.json`, { waitUntil: 'networkidle' });
  const catalogPayload = await catalogResponse.json();
  result.publicCatalog = { status: catalogResponse.status(), hasWork: catalogPayload.works.works.filter((work) => work.id === workId).length === 1 };
  result.journal = await responseFor('journal', '/journal/', async () => page.waitForSelector('#journal-typography-2026-11-02', { timeout: 15000 }));
  result.journal.hasAnchor = Boolean(await page.locator('#journal-typography-2026-11-02').count());
  result.journal.hasTitle = result.journal.body.includes('The letter keeps its pressure debt.');
  result.current = await responseFor('current', '/currents/handwriting/', async () => page.waitForFunction(() => document.body.innerText.includes('The letter keeps its pressure debt.'), null, { timeout: 15000 }));
  result.current.hasCard = Boolean(await page.locator(`[data-work-id="${workId}"]`).count());
  result.canonical = await responseFor('canonical', canonicalPath, async () => page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 }));
  result.canonical.hasDetail = Boolean(await page.locator(`[data-catalog-work-detail="${workId}"]`).count());
  result.raw = await responseFor('raw', `${rawPath}?preview=1&static=1&blind=1`, async () => page.waitForFunction(() => Boolean(window.__mutineHandwritingV040), null, { timeout: 15000 }));
  result.raw.hasEngine = Boolean(await page.evaluate(() => Boolean(window.__mutineHandwritingV040)));
  const favicon = await page.goto(`${base}/studio/favicon.svg`, { waitUntil: 'networkidle' });
  result.favicon = { status: favicon?.status() ?? 0 };
  await context.close();
  return { result, diagnostics };
}

async function runMatrix(browser, base) {
  const runs = [];
  const diagnostics = [];
  await mkdir(proofDir, { recursive: true });
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const pageDiagnostics = diagnosticsFor(page);
      await visit(page, base, `${rawPath}?preview=1&interaction=1`);
      const evidence = await rawEvidence(page);
      const screenshot = path.join(proofDir, `raw-${reducedMotion ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      runs.push({ route: 'raw', viewport: `${viewport.width}x${viewport.height}`, mode: reducedMotion ? 'reduced-motion' : 'normal', ...evidence, screenshot, screenshotBytes: (await stat(screenshot)).size });
      diagnostics.push(...pageDiagnostics);
      await context.close();

      if (includeCanonical) {
        const canonicalContext = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        const canonicalPage = await canonicalContext.newPage();
        const canonicalDiagnostics = diagnosticsFor(canonicalPage);
        const frame = await canonicalFrame(canonicalPage, base);
        const canonical = await canonicalEvidence(canonicalPage, frame);
        const canonicalScreenshot = path.join(proofDir, `canonical-${reducedMotion ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`);
        await canonicalPage.screenshot({ path: canonicalScreenshot, fullPage: true });
        runs.push({ route: 'canonical', viewport: `${viewport.width}x${viewport.height}`, mode: reducedMotion ? 'reduced-motion' : 'normal', ...canonical, screenshot: canonicalScreenshot, screenshotBytes: (await stat(canonicalScreenshot)).size });
        diagnostics.push(...canonicalDiagnostics);
        await canonicalContext.close();
      }
    }
  }
  return { runs, diagnostics };
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&interaction=1`);
  const baseline = await page.evaluate(() => ({ signature: window.__mutineHandwritingV040.getSignature(), chambers: window.__mutineHandwritingV040.getChambers() }));
  const point = await chamberPoint(page, 2);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(240);
  await page.mouse.up();
  const refused = await page.evaluate(() => ({ signature: window.__mutineHandwritingV040.getSignature(), state: window.__mutineHandwritingV040.getState() }));

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();
  const committed = await page.evaluate(() => ({ signature: window.__mutineHandwritingV040.getSignature(), state: window.__mutineHandwritingV040.getState(), chambers: window.__mutineHandwritingV040.getChambers() }));
  const sourceExact = JSON.stringify(baseline.chambers[2]) === JSON.stringify(committed.chambers[2]);
  await page.locator('[data-action="lift"]').click();
  const lifted = await page.evaluate(() => ({ signature: window.__mutineHandwritingV040.getSignature(), state: window.__mutineHandwritingV040.getState() }));
  await page.locator('#pressure-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineHandwritingV040.getState());
  await page.locator('[data-action="press"]').click();
  const button = await page.evaluate(() => window.__mutineHandwritingV040.getState());
  await page.locator('[data-action="release"]').click();
  const released = await page.evaluate(() => window.__mutineHandwritingV040.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.pressure-controls button')].map((button) => ({ id: button.dataset.action, height: button.getBoundingClientRect().height })));
  await context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await touchContext.newPage();
  const touchDiagnostics = diagnosticsFor(touchPage);
  await visit(touchPage, base, `${rawPath}?preview=1&interaction=1`);
  const touchPoint = await chamberPoint(touchPage, 0);
  await touchPage.evaluate(({ x, y }) => {
    const field = document.querySelector('#pressure-field');
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y }));
  }, touchPoint);
  await touchPage.waitForTimeout(720);
  await touchPage.evaluate(({ x, y }) => {
    const field = document.querySelector('#pressure-field');
    field.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11, pointerType: 'touch', clientX: x, clientY: y }));
  }, touchPoint);
  const touch = await touchPage.evaluate(() => window.__mutineHandwritingV040.getState());
  await touchContext.close();

  return {
    baseline,
    refused,
    committed,
    lifted,
    keyboard,
    button,
    released,
    touch,
    sourceExact,
    previewGeometryUnchanged: refused.state.memory === 0 && refused.signature === baseline.signature,
    shortRefused: refused.state.lastEvent === 'refused pressure',
    committedRemote: committed.state.lastEvent === 'pressure debt transferred' && committed.state.memory === 1 && committed.state.changedChamberIds.length === 3,
    liftRestored: lifted.state.lastEvent === 'lifted latest' && lifted.signature === baseline.signature,
    keyboardCommitted: keyboard.lastEvent === 'pressure debt transferred' && keyboard.memory === 1,
    buttonCommitted: button.lastEvent === 'pressure debt transferred' && button.memory === 2,
    releaseQuiet: released.lastEvent === 'release' && released.memory === 0,
    touchCommitted: touch.lastEvent === 'pressure debt transferred' && touch.memory === 1,
    controls,
    diagnostics: [...diagnostics, ...touchDiagnostics]
  };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visit(page, base, `${rawPath}?preview=1&static=1&blind=1`);
  const evidence = await page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV040.getFrame();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(document.querySelector('#pressure-field')?.getBoundingClientRect().width),
      canvasVisible: Boolean(document.querySelector('#pressure-canvas')?.getBoundingClientRect().width),
      chamberCount: state.field.chambers.length,
      memory: state.memory.length,
      controls: hidden('.pressure-controls') ? 'none' : 'visible',
      readout: hidden('.pressure-readout') ? 'none' : 'visible',
      note: hidden('.pressure-note') ? 'none' : 'visible',
      hint: hidden('.pressure-hint') ? 'none' : 'visible'
    };
  });
  const screenshot = path.join(proofDir, 'blind-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();
  return { ...evidence, screenshot, screenshotBytes: (await stat(screenshot)).size, diagnostics };
}

const local = suppliedBase ? null : await localServer();
const base = suppliedBase || local.base;
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = await runMatrix(browser, base);
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base);
  const readbacks = includeCanonical ? await runReadbacks(browser, base) : null;
  const diagnostics = [...matrix.diagnostics, ...interaction.diagnostics, ...blind.diagnostics, ...(readbacks?.diagnostics ?? [])];
  const overflow = matrix.runs.filter((run) => run.innerWidth !== run.clientWidth || run.scrollWidth > run.innerWidth).length;
  const minTouchTarget = Math.min(...interaction.controls.map((control) => control.height));
  const output = {
    base,
    matrix: matrix.runs,
    interaction,
    blindPreview: blind,
    readbacks,
    totals: { matrixRuns: matrix.runs.length, rawRuns: matrix.runs.filter((run) => run.route === 'raw').length, canonicalRuns: matrix.runs.filter((run) => run.route === 'canonical').length, diagnostics: diagnostics.length, overflowFailures: overflow, minTouchTarget }
  };
  const failures = [];
  const expectedMatrixRuns = includeCanonical ? 20 : 10;
  if (matrix.runs.length !== expectedMatrixRuns) failures.push(`matrix must contain ${expectedMatrixRuns} runs`);
  if (matrix.runs.filter((run) => run.route === 'raw').some((run) => !run.fieldVisible || !run.canvasVisible || run.chamberCount !== 9)) failures.push('raw field visibility or chamber count failed');
  if (includeCanonical && matrix.runs.filter((run) => run.route === 'canonical').some((run) => !run.detail || !run.title || !run.tableauFirst || !run.raw.fieldVisible || !run.raw.canvasVisible || run.raw.chamberCount !== 9)) failures.push('canonical tableau-first gate failed');
  if (overflow) failures.push(`${overflow} viewport overflow failures`);
  if (diagnostics.length) failures.push(`${diagnostics.length} browser diagnostics`);
  if (!interaction.previewGeometryUnchanged || !interaction.shortRefused || !interaction.committedRemote || !interaction.sourceExact || !interaction.liftRestored || !interaction.keyboardCommitted || !interaction.buttonCommitted || !interaction.releaseQuiet || !interaction.touchCommitted) failures.push('interaction gate failed');
  if (blind.fieldVisible !== true || blind.canvasVisible !== true || blind.chamberCount !== 9 || blind.memory !== 4 || blind.controls !== 'none' || blind.readout !== 'none' || blind.note !== 'none' || blind.hint !== 'none' || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget} < 44px`);
  if (includeCanonical && (!readbacks.result.works.hasWork || !readbacks.result.publicCatalog.hasWork || readbacks.result.journal.status !== 200 || !readbacks.result.journal.hasAnchor || !readbacks.result.journal.hasTitle || readbacks.result.current.status !== 200 || !readbacks.result.current.hasCard || readbacks.result.canonical.status !== 200 || !readbacks.result.canonical.hasDetail || readbacks.result.raw.status !== 200 || !readbacks.result.raw.hasEngine || readbacks.result.favicon.status !== 200)) failures.push('local route or catalog readback failed');
  output.failures = failures;
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: { previewGeometryUnchanged: interaction.previewGeometryUnchanged, shortRefused: interaction.shortRefused, committedRemote: interaction.committedRemote, sourceExact: interaction.sourceExact, liftRestored: interaction.liftRestored, keyboardCommitted: interaction.keyboardCommitted, buttonCommitted: interaction.buttonCommitted, releaseQuiet: interaction.releaseQuiet, touchCommitted: interaction.touchCommitted }, blind: { memory: blind.memory, chambers: blind.chamberCount, widths: [blind.innerWidth, blind.clientWidth, blind.scrollWidth] }, readbacks: readbacks?.result ?? null, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));
}
