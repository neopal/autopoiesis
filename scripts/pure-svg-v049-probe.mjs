import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/svg-v049-2026-11-11-local');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v049/?preview=1&interaction=1';
const blindPath = '/studies/pure-svg/v049/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-11-11/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (message.type() === 'error' && diagnostics.console.length < 12) diagnostics.console.push(message.text()); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(page) {
  await page.waitForFunction(() => window._mutineReady === true, null, { timeout: 10000 });
  await page.waitForTimeout(80);
}

async function waitCanonicalFrame(page) {
  await page.waitForFunction(() => Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v049/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v049/'));
  if (!frame) throw new Error('canonical page did not mount the v049 raw frame');
  await frame.waitForFunction(() => window._mutineReady === true, null, { timeout: 10000 });
  await frame.waitForTimeout(80);
  return frame;
}

async function metricsFor(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() })),
    marks: document.querySelectorAll('#field [data-mark]').length,
    cuts: document.querySelectorAll('#field [data-cut]').length
  }));
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const response = await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  if (route === 'canonical') await waitCanonicalFrame(page);
  else await waitReady(page);
  const metrics = await metricsFor(page);
  await page.close();
  return { route, url, width, height, reduced, status: response?.status(), metrics, diagnostics };
}

async function screenPoint(page, point) {
  return page.evaluate((point) => {
    const rect = document.querySelector('#field').getBoundingClientRect();
    return { x: rect.left + point.x * rect.width / 1200, y: rect.top + point.y * rect.height / 760 };
  }, point);
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const points = await page.evaluate(() => ({ entry: window.__mutineSvgV049.corridorPoint(0, -1), exit: window.__mutineSvgV049.corridorPoint(0, 1) }));
  const initial = await page.evaluate(() => ({ signature: window.__mutineSvgV049.geometrySignature(), state: window.__mutineSvgV049.getState() }));
  const entry = await screenPoint(page, points.entry);
  const exit = await screenPoint(page, points.exit);
  await page.mouse.move(entry.x - 8, entry.y - 8);
  await page.waitForTimeout(20);
  await page.mouse.move(entry.x, entry.y);
  await page.waitForTimeout(40);
  const entered = await page.evaluate(() => window.__mutineSvgV049.getState());
  await page.mouse.move(exit.x, exit.y, { steps: 12 });
  await page.waitForTimeout(40);
  const crossed = await page.evaluate(() => window.__mutineSvgV049.getState());
  await page.mouse.move(4, 4);
  await page.waitForTimeout(40);
  const committed = await page.evaluate(() => ({ ...window.__mutineSvgV049.getState(), signature: window.__mutineSvgV049.geometrySignature() }));
  await page.locator('#field').press('Delete');
  const lifted = await page.evaluate(() => ({ ...window.__mutineSvgV049.getState(), signature: window.__mutineSvgV049.geometrySignature() }));
  await page.locator('#field').focus();
  await page.locator('#field').press('ArrowRight');
  await page.locator('#field').press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineSvgV049.getState());
  await page.locator('#field').press('Escape');
  const released = await page.evaluate(() => window.__mutineSvgV049.getState());

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const collisionPoint = await page.evaluate(() => ({ x: 220, y: 408 }));
  const collision = await screenPoint(page, collisionPoint);
  const collisionInitial = await page.evaluate(() => window.__mutineSvgV049.getState());
  await page.mouse.move(entry.x - 8, entry.y - 8);
  await page.waitForTimeout(20);
  await page.mouse.move(entry.x, entry.y);
  await page.waitForTimeout(30);
  await page.mouse.move(collision.x, collision.y, { steps: 4 });
  await page.waitForTimeout(30);
  const refusedCollision = await page.evaluate(() => window.__mutineSvgV049.getState());

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  await page.locator('#pass-control').click();
  await page.locator('#pass-control').click();
  await page.locator('#pass-control').click();
  await page.locator('#pass-control').click();
  const four = await page.evaluate(() => window.__mutineSvgV049.getState());
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, entered, crossed, committed, lifted, keyboard, released, collisionInitial, refusedCollision, four, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    const opening = document.querySelector('.work-opening');
    return {
      status: document.readyState,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      memory: field?.dataset.memory,
      marks: field?.querySelectorAll('[data-mark]').length ?? 0,
      cuts: field?.querySelectorAll('[data-cut]').length ?? 0,
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      annotationsHidden: getComputedStyle(annotations).display === 'none',
      openingHidden: getComputedStyle(opening).display === 'none',
      keyShortcutsRemoved: !field?.hasAttribute('aria-keyshortcuts'),
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: join(proofDir, 'blind-static-390x844.png'), fullPage: true });
  await page.close();
  return { responseStatus: response?.status(), evidence, diagnostics };
}

