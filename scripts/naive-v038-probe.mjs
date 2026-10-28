import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v038-2026-10-28');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v038/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v038/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-10-28/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(page) {
  await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  await page.waitForSelector('#witness-field canvas');
  await page.waitForTimeout(120);
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (route === 'raw') await waitReady(page);
  else await page.waitForSelector('[data-catalog-work-detail] iframe');
  const frame = route === 'canonical' ? page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v038/')) : page.mainFrame();
  if (route === 'canonical') await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .witness-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasVisible: Boolean(document.querySelector('#witness-field canvas')),
    memory: document.querySelector('#witness-field')?.dataset.memoryCount ?? null,
    stage: document.querySelector('[data-stage]')?.textContent ?? null,
    field: document.querySelector('#witness-field')?.getBoundingClientRect().toJSON() ?? null
  }));
  await page.close();
  return { route, url, width, height, reduced, metrics, tableau, diagnostics };
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page);
  const field = page.locator('#witness-field');
  const initial = await page.evaluate(() => ({ signature: JSON.stringify(window.__mutineNaiveV038.getState().scene), memory: document.querySelector('#witness-field').dataset.memoryCount }));
  await field.locator('[data-action="look"]').count().catch(() => 0);
  await page.locator('[data-action="look"]').click();
  const committed = await page.evaluate(() => ({ memory: document.querySelector('#witness-field').dataset.memoryCount, interaction: window.__mutineNaiveV038.getState().interaction }));
  const afterScene = await page.evaluate(() => JSON.stringify(window.__mutineNaiveV038.getState().scene));
  await field.focus();
  await field.press('Delete');
  const lifted = await page.evaluate((baseline) => ({ memory: document.querySelector('#witness-field').dataset.memoryCount, restored: JSON.stringify(window.__mutineNaiveV038.getState().scene) === baseline, interaction: window.__mutineNaiveV038.getState().interaction }), initial.signature);
  await field.press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: document.querySelector('#witness-field').dataset.memoryCount, interaction: window.__mutineNaiveV038.getState().interaction }));
  await field.press('r');
  const released = await page.evaluate(() => ({ memory: document.querySelector('#witness-field').dataset.memoryCount, interaction: window.__mutineNaiveV038.getState().interaction }));
  const buttons = await page.locator('.witness-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initialMemory: initial.memory, committedMemory: committed.memory, committedInteraction: committed.interaction, geometryChanged: initial.signature !== afterScene, lifted, keyboard, released, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page);
  const evidence = await page.evaluate(() => ({
    canvasVisible: Boolean(document.querySelector('#witness-field canvas')?.getBoundingClientRect().width),
    memory: document.querySelector('#witness-field')?.dataset.memoryCount,
    readoutHidden: getComputedStyle(document.querySelector('.witness-readout')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.witness-controls')).display === 'none',
    hintHidden: getComputedStyle(document.querySelector('.witness-hint')).display === 'none',
    fieldVisible: document.querySelector('#witness-field')?.getBoundingClientRect().height > 0,
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
    ['journal', '/journal/', '#journal-naive-2026-10-28'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-10-28"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-10-28"]'],
    ['raw', blindPath, '#witness-field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') await page.waitForSelector('[data-catalog-work-detail] iframe');
    else if (name === 'raw') await waitReady(page);
    else await page.waitForSelector(selector, { timeout: 15000 });
    if (name === 'canonical') {
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v038/'));
      await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
      await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
    }
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-10-28'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-10-28'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const matrix = [];
  for (const reduced of [false, true]) for (const [width, height] of viewports) {
    matrix.push(await measure(context, 'raw', rawPath, width, height, reduced));
    matrix.push(await measure(context, 'canonical', canonicalPath, width, height, reduced));
  }
  const interaction = await interactionRun(context);
  const blind = await blindRun(context);
  const routes = await readbacks(context);
  await browser.close();
  if (localServer) await new Promise((resolveServer) => localServer.close(resolveServer));
  const diagnostics = [...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()), ...Object.values(interaction.diagnostics).flat(), ...Object.values(blind.diagnostics).flat(), ...Object.values(routes.diagnostics).flat()];
  const overflow = matrix.filter((entry) => entry.metrics.scrollWidth > entry.metrics.innerWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || entry.metrics.overflowers.length > 0);
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && (entry.tableau.innerWidth !== entry.width || entry.tableau.clientWidth !== entry.width || entry.tableau.scrollWidth > entry.tableau.innerWidth)) || !entry.tableau.canvasVisible || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.committedMemory === '1' && interaction.geometryChanged && interaction.committedInteraction === 'look-committed' && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.released.memory === '0' && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.canvasVisible && blind.evidence.memory === '4' && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.fieldVisible && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, blind, routes, interactionOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
