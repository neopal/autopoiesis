import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, join } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/handwriting-v031-2026-10-23');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/handwriting/v031/?preview=1&interaction=1';
const canonicalPath = '/works/typography-2026-10-23/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitRaw(page) {
  await page.waitForFunction(() => window._p5Ready === true && window.__mutineHandwritingV031, null, { timeout: 10000 });
  await page.waitForTimeout(80);
}

async function waitCanonical(page) {
  await page.waitForSelector('[data-ready="true"]', { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v031/'));
  if (!frame) throw new Error('canonical page did not mount the v031 raw frame');
  await frame.waitForFunction(() => window._p5Ready === true && window.__mutineHandwritingV031, null, { timeout: 10000 });
  return frame;
}

async function measure(context, route, url, width, height, reduced) {
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
    field: document.querySelector('#route-field')?.getBoundingClientRect().toJSON() ?? null,
    stationCount: document.querySelectorAll('.station').length,
    memory: document.querySelector('#route-field')?.dataset.memory ?? null,
    stage: document.querySelector('#route-field')?.dataset.stage ?? null
  }));
  const result = { route, url, width, height, reduced, metrics, tableau, diagnostics };
  await page.close();
  return result;
}

async function stationPoint(page, stationId) {
  return page.evaluate((id) => {
    const station = document.querySelector(`.station[data-station-id="${id}"]`);
    const frame = window.__mutineHandwritingV031.getFrame();
    const item = frame.stations[id];
    const circle = station.querySelector('.station-pin');
    const point = new DOMPoint(item.x, item.y).matrixTransform(circle.getScreenCTM());
    return { x: point.x, y: point.y };
  }, stationId);
}

async function dragThrough(page, ids) {
  const points = [];
  for (const id of ids) points.push(await stationPoint(page, id));
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitRaw(page);
  const field = page.locator('#route-field');
  const initialSignature = await field.getAttribute('data-signature');
  await dragThrough(page, [1, 6]);
  const partial = {
    route: await field.getAttribute('data-route'),
    memory: await field.getAttribute('data-memory'),
    geometryUnchanged: initialSignature === await field.getAttribute('data-signature'),
    stage: await field.getAttribute('data-stage')
  };
  await dragThrough(page, [1, 6, 9]);
  const committed = {
    route: await field.getAttribute('data-route'),
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== await field.getAttribute('data-signature'),
    changedStationIds: await page.evaluate(() => window.__mutineHandwritingV031.getState().changedStationIds),
    stage: await field.getAttribute('data-stage')
  };
  await field.focus();
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), stage: await field.getAttribute('data-stage') };
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), stage: await field.getAttribute('data-stage') };
  await field.press('r');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), stage: await field.getAttribute('data-stage') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-route-390x844.png'), fullPage: true });
  await page.close();
  return { partial, committed, lifted, keyboard, released, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/handwriting/v031/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitRaw(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#route-field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const hint = document.querySelector('.field-hint');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      stationCount: field?.querySelectorAll('.station').length ?? 0,
      memory: field?.dataset.memory,
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      hintHidden: getComputedStyle(hint).display === 'none',
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
    ['journal', '/journal/', '#journal-typography-2026-10-23'],
    ['current', '/currents/handwriting/', '[data-work-id="typography-2026-10-23"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="typography-2026-10-23"]'],
    ['raw', '/studies/handwriting/v031/?preview=1&static=1', '#route-field']
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
    const matches = json.works.filter((work) => work.id === 'typography-2026-10-23');
    return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, journal: matches[0]?.journal?.anchor ?? null };
  });
  const favicon = await page.evaluate(async () => {
    const response = await fetch('/studio/favicon.svg');
    return { status: response.status, type: response.headers.get('content-type') };
  });
  await page.close();
  return { entries, registry, favicon, diagnostics };
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
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, overflowCount: overflow.length, diagnostics, interaction, blind, routes, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Handwriting v031 QA — 2026-10-23\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Overflow failures: ${overflow.length}.\n- Diagnostics: ${diagnostics.length}.\n- Interaction: partial=${interaction.partial.stage}, partial-geometry-unchanged=${interaction.partial.geometryUnchanged}, committed-memory=${interaction.committed.memory}, changed-stations=${interaction.committed.changedStationIds.join(',')}, lift=${interaction.lifted.restored}, keyboard=${interaction.keyboard.memory}, release=${interaction.released.restored}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, stations=${blind.evidence.stationCount}, memory=${blind.evidence.memory}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, hint-hidden=${blind.evidence.hintHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, title=${routes.registry.title}, journal=${routes.registry.journal}; favicon=${routes.favicon.status}.\n- Captures: interaction-route-390x844.png, blind-static-390x844.png.\n`);
  console.log(JSON.stringify({ matrixRuns: matrix.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interaction, blind, routes, proofDir }, null, 2));
}

await main();