async function readbacks(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const paths = ['/journal/', '/currents/pure-svg/', canonicalPath, blindPath, '/studio/data/works.json', '/studio/data/catalog-public.json', '/studio/favicon.svg'];
  const result = {};
  for (const path of paths) {
    const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
    if (path === canonicalPath) {
      await waitCanonicalFrame(page);
    } else if (path === blindPath) {
      await waitReady(page);
    } else if (path === '/journal/') {
      await page.waitForSelector('#journal-svg-2026-11-11', { timeout: 10000 });
    } else if (path === '/currents/pure-svg/') {
      await page.waitForSelector('[data-work-id="svg-2026-11-11"]', { timeout: 10000 });
    }
    const body = await page.locator('body').innerText().catch(() => '');
    result[path] = { status: response?.status(), hasWork: body.includes('The gap is') || body.includes('svg-2026-11-11'), hasJournal: await page.locator('#journal-svg-2026-11-11').count() > 0, hasTitle: body.includes('The gap is a third mark.') };
  }
  const registry = await page.request.get(`${baseUrl}/studio/data/works.json`).then((response) => response.json());
  const publicCatalog = await page.request.get(`${baseUrl}/studio/data/catalog-public.json`).then((response) => response.json());
  result.registry = { sourceMatches: registry.works.filter((work) => work.id === 'svg-2026-11-11').length, title: registry.works.find((work) => work.id === 'svg-2026-11-11')?.title ?? null, rawPath: registry.works.find((work) => work.id === 'svg-2026-11-11')?.rawPath ?? null };
  result.catalog = { publicMatches: publicCatalog.works.works.filter((work) => work.id === 'svg-2026-11-11').length, title: publicCatalog.works.works.find((work) => work.id === 'svg-2026-11-11')?.title ?? null };
  await page.close();
  return { result, diagnostics };
}

async function startLocalServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
      const candidate = resolve(root, `.${requestPath}`);
      const rel = relative(root, candidate);
      if (rel.startsWith('..') || rel.includes('..\\') || rel.includes('../')) { response.writeHead(403); response.end('forbidden'); return; }
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
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const local = baseUrl ? null : await startLocalServer();
  const effectiveBase = baseUrl || local.url;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ deviceScaleFactor: 1, serviceWorkers: 'block' });
  const matrix = [];
  for (const reduced of [false, true]) for (const [width, height] of viewports) {
    matrix.push(await measure(context, 'raw', rawPath, width, height, reduced));
    matrix.push(await measure(context, 'canonical', canonicalPath, width, height, reduced));
  }
  const interaction = await interactionRun(context);
  const blind = await blindRun(context);
  const readback = await readbacks(context);
  await browser.close();
  if (local) await new Promise((resolveServer) => local.server.close(resolveServer));

  const diagnostics = [...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()), ...Object.values(interaction.diagnostics).flat(), ...Object.values(blind.diagnostics).flat(), ...Object.values(readback.diagnostics).flat()];
  const overflow = matrix.filter((entry) => entry.metrics.scrollWidth > entry.metrics.innerWidth || entry.metrics.overflowers.length > 0);
  const failures = matrix.filter((entry) => entry.status !== 200 || entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && entry.metrics.marks !== 8) || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.initial.state.memory === 0 && interaction.crossed.interaction === 'pass-crossed' && interaction.committed.memory === 1 && interaction.committed.cuts === 1 && interaction.committed.interaction === 'pass-committed' && interaction.lifted.memory === 0 && interaction.keyboard.memory === 1 && interaction.released.memory === 0 && interaction.refusedCollision.interaction === 'pass-refused-mark' && interaction.refusedCollision.memory === 0 && interaction.four.memory === 4 && interaction.four.cuts === 4 && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.responseStatus === 200 && blind.evidence.fieldVisible && blind.evidence.memory === '4' && blind.evidence.marks === 8 && blind.evidence.cuts === 4 && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.annotationsHidden && blind.evidence.openingHidden && blind.evidence.keyShortcutsRemoved && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbackOk = Object.entries(readback.result).filter(([key]) => key.startsWith('/')).every(([, value]) => value.status === 200) && readback.result.registry.sourceMatches === 1 && readback.result.catalog.publicMatches === 1 && readback.result['/journal/'].hasJournal && readback.result['/journal/'].hasTitle && readback.result['/currents/pure-svg/'].hasWork && readback.result[canonicalPath].hasWork;
  const summary = { baseUrl: effectiveBase, matrixRuns: matrix.length, matrixFailures: failures.length, overflowCount: overflow.length, diagnosticsCount: diagnostics.length, interactionOk, blindOk, readbackOk, matrix, interaction, blind, readback };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbackOk) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
