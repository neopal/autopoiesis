import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v043-2026-11-03');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v043/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v043/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-11-03/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { const failure = request.failure()?.errorText ?? ''; if (failure !== 'net::ERR_ABORTED' && diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${failure}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(frame) {
  await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
  await frame.waitForSelector('#false-centre canvas', { timeout: 20000 });
  await frame.waitForTimeout(180);
}

function parentMetrics(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .false-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
}

async function tableauMetrics(frame) {
  return frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    witnessCount: window.__mutineNaiveV043?.getState().scene.witnessCount ?? 0,
    consensusCount: window.__mutineNaiveV043?.getState().scene.trace.consensusCount ?? 0,
    pendingCount: window.__mutineNaiveV043?.getState().pending.length ?? 0,
    fieldVisible: Boolean(document.querySelector('#false-centre')?.getBoundingClientRect().width),
    canvasVisible: Boolean(document.querySelector('#false-centre canvas')?.getBoundingClientRect().width)
  }));
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  let frame = page.mainFrame();
  if (route === 'raw') await waitReady(frame);
  else {
    await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v043/'), null, { timeout: 20000 });
    frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v043/'));
    await waitReady(frame);
  }
  const metrics = await parentMetrics(page);
  const tableau = await tableauMetrics(frame);
  await page.close();
  return { route, url, width, height, reduced, metrics, tableau, diagnostics };
}

async function clickWitness(page, id) {
  const point = await page.evaluate((witnessId) => {
    const field = document.querySelector('#false-centre');
    const witness = window.__mutineNaiveV043.getState().scene.witnesses[witnessId];
    const width = field.clientWidth;
    const height = field.clientHeight;
    const span = Math.min(width, height) * 0.43;
    return { x: width * 0.5 + witness.x * span, y: height * 0.5 + witness.y * span };
  }, id);
  const box = await page.locator('#false-centre').boundingBox();
  await page.mouse.click(box.x + point.x, box.y + point.y);
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page.mainFrame());
  const field = page.locator('#false-centre');
  await field.focus();
  const initial = await page.evaluate(() => ({ signature: window.__mutineNaiveV043.renderSignature(), memory: document.querySelector('#false-centre').dataset.memoryCount }));
  await clickWitness(page, 1);
  await clickWitness(page, 6);
  await clickWitness(page, 10);
  const pending = await page.evaluate(() => ({ pending: document.querySelector('#false-centre').dataset.pendingCount, memory: document.querySelector('#false-centre').dataset.memoryCount, signature: window.__mutineNaiveV043.renderSignature(), interaction: window.__mutineNaiveV043.getState().interaction }));
  await field.press('Enter');
  const committed = await page.evaluate(() => {
    const api = window.__mutineNaiveV043;
    const current = api.getState();
    const event = current.memory.at(-1);
    const baseline = api.buildFrame();
    return {
      memory: document.querySelector('#false-centre').dataset.memoryCount,
      consensus: document.querySelector('#false-centre').dataset.consensusCount,
      interaction: current.interaction,
      signature: api.renderSignature(),
      sourceExact: event.witnesses.every((id) => JSON.stringify(current.scene.witnesses[id]) === JSON.stringify(baseline.scene.witnesses[id])),
      witnessCount: current.scene.trace.changedWitnessCount
    };
  });
  await field.press('Delete');
  const lifted = await page.evaluate((baseline) => ({ memory: document.querySelector('#false-centre').dataset.memoryCount, restored: window.__mutineNaiveV043.renderSignature() === baseline, interaction: window.__mutineNaiveV043.getState().interaction }), initial.signature);
  await field.focus();
  await field.press('ArrowRight'); await field.press('Enter');
  await field.press('ArrowRight'); await field.press('Enter');
  await field.press('ArrowRight'); await field.press('Enter');
  await field.press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: document.querySelector('#false-centre').dataset.memoryCount, interaction: window.__mutineNaiveV043.getState().interaction }));
  await field.press('Escape');
  const released = await page.evaluate(() => ({ memory: document.querySelector('#false-centre').dataset.memoryCount, interaction: window.__mutineNaiveV043.getState().interaction }));
  await page.locator('[data-action="ask"]').click();
  const control = await page.evaluate(() => ({ memory: document.querySelector('#false-centre').dataset.memoryCount, interaction: window.__mutineNaiveV043.getState().interaction }));
  const buttons = await page.locator('.consensus-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return {
    initialMemory: initial.memory,
    pending,
    pendingGeometryNeutral: initial.signature === pending.signature,
    committedMemory: committed.memory,
    committedConsensus: committed.consensus,
    committedInteraction: committed.interaction,
    geometryChanged: initial.signature !== committed.signature,
    sourceExact: committed.sourceExact,
    selectedWitnessesChanged: committed.witnessCount,
    lifted,
    keyboard,
    released,
    control,
    buttons,
    diagnostics
  };
}

