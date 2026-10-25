import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/handwriting-v033-2026-10-25');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/handwriting/v033/?preview=1&interaction=1';
const blindPath = '/studies/handwriting/v033/?preview=1&static=1&blind=1';
const canonicalPath = '/works/typography-2026-10-25/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitRaw(page) {
  await page.waitForFunction(() => window._p5Ready === true && window.__mutineHandwritingV033, null, { timeout: 10000 });
  await page.waitForTimeout(80);
}

async function waitCanonical(page) {
  await page.waitForSelector('[data-ready="true"]', { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v033/'));
  if (!frame) throw new Error('canonical page did not mount the v033 raw frame');
  await frame.waitForFunction(() => window._p5Ready === true && window.__mutineHandwritingV033, null, { timeout: 10000 });
  return frame;
}

async function measure(context, route, url, width, height, reduced, prefix = '') {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  const frame = route === 'raw' ? (await waitRaw(page), null) : await waitCanonical(page);
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    opening: document.querySelector('.route-opening, .work-inspect__heading')?.getBoundingClientRect().toJSON() ?? null,
    firstArtwork: document.querySelector('.route-work, .work-inspect__stage iframe')?.getBoundingClientRect().toJSON() ?? null
  }));
  const scope = frame ?? page.mainFrame();
  const tableau = await scope.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: document.querySelector('#material-field')?.getBoundingClientRect().toJSON() ?? null,
    glyphCount: document.querySelectorAll('#glyph-layer [data-glyph-id]').length,
    wellCount: document.querySelectorAll('#well-layer [data-well-id]').length,
    memory: document.querySelector('#material-field')?.dataset.memory ?? null,
    stage: document.querySelector('#material-field')?.dataset.stage ?? null
  }));
  await page.screenshot({ path: join(proofDir, `${prefix}${route}-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`), fullPage: true });
  const result = { route, url, width, height, reduced, metrics, tableau, diagnostics };
  await page.close();
  return result;
}

