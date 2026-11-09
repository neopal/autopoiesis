import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v048-2026-11-09-local');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v048/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v048/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-11-09/';

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
  await frame.waitForSelector('#attention-field canvas', { timeout: 20000 });
  await frame.waitForTimeout(180);
}

async function resolveFrame(page, route) {
  if (route === 'raw') return page.mainFrame();
  await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v048/'), null, { timeout: 20000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v048/'));
  if (!frame) throw new Error('canonical artwork iframe did not attach');
  return frame;
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveFrame(page, route);
  await waitReady(frame);
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .attention-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    agentCount: window.__mutineNaiveV048?.getState().body.agents.length ?? 0,
    seamCount: window.__mutineNaiveV048?.getState().body.seams.length ?? 0,
    memory: window.__mutineNaiveV048?.getState().memory.length ?? -1,
    fieldVisible: document.querySelector('#attention-field')?.getBoundingClientRect().height > 0,
    canvasVisible: document.querySelector('#attention-field canvas')?.getBoundingClientRect().width > 0
  }));
  await page.screenshot({ path: join(proofDir, `${route}-${width}x${height}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { route, url, width, height, reduced, metrics, tableau, diagnostics };
}

async function pointForAgent(frame, field, id) {
  const box = await field.boundingBox();
  const agent = await frame.evaluate((index) => window.__mutineNaiveV048.getState().body.agents[index], id);
  return { x: box.x + box.width * 0.5 + agent.x * box.width * 0.43, y: box.y + box.height * 0.5 + agent.y * box.height * 0.43 };
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveFrame(page, 'raw');
  await waitReady(frame);
  const field = page.locator('#attention-field');
  const initial = await frame.evaluate(() => ({ signature: window.__mutineNaiveV048.renderSignature(), memory: document.querySelector('#attention-field').dataset.memoryCount }));
  for (const id of [2, 6, 11]) {
    const point = await pointForAgent(frame, field, id);
    await page.mouse.move(point.x, point.y);
  }
  const pending = await frame.evaluate(() => ({ visited: window.__mutineNaiveV048.getState().pending.visited, memory: document.querySelector('#attention-field').dataset.memoryCount }));
  await frame.locator('[data-action="look-back"]').click();
  const committed = await frame.evaluate(() => {
    const api = window.__mutineNaiveV048;
    const current = api.getState();
    return {
      memory: document.querySelector('#attention-field').dataset.memoryCount,
      interaction: current.interaction,
      signature: api.renderSignature(),
      seamCount: current.body.seams.length,
      allChanged: current.body.agents.every((agent) => agent.backcastDepth > 0),
      visited: current.event?.visited ?? []
    };
  });
  await field.press('Delete');
  const lifted = await frame.evaluate((baseline) => ({ memory: document.querySelector('#attention-field').dataset.memoryCount, restored: window.__mutineNaiveV048.renderSignature() === baseline, interaction: window.__mutineNaiveV048.getState().interaction }), initial.signature);
  await field.press('r');
  await field.press('Enter');
  const keyboard = await frame.evaluate(() => ({ memory: document.querySelector('#attention-field').dataset.memoryCount, interaction: window.__mutineNaiveV048.getState().interaction }));
  const buttons = await frame.locator('.attention-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, pending, committed, geometryChanged: initial.signature !== committed.signature, lifted, keyboard, buttons, diagnostics };
}

async function touchRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveFrame(page, 'raw');
  await waitReady(frame);
  const result = await frame.evaluate(() => {
    const node = document.querySelector('#attention-field');
    const rect = node.getBoundingClientRect();
    const api = window.__mutineNaiveV048;
    const dispatch = (type, id) => {
      const agent = api.getState().body.agents[id];
      const clientX = rect.left + rect.width * 0.5 + agent.x * rect.width * 0.43;
      const clientY = rect.top + rect.height * 0.5 + agent.y * rect.height * 0.43;
      node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 4, pointerType: 'touch', clientX, clientY }));
    };
    dispatch('pointermove', 1);
    dispatch('pointermove', 7);
    dispatch('pointermove', 13);
    node.querySelector?.('[data-action="look-back"]');
    document.querySelector('[data-action="look-back"]').click();
    return { memory: node.dataset.memoryCount, interaction: api.getState().interaction, seamCount: api.getState().body.seams.length };
  });
  await page.close();
  return { result, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveFrame(page, 'raw');
  await waitReady(frame);
  const evidence = await frame.evaluate(() => ({
    agentCount: window.__mutineNaiveV048.getState().body.agents.length,
    seamCount: window.__mutineNaiveV048.getState().body.seams.length,
    memory: document.querySelector('#attention-field')?.dataset.memoryCount,
    fieldVisible: document.querySelector('#attention-field')?.getBoundingClientRect().height > 0,
    canvasVisible: document.querySelector('#attention-field canvas')?.getBoundingClientRect().width > 0,
    readoutHidden: getComputedStyle(document.querySelector('.attention-readout')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.attention-controls')).display === 'none',
    hintHidden: getComputedStyle(document.querySelector('.attention-hint')).display === 'none',
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
    ['journal', '/journal/', '#journal-naive-2026-11-09'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-11-09"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-11-09"]'],
    ['raw', blindPath, '#attention-field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') {
      await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v048/'), null, { timeout: 20000 });
    } else if (name === 'raw') await waitReady(page.mainFrame());
    else await page.waitForSelector(selector, { timeout: 20000 });
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-11-09'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-11-09'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
  await page.goto(`${baseUrl}/journal/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#journal-naive-2026-11-09', { timeout: 20000 });
  const journalBody = await page.evaluate(() => ({ status: 200, hasAnchor: Boolean(document.querySelector('#journal-naive-2026-11-09')), hasTitle: document.body.textContent.includes('The model remembers the wrong stare.') }));
  const favicon = await page.evaluate(async () => { const response = await fetch('/studio/favicon.svg'); return { status: response.status, contentType: response.headers.get('content-type') }; });
  await page.close();
  return { entries, registry, catalog, journalBody, favicon, diagnostics };
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || entry.tableau.innerWidth !== entry.tableau.clientWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || !entry.tableau.fieldVisible || !entry.tableau.canvasVisible || entry.tableau.agentCount !== 15 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.initial.memory === '0' && interaction.pending.visited.length === 3 && interaction.pending.memory === '0' && interaction.committed.memory === '1' && interaction.committed.interaction === 'look-back-committed' && interaction.committed.seamCount === 1 && interaction.committed.allChanged && interaction.geometryChanged && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.buttons.every((button) => button.height >= 44);
  const touchOk = touch.result.memory === '1' && touch.result.interaction === 'look-back-committed' && touch.result.seamCount === 1;
  const blindOk = blind.evidence.fieldVisible && blind.evidence.canvasVisible && blind.evidence.agentCount === 15 && blind.evidence.seamCount === 4 && blind.evidence.memory === '4' && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.journalBody.status === 200 && routes.journalBody.hasAnchor && routes.journalBody.hasTitle && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, touch, blind, routes, interactionOk, touchOk, blindOk, readbacksOk, screenshotCount: matrix.length + 2, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ matrixRuns: matrix.length, failures: failures.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interactionOk, touchOk, blindOk, readbacksOk, proofDir }, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !touchOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