async function touchRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page.mainFrame());
  const points = await page.evaluate(() => {
    const field = document.querySelector('#false-centre');
    const width = field.clientWidth;
    const height = field.clientHeight;
    const span = Math.min(width, height) * 0.43;
    return [1, 6, 10].map((id) => {
      const witness = window.__mutineNaiveV043.getState().scene.witnesses[id];
      return { x: width * 0.5 + witness.x * span, y: height * 0.5 + witness.y * span };
    });
  });
  const box = await page.locator('#false-centre').boundingBox();
  for (const point of points) await page.touchscreen.tap(box.x + point.x, box.y + point.y);
  const result = await page.evaluate(() => ({ pending: document.querySelector('#false-centre').dataset.pendingCount, memory: document.querySelector('#false-centre').dataset.memoryCount, interaction: window.__mutineNaiveV043.getState().interaction }));
  await page.locator('#false-centre').focus();
  await page.locator('#false-centre').press('Enter');
  const committed = await page.evaluate(() => ({ memory: document.querySelector('#false-centre').dataset.memoryCount, interaction: window.__mutineNaiveV043.getState().interaction }));
  await page.close();
  return { result, committed, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page.mainFrame());
  const evidence = await page.evaluate(() => ({
    witnessCount: window.__mutineNaiveV043.getState().scene.witnessCount,
    consensusCount: window.__mutineNaiveV043.getState().scene.trace.consensusCount,
    fieldVisible: document.querySelector('#false-centre')?.getBoundingClientRect().height > 0,
    canvasVisible: document.querySelector('#false-centre canvas')?.getBoundingClientRect().width > 0,
    readoutHidden: getComputedStyle(document.querySelector('.consensus-readout')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.consensus-controls')).display === 'none',
    hintHidden: getComputedStyle(document.querySelector('.consensus-hint')).display === 'none',
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: join(proofDir, 'blind-static-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics };
}

async function readbacks(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const entries = {};
  for (const [name, url, selector] of [
    ['journal', '/journal/', '#journal-naive-2026-11-03'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-11-03"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-11-03"]'],
    ['raw', blindPath, '#false-centre']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') {
      await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v043/'), null, { timeout: 20000 });
    } else if (name === 'raw') await waitReady(page.mainFrame());
    else await page.waitForSelector(selector, { timeout: 20000 });
    if (name === 'canonical') {
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v043/'));
      await waitReady(frame);
      await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
    }
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-11-03'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-11-03'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
  const favicon = await page.evaluate(async () => { const response = await fetch('/studio/favicon.svg'); return { status: response.status, contentType: response.headers.get('content-type') }; });
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
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-webgl'] });
  const context = await browser.newContext({ deviceScaleFactor: 1, hasTouch: true, isMobile: false });
  const matrix = [];
  for (const reduced of [false, true]) for (const [width, height] of viewports) {
    matrix.push(await measure(context, 'raw', rawPath, width, height, reduced));
    matrix.push(await measure(context, 'canonical', canonicalPath, width, height, reduced));
  }
  const interaction = await interactionRun(context);
  const touch = await touchRun(context);
  const blind = await blindRun(context);
  const routes = await readbacks(context);
  await browser.close();
  if (localServer) await new Promise((resolveServer) => localServer.close(resolveServer));
  const diagnostics = [...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()), ...Object.values(interaction.diagnostics).flat(), ...Object.values(touch.diagnostics).flat(), ...Object.values(blind.diagnostics).flat(), ...Object.values(routes.diagnostics).flat()];
  const overflow = matrix.filter((entry) => entry.metrics.scrollWidth > entry.metrics.innerWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || entry.metrics.overflowers.length > 0);
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || entry.tableau.innerWidth !== entry.tableau.clientWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || !entry.tableau.fieldVisible || !entry.tableau.canvasVisible || entry.tableau.witnessCount !== 12 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.initialMemory === '0' && interaction.pending.pending === '3' && interaction.pendingGeometryNeutral && interaction.committedMemory === '1' && interaction.committedConsensus === '1' && interaction.geometryChanged && interaction.committedInteraction === 'quorum-committed' && interaction.sourceExact && interaction.selectedWitnessesChanged === 0 && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.released.memory === '0' && interaction.control.memory === '1' && interaction.buttons.every((button) => button.height >= 44);
  const touchOk = touch.result.pending === '3' && touch.result.memory === '0' && touch.committed.memory === '1' && touch.committed.interaction === 'quorum-committed';
  const blindOk = blind.evidence.fieldVisible && blind.evidence.canvasVisible && blind.evidence.witnessCount === 12 && blind.evidence.consensusCount === 4 && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, touch, blind, routes, interactionOk, touchOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !touchOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