async function clickWell(page, index) {
  await page.evaluate((id) => {
    const svg = document.querySelector('#material-svg');
    const well = window.__mutineHandwritingV033.getFrame().wells[id];
    const rect = svg.getBoundingClientRect();
    const point = { x: rect.left + well.x * rect.width, y: rect.top + well.y * rect.height };
    window.__mutineProbePoint = point;
  }, index);
  const point = await page.evaluate(() => window.__mutineProbePoint);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(60);
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitRaw(page);
  const field = page.locator('#material-field');
  const initialSignature = await field.getAttribute('data-signature');
  await clickWell(page, 0);
  const partial = {
    span: await field.getAttribute('data-span'),
    memory: await field.getAttribute('data-memory'),
    geometryUnchanged: initialSignature === await field.getAttribute('data-signature'),
    stage: await field.getAttribute('data-stage')
  };
  await clickWell(page, 3);
  const committed = {
    span: await field.getAttribute('data-span'),
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== await field.getAttribute('data-signature'),
    changedGlyphIds: await page.evaluate(() => window.__mutineHandwritingV033.getState().changedGlyphIds),
    stage: await field.getAttribute('data-stage')
  };
  await field.focus();
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), stage: await field.getAttribute('data-stage') };
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), stage: await field.getAttribute('data-stage') };
  await field.press('Escape');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), stage: await field.getAttribute('data-stage') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  const wells = await page.locator('.well-button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { partial, committed, lifted, keyboard, released, buttons, wells, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded' });
  await waitRaw(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#material-field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const hint = document.querySelector('.field-hint');
    const stamp = document.querySelector('.field-stamp');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      svgVisible: Boolean(document.querySelector('#material-svg')?.getBoundingClientRect().width > 0),
      glyphCount: field?.querySelectorAll('#glyph-layer [data-glyph-id]').length ?? 0,
      wellCount: field?.querySelectorAll('#well-layer [data-well-id]').length ?? 0,
      memory: field?.dataset.memory,
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      hintHidden: getComputedStyle(hint).display === 'none',
      stampHidden: getComputedStyle(stamp).display === 'none',
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: join(proofDir, 'blind-static-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics };
}

async function readbacks(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const entries = {};
  for (const [name, url, selector] of [
    ['journal', '/journal/', '#journal-typography-2026-10-25'],
    ['current', '/currents/handwriting/', '[data-work-id="typography-2026-10-25"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="typography-2026-10-25"]'],
    ['raw', '/studies/handwriting/v033/?preview=1&static=1', '#material-field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    if (name === 'canonical') await waitCanonical(page); else if (name === 'raw') await waitRaw(page); else await page.waitForSelector(selector, { timeout: 10000 });
    await page.waitForTimeout(180);
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => {
    const response = await fetch('/studio/data/works.json');
    const json = await response.json();
    const matches = json.works.filter((work) => work.id === 'typography-2026-10-25');
    return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, journal: matches[0]?.journal?.anchor ?? null };
  });
  const catalog = await page.evaluate(async () => {
    const response = await fetch('/studio/data/catalog-public.json');
    const json = await response.json();
    const matches = json.works.works.filter((work) => work.id === 'typography-2026-10-25');
    return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null };
  });
  const favicon = await page.evaluate(async () => {
    const response = await fetch('/studio/favicon.svg');
    return { status: response.status, type: response.headers.get('content-type') };
  });
  await page.screenshot({ path: join(proofDir, 'readback-journal-390x844.png'), fullPage: true });
  await page.close();
  return { entries, registry, catalog, favicon, diagnostics };
}

async function startLocalServer() {
  const root = resolve('.');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
      const candidate = resolve(root, `.${requestPath}`);
      if (candidate !== root && !candidate.startsWith(`${root}/`) && !candidate.startsWith(`${root}\\`)) { response.writeHead(403); response.end('forbidden'); return; }
      let filePath = candidate;
      const details = await stat(filePath);
      if (details.isDirectory()) filePath = resolve(filePath, 'index.html');
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': types[extname(filePath).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(404); response.end('not found'); }
  });
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  return server;
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const localServer = baseUrl ? null : await startLocalServer();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const matrix = [];
  for (const reduced of [false, true]) {
    for (const [width, height] of viewports) {
      matrix.push(await measure(context, 'raw', rawPath, width, height, reduced));
      matrix.push(await measure(context, 'canonical', canonicalPath, width, height, reduced));
    }
  }
  const interaction = await interactionRun(context);
  const blind = await blindRun(context);
  const routes = await readbacks(context);
  await browser.close();
  if (localServer) await new Promise((resolveServer) => localServer.close(resolveServer));
  const diagnostics = [...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()), ...Object.values(interaction.diagnostics).flat(), ...Object.values(blind.diagnostics).flat(), ...Object.values(routes.diagnostics).flat()];
  const overflow = matrix.filter((entry) => entry.metrics.scrollWidth > entry.metrics.innerWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth);
  const result = {
    baseUrl,
    proofDir,
    viewports,
    localViewportRuns: matrix.length,
    productionViewportRuns: matrix.length,
    matrix,
    overflowCount: overflow.length,
    diagnosticCount: diagnostics.length,
    diagnostics,
    interaction: { ...interaction, committedMemory: Number(interaction.committed.memory), liftRestored: interaction.lifted.restored },
    blind: { ...blind, memory: Number(blind.evidence.memory) },
    routes,
    screenshotCount: matrix.length + 3,
    generatedAt: new Date().toISOString()
  };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  if (process.env.MUTINE_BASE_URL) {
    const localSummaryPath = resolve('research/qa/proofs/handwriting-v033-2026-10-25/qa-summary.json');
    const localSummary = JSON.parse(await readFile(localSummaryPath, 'utf8'));
    localSummary.productionViewportRuns = result.productionViewportRuns;
    localSummary.production = {
      ...result,
      registryMatches: routes.registry.matches,
      catalogMatches: routes.catalog.matches,
      faviconStatus: routes.favicon.status,
      proofDir
    };
    await writeFile(localSummaryPath, `${JSON.stringify(localSummary, null, 2)}\n`, 'utf8');
  }
  await writeFile(join(proofDir, 'README.md'), `# Handwriting v033 QA — 2026-10-25\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Overflow failures: ${overflow.length}.\n- Diagnostics: ${diagnostics.length}.\n- Interaction: partial=${interaction.partial.stage}, partial-geometry-unchanged=${interaction.partial.geometryUnchanged}, committed-memory=${interaction.committed.memory}, changed-glyphs=${interaction.committed.changedGlyphIds.join(',')}, lift=${interaction.lifted.restored}, keyboard=${interaction.keyboard.memory}, release=${interaction.released.restored}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}; wells=${interaction.wells.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, svg=${blind.evidence.svgVisible}, glyphs=${blind.evidence.glyphCount}, wells=${blind.evidence.wellCount}, memory=${blind.evidence.memory}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, hint-hidden=${blind.evidence.hintHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, title=${routes.registry.title}, journal=${routes.registry.journal}; catalog status=${routes.catalog.status}, catalog-matches=${routes.catalog.matches}; favicon=${routes.favicon.status}.\n- Captures: ${result.screenshotCount} PNG files.\n`);
  console.log(JSON.stringify({ baseUrl, proofDir, localViewportRuns: matrix.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interaction, blind, routes, screenshotCount: result.screenshotCount }, null, 2));
}

await main();
