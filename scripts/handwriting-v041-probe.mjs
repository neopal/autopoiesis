import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workId = 'typography-2026-11-03';
const rawPath = '/studies/handwriting/v041/';
const canonicalPath = `/works/${workId}/`;
const suppliedBase = process.env.BASE_URL || '';
const includeCanonical = process.env.RUN_CANONICAL === '1';
const proofDir = path.resolve(root, process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v041-2026-11-03');
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

async function visitRaw(page, base, query = '?preview=1&interaction=1') {
  await page.goto(`${base}${rawPath}${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
}

async function rawEvidence(page) {
  return page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const field = document.querySelector('#negative-field');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      svgVisible: Boolean(document.querySelector('#negative-svg')?.getBoundingClientRect().width),
      glyphCount: document.querySelectorAll('#glyph-layer .glyph-group').length,
      gapCount: document.querySelectorAll('#gap-layer .gap').length,
      controls: [...document.querySelectorAll('.negative-controls button')].map((button) => ({ id: button.dataset.action, height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      hiddenFurniture: { controls: hidden('.negative-controls'), readout: hidden('.negative-readout'), note: hidden('.negative-note'), hint: hidden('.negative-hint'), register: hidden('.svg-register') }
    };
  });
}

async function glyphMarkup(page) {
  return page.evaluate(() => document.querySelector('#glyph-layer').innerHTML);
}

async function stateEvidence(page) {
  return page.evaluate(() => {
    const memory = Number(document.querySelector('[data-memory]').textContent.match(/^\d+/)?.[0] ?? -1);
    return {
      memory,
      stage: document.querySelector('[data-stage]').textContent,
      glyphMarkup: document.querySelector('#glyph-layer').innerHTML,
      remoteGlyphCount: [...document.querySelectorAll('#glyph-layer .glyph-group')].filter((node) => !node.classList.contains('glyph-group--quiet')).length,
      gapMarkup: document.querySelector('#gap-layer').innerHTML,
      visitedGaps: document.querySelectorAll('#gap-layer .gap--visited').length
    };
  });
}

async function clickGap(page, id) {
  await page.locator(`#gap-layer .gap[data-gap-id="${id}"]`).click();
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visitRaw(page, base);
  const baseline = await stateEvidence(page);
  await clickGap(page, 1);
  await clickGap(page, 4);
  const incomplete = await stateEvidence(page);
  await clickGap(page, 7);
  const committed = await stateEvidence(page);
  const visitedExact = committed.gapMarkup === baseline.gapMarkup;
  const untouchedGapSequence = committed.visitedGaps === 0;
  const remoteOnly = committed.remoteGlyphCount === 3;
  await page.locator('[data-action="lift"]').click();
  const lifted = await stateEvidence(page);
  await page.locator('#negative-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const keyboardPending = await stateEvidence(page);
  await page.keyboard.press('Enter');
  const keyboard = await stateEvidence(page);
  await page.locator('[data-action="release"]').click();
  await page.locator('[data-action="read"]').click();
  const button = await stateEvidence(page);
  await page.locator('[data-action="release"]').click();
  const released = await stateEvidence(page);
  const controls = await page.evaluate(() => [...document.querySelectorAll('.negative-controls button')].map((button) => ({ id: button.dataset.action, height: button.getBoundingClientRect().height })));
  await context.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await touchContext.newPage();
  const touchDiagnostics = diagnosticsFor(touchPage);
  await visitRaw(touchPage, base);
  for (const id of [1, 4, 7]) await touchPage.locator(`#gap-layer .gap[data-gap-id="${id}"]`).tap();
  const touch = await stateEvidence(touchPage);
  await touchContext.close();

  return {
    baseline,
    incomplete,
    committed,
    lifted,
    keyboardPending,
    keyboard,
    button,
    released,
    touch,
    sourceAndGapExact: incomplete.glyphMarkup === baseline.glyphMarkup && visitedExact,
    incompleteRefused: incomplete.memory === 0 && incomplete.remoteGlyphCount === 0 && incomplete.visitedGaps === 2,
    committedRemote: committed.memory === 1 && remoteOnly && committed.stage === 'negative syntax recruited',
    liftRestored: lifted.glyphMarkup === baseline.glyphMarkup && lifted.memory === 0,
    keyboardPending: keyboardPending.memory === 0 && keyboardPending.visitedGaps === 3,
    keyboardCommitted: keyboard.memory === 1 && keyboard.remoteGlyphCount === 3,
    buttonCommitted: button.memory === 1 && button.remoteGlyphCount === 3,
    releaseQuiet: released.memory === 0 && released.remoteGlyphCount === 0,
    touchCommitted: touch.memory === 1 && touch.remoteGlyphCount === 3,
    controls,
    diagnostics: [...diagnostics, ...touchDiagnostics]
  };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await visitRaw(page, base, '?preview=1&static=1&blind=1');
  const evidence = await rawEvidence(page);
  const screenshot = path.join(proofDir, 'blind-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();
  return { ...evidence, screenshot, screenshotBytes: (await stat(screenshot)).size, diagnostics };
}

async function canonicalFrame(page, base) {
  await page.goto(`${base}${canonicalPath}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v041/'));
  if (!frame) throw new Error('canonical v041 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window._mutineReady), null, { timeout: 15000 });
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
    title: document.body.innerText.includes('The missing letter makes the word.'),
    tableauFirst: iframeTop !== null && (headingTop === null || iframeTop < headingTop),
    iframeTop,
    headingTop
  }), { iframeTop: iframeBox?.y ?? null, headingTop: headingBox?.y ?? null, targetWorkId: workId });
  return { ...shell, raw: await frame.evaluate(() => ({
    fieldVisible: Boolean(document.querySelector('#negative-field')?.getBoundingClientRect().width),
    svgVisible: Boolean(document.querySelector('#negative-svg')?.getBoundingClientRect().width),
    glyphCount: document.querySelectorAll('#glyph-layer .glyph-group').length
  })) };
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
      await visitRaw(page, base);
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
        const evidenceCanonical = await canonicalEvidence(canonicalPage, frame);
        const canonicalScreenshot = path.join(proofDir, `canonical-${reducedMotion ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`);
        await canonicalPage.screenshot({ path: canonicalScreenshot, fullPage: true });
        runs.push({ route: 'canonical', viewport: `${viewport.width}x${viewport.height}`, mode: reducedMotion ? 'reduced-motion' : 'normal', ...evidenceCanonical, screenshot: canonicalScreenshot, screenshotBytes: (await stat(canonicalScreenshot)).size });
        diagnostics.push(...canonicalDiagnostics);
        await canonicalContext.close();
      }
    }
  }
  return { runs, diagnostics };
}

async function runReadbacks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const result = {};
  const bodyResponse = async (route, waitFor) => {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    if (waitFor) await waitFor();
    return { status: response?.status() ?? 0, body: await page.locator('body').innerText().catch(() => '') };
  };
  const worksResponse = await page.goto(`${base}/studio/data/works.json`, { waitUntil: 'networkidle' });
  const worksPayload = await worksResponse.json();
  result.works = { status: worksResponse.status(), hasWork: worksPayload.works.filter((work) => work.id === workId).length === 1 };
  const catalogResponse = await page.goto(`${base}/studio/data/catalog-public.json`, { waitUntil: 'networkidle' });
  const catalogPayload = await catalogResponse.json();
  result.publicCatalog = { status: catalogResponse.status(), hasWork: catalogPayload.works.works.filter((work) => work.id === workId).length === 1 };
  result.journal = await bodyResponse('/journal/', async () => page.waitForSelector('#journal-typography-2026-11-03', { timeout: 15000 }));
  result.journal.hasAnchor = Boolean(await page.locator('#journal-typography-2026-11-03').count());
  result.journal.hasTitle = result.journal.body.includes('The missing letter makes the word.');
  result.current = await bodyResponse('/currents/handwriting/', async () => page.waitForFunction(() => document.body.innerText.includes('The missing letter makes the word.'), null, { timeout: 15000 }));
  result.current.hasCard = Boolean(await page.locator(`[data-work-id="${workId}"]`).count());
  result.canonical = await bodyResponse(canonicalPath, async () => page.waitForSelector(`[data-catalog-work-detail="${workId}"][data-ready="true"]`, { timeout: 15000 }));
  result.canonical.hasDetail = Boolean(await page.locator(`[data-catalog-work-detail="${workId}"]`).count());
  result.raw = await bodyResponse(`${rawPath}?preview=1&static=1&blind=1`, async () => page.waitForFunction(() => Boolean(window._mutineReady), null, { timeout: 15000 }));
  result.raw.hasEngine = Boolean(await page.evaluate(() => Boolean(window._mutineReady)));
  const favicon = await page.goto(`${base}/studio/favicon.svg`, { waitUntil: 'networkidle' });
  result.favicon = { status: favicon?.status() ?? 0 };
  await context.close();
  return { result, diagnostics };
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
  if (matrix.runs.length !== (includeCanonical ? 20 : 10)) failures.push(`matrix must contain ${includeCanonical ? 20 : 10} runs`);
  if (matrix.runs.filter((run) => run.route === 'raw').some((run) => !run.fieldVisible || !run.svgVisible || run.glyphCount !== 12 || run.gapCount !== 9)) failures.push('raw field visibility or primitive count failed');
  if (includeCanonical && matrix.runs.filter((run) => run.route === 'canonical').some((run) => !run.detail || !run.title || !run.tableauFirst || !run.raw.fieldVisible || !run.raw.svgVisible || run.raw.glyphCount !== 12)) failures.push('canonical tableau-first gate failed');
  if (overflow) failures.push(`${overflow} viewport overflow failures`);
  if (diagnostics.length) failures.push(`${diagnostics.length} browser diagnostics`);
  if (!interaction.incompleteRefused || !interaction.committedRemote || !interaction.sourceAndGapExact || !interaction.liftRestored || !interaction.keyboardPending || !interaction.keyboardCommitted || !interaction.buttonCommitted || !interaction.releaseQuiet || !interaction.touchCommitted) failures.push('interaction gate failed');
  if (blind.fieldVisible !== true || blind.svgVisible !== true || blind.glyphCount !== 12 || blind.gapCount !== 9 || !blind.hiddenFurniture.controls || !blind.hiddenFurniture.readout || !blind.hiddenFurniture.note || !blind.hiddenFurniture.hint || !blind.hiddenFurniture.register || blind.scrollWidth > blind.innerWidth) failures.push('blind preview gate failed');
  if (minTouchTarget < 44) failures.push(`touch target ${minTouchTarget} < 44px`);
  if (includeCanonical && (!readbacks.result.works.hasWork || !readbacks.result.publicCatalog.hasWork || readbacks.result.journal.status !== 200 || !readbacks.result.journal.hasAnchor || !readbacks.result.journal.hasTitle || readbacks.result.current.status !== 200 || !readbacks.result.current.hasCard || readbacks.result.canonical.status !== 200 || !readbacks.result.canonical.hasDetail || readbacks.result.raw.status !== 200 || !readbacks.result.raw.hasEngine || readbacks.result.favicon.status !== 200)) failures.push('local route or catalog readback failed');
  output.failures = failures;
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: output.totals, interaction: { incompleteRefused: interaction.incompleteRefused, committedRemote: interaction.committedRemote, sourceAndGapExact: interaction.sourceAndGapExact, liftRestored: interaction.liftRestored, keyboardPending: interaction.keyboardPending, keyboardCommitted: interaction.keyboardCommitted, buttonCommitted: interaction.buttonCommitted, releaseQuiet: interaction.releaseQuiet, touchCommitted: interaction.touchCommitted }, blind: { glyphs: blind.glyphCount, gaps: blind.gapCount, widths: [blind.innerWidth, blind.clientWidth, blind.scrollWidth] }, readbacks: readbacks?.result ?? null, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  local?.server.close();
}
