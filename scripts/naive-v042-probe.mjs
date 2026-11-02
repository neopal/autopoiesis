import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v042-2026-11-02');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v042/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v042/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-11-02/';

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
  await frame.waitForSelector('#wrong-volume canvas', { timeout: 20000 });
  await frame.waitForTimeout(180);
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
    await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v042/'), null, { timeout: 20000 });
    frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v042/'));
    await waitReady(frame);
  }
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .wrong-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    blockCount: window.__mutineNaiveV042?.getState().scene.blockCount ?? 0,
    changedBlockCount: window.__mutineNaiveV042?.getState().scene.trace.changedBlockCount ?? 0,
    fieldVisible: Boolean(document.querySelector('#wrong-volume')?.getBoundingClientRect().width),
    canvasVisible: Boolean(document.querySelector('#wrong-volume canvas')?.getBoundingClientRect().width)
  }));
  await page.close();
  return { route, url, width, height, reduced, metrics, tableau, diagnostics };
}

async function drag(page, fromY, toY) {
  const box = await page.locator('#wrong-volume').boundingBox();
  const x = box.x + box.width * 0.5;
  await page.mouse.move(x, box.y + fromY);
  await page.mouse.down();
  await page.mouse.move(x, box.y + toY, { steps: 4 });
  await page.mouse.up();
}

async function dragReverse(page) {
  const box = await page.locator('#wrong-volume').boundingBox();
  const x = box.x + box.width * 0.5;
  await page.mouse.move(x, box.y + 190);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 350, { steps: 4 });
  await page.mouse.move(x, box.y + 190, { steps: 4 });
  await page.mouse.up();
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitReady(page.mainFrame());
  const field = page.locator('#wrong-volume');
  const initial = await page.evaluate(() => ({ signature: window.__mutineNaiveV042.renderSignature(), memory: document.querySelector('#wrong-volume').dataset.memoryCount }));
  await drag(page, 190, 350);
  const oneWay = await page.evaluate(() => ({ memory: document.querySelector('#wrong-volume').dataset.memoryCount, interaction: window.__mutineNaiveV042.getState().interaction }));
  await field.press('r');
  await dragReverse(page);
  const committed = await page.evaluate(() => {
    const api = window.__mutineNaiveV042;
    const current = api.getState();
    const event = current.memory.at(-1);
    const baseline = api.buildFrame();
    return {
      memory: document.querySelector('#wrong-volume').dataset.memoryCount,
      interaction: current.interaction,
      signature: api.renderSignature(),
      event,
      sourceExact: JSON.stringify(current.scene.blocks[event.source]) === JSON.stringify(baseline.scene.blocks[event.source]),
      changedBlockCount: current.scene.trace.changedBlockCount
    };
  });
  await field.press('Delete');
  const lifted = await page.evaluate((baseline) => ({ memory: document.querySelector('#wrong-volume').dataset.memoryCount, restored: window.__mutineNaiveV042.renderSignature() === baseline, interaction: window.__mutineNaiveV042.getState().interaction }), initial.signature);
  await field.press('ArrowDown');
  await field.press('ArrowDown');
  await field.press('ArrowUp');
  await field.press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: document.querySelector('#wrong-volume').dataset.memoryCount, interaction: window.__mutineNaiveV042.getState().interaction }));
  await field.press('r');
  const released = await page.evaluate(() => ({ memory: document.querySelector('#wrong-volume').dataset.memoryCount, interaction: window.__mutineNaiveV042.getState().interaction }));
  await page.locator('[data-action="invert"]').click();
  const control = await page.evaluate(() => ({ memory: document.querySelector('#wrong-volume').dataset.memoryCount, interaction: window.__mutineNaiveV042.getState().interaction }));
  const buttons = await page.locator('.volume-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return {
    initialMemory: initial.memory,
    oneWay,
    committedMemory: committed.memory,
    committedInteraction: committed.interaction,
    geometryChanged: initial.signature !== committed.signature,
    sourceExact: committed.sourceExact,
    remoteChanged: committed.changedBlockCount >= 3,
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
  const result = await page.evaluate(() => {
    const node = document.querySelector('#wrong-volume');
    const rect = node.getBoundingClientRect();
    const dispatch = (type, y) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 4, pointerType: 'touch', clientX: rect.left + rect.width / 2, clientY: y }));
    dispatch('pointerdown', rect.top + 150);
    dispatch('pointermove', rect.top + 330);
    dispatch('pointermove', rect.top + 150);
    dispatch('pointerup', rect.top + 150);
    return { memory: node.dataset.memoryCount, interaction: window.__mutineNaiveV042.getState().interaction };
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
  await waitReady(page.mainFrame());
  const evidence = await page.evaluate(() => ({
    blockCount: window.__mutineNaiveV042.getState().scene.blockCount,
    changedBlockCount: window.__mutineNaiveV042.getState().scene.trace.changedBlockCount,
    memory: document.querySelector('#wrong-volume')?.dataset.memoryCount,
    fieldVisible: document.querySelector('#wrong-volume')?.getBoundingClientRect().height > 0,
    canvasVisible: document.querySelector('#wrong-volume canvas')?.getBoundingClientRect().width > 0,
    readoutHidden: getComputedStyle(document.querySelector('.volume-readout')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.volume-controls')).display === 'none',
    hintHidden: getComputedStyle(document.querySelector('.volume-hint')).display === 'none',
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
    ['journal', '/journal/', '#journal-naive-2026-11-02'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-11-02"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-11-02"]'],
    ['raw', blindPath, '#wrong-volume']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') {
      await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v042/'), null, { timeout: 20000 });
    } else if (name === 'raw') await waitReady(page.mainFrame());
    else await page.waitForSelector(selector, { timeout: 20000 });
    if (name === 'canonical') {
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v042/'));
      await waitReady(frame);
      await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
    }
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-11-02'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-11-02'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || entry.tableau.innerWidth !== entry.tableau.clientWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || !entry.tableau.fieldVisible || !entry.tableau.canvasVisible || entry.tableau.blockCount !== 9 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.initialMemory === '0' && interaction.oneWay.memory === '0' && interaction.oneWay.interaction === 'scan-refused-incomplete' && interaction.committedMemory === '1' && interaction.geometryChanged && interaction.committedInteraction === 'scan-committed' && interaction.sourceExact && interaction.remoteChanged && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.released.memory === '0' && interaction.control.memory === '1' && interaction.buttons.every((button) => button.height >= 44);
  const touchOk = touch.result.memory === '1' && touch.result.interaction === 'scan-committed';
  const blindOk = blind.evidence.fieldVisible && blind.evidence.canvasVisible && blind.evidence.blockCount === 9 && blind.evidence.memory === '4' && blind.evidence.changedBlockCount >= 3 && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, touch, blind, routes, interactionOk, touchOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !touchOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
