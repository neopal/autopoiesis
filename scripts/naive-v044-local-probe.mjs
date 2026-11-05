import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v044-2026-11-05-local');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v044/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v044/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-11-05/';

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
  await frame.waitForSelector('#absence-wall canvas', { timeout: 20000 });
  await frame.waitForTimeout(180);
}

async function resolveArtworkFrame(page, route) {
  if (route === 'raw') return page.mainFrame();
  await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v044/'), null, { timeout: 20000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v044/'));
  if (!frame) throw new Error('canonical artwork iframe did not attach');
  return frame;
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveArtworkFrame(page, route);
  await waitReady(frame);
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .absence-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    shutterCount: window.__mutineNaiveV044?.getState().scene.shutterCount ?? 0,
    absenceCount: window.__mutineNaiveV044?.getState().scene.trace.absenceCount ?? 0,
    fieldVisible: Boolean(document.querySelector('#absence-wall')?.getBoundingClientRect().width),
    canvasVisible: Boolean(document.querySelector('#absence-wall canvas')?.getBoundingClientRect().width)
  }));
  await page.close();
  return { route, url, width, height, reduced, metrics, tableau, diagnostics };
}

async function pointForId(frame, field, id) {
  const box = await field.boundingBox();
  const shutter = await frame.evaluate((index) => window.__mutineNaiveV044.getState().scene.shutters[index], id);
  const span = Math.min(box.width, box.height) * 0.92;
  return { x: box.x + box.width * 0.5 + shutter.x * span, y: box.y + box.height * 0.5 + shutter.y * span };
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveArtworkFrame(page, 'raw');
  await waitReady(frame);
  const field = page.locator('#absence-wall');
  const initial = await frame.evaluate(() => ({ signature: window.__mutineNaiveV044.renderSignature(), memory: document.querySelector('#absence-wall').dataset.memoryCount }));

  for (const id of [1]) {
    const point = await pointForId(frame, field, id);
    await page.mouse.move(point.x, point.y);
  }
  const fieldBox = await field.boundingBox();
  await page.mouse.move(fieldBox.x - 10, fieldBox.y - 10);
  const incomplete = await frame.evaluate(() => ({ memory: document.querySelector('#absence-wall').dataset.memoryCount, interaction: window.__mutineNaiveV044.getState().interaction }));
  await field.press('r');

  for (const id of [1, 5, 8]) {
    const point = await pointForId(frame, field, id);
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.move(fieldBox.x - 10, fieldBox.y - 10);
  const committed = await frame.evaluate(() => {
    const api = window.__mutineNaiveV044;
    const current = api.getState();
    const event = current.memory.at(-1);
    const baseline = api.buildFrame();
    return {
      memory: document.querySelector('#absence-wall').dataset.memoryCount,
      interaction: current.interaction,
      signature: api.renderSignature(),
      event,
      sourceExact: current.scene.trace.changedShutterCount === 0,
      baselineSignature: api.geometrySignature.call({}),
      changedShutterCount: current.scene.trace.changedShutterCount,
      absenceCount: current.scene.trace.absenceCount,
      baselineAbsenceCount: baseline.scene.trace.absenceCount
    };
  });
  await frame.locator('#absence-wall').press('Delete');
  const lifted = await frame.evaluate((baseline) => ({ memory: document.querySelector('#absence-wall').dataset.memoryCount, restored: window.__mutineNaiveV044.renderSignature() === baseline, interaction: window.__mutineNaiveV044.getState().interaction }), initial.signature);

  await frame.locator('#absence-wall').press('r');
  await frame.locator('#absence-wall').press('ArrowRight');
  await frame.locator('#absence-wall').press('Enter');
  await frame.locator('#absence-wall').press('ArrowRight');
  await frame.locator('#absence-wall').press('Enter');
  await frame.locator('#absence-wall').press('ArrowRight');
  await frame.locator('#absence-wall').press('Enter');
  await frame.locator('#absence-wall').press('Enter');
  const keyboard = await frame.evaluate(() => ({ memory: document.querySelector('#absence-wall').dataset.memoryCount, interaction: window.__mutineNaiveV044.getState().interaction }));
  await frame.locator('#absence-wall').press('r');
  await frame.locator('[data-action="ask"]').click();
  const control = await frame.evaluate(() => ({ memory: document.querySelector('#absence-wall').dataset.memoryCount, interaction: window.__mutineNaiveV044.getState().interaction }));
  const buttons = await frame.locator('.absence-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, incomplete, committed, geometryChanged: initial.signature !== committed.signature, lifted, keyboard, control, buttons, diagnostics };
}

async function touchRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const frame = await resolveArtworkFrame(page, 'raw');
  await waitReady(frame);
  const result = await frame.evaluate(() => {
    const node = document.querySelector('#absence-wall');
    const rect = node.getBoundingClientRect();
    const api = window.__mutineNaiveV044;
    const dispatch = (type, id) => {
      const shutter = api.getState().scene.shutters[id];
      const span = Math.min(rect.width, rect.height) * 0.92;
      node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 4, pointerType: 'touch', clientX: rect.left + rect.width * 0.5 + shutter.x * span, clientY: rect.top + rect.height * 0.5 + shutter.y * span }));
    };
    dispatch('pointermove', 0);
    dispatch('pointermove', 4);
    dispatch('pointermove', 9);
    node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 4, pointerType: 'touch', clientX: rect.left + rect.width * .5, clientY: rect.top + rect.height * .5 }));
    return { memory: node.dataset.memoryCount, interaction: api.getState().interaction };
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
  const frame = await resolveArtworkFrame(page, 'raw');
  await waitReady(frame);
  const evidence = await frame.evaluate(() => ({
    shutterCount: window.__mutineNaiveV044.getState().scene.shutterCount,
    absenceCount: window.__mutineNaiveV044.getState().scene.trace.absenceCount,
    memory: document.querySelector('#absence-wall')?.dataset.memoryCount,
    fieldVisible: document.querySelector('#absence-wall')?.getBoundingClientRect().height > 0,
    canvasVisible: document.querySelector('#absence-wall canvas')?.getBoundingClientRect().width > 0,
    readoutHidden: getComputedStyle(document.querySelector('.absence-readout')).display === 'none',
    controlsHidden: getComputedStyle(document.querySelector('.absence-controls')).display === 'none',
    hintHidden: getComputedStyle(document.querySelector('.absence-hint')).display === 'none',
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
    ['journal', '/journal/', '#journal-naive-2026-11-05'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-11-05"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-11-05"]'],
    ['raw', blindPath, '#absence-wall']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') {
      await page.waitForSelector('[data-catalog-work-detail] iframe', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v044/'), null, { timeout: 20000 });
    } else if (name === 'raw') await waitReady(page.mainFrame());
    else await page.waitForSelector(selector, { timeout: 20000 });
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-11-05'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-11-05'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || entry.tableau.innerWidth !== entry.tableau.clientWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || !entry.tableau.fieldVisible || !entry.tableau.canvasVisible || entry.tableau.shutterCount !== 10 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.initial.memory === '0' && interaction.incomplete.memory === '0' && interaction.incomplete.interaction === 'departure-refused-incomplete' && interaction.committed.memory === '1' && interaction.geometryChanged && interaction.committed.interaction === 'departure-committed' && interaction.committed.sourceExact && interaction.committed.changedShutterCount === 0 && interaction.committed.absenceCount === 1 && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.control.memory === '1' && interaction.buttons.every((button) => button.height >= 44);
  const touchOk = touch.result.memory === '1' && touch.result.interaction === 'departure-committed';
  const blindOk = blind.evidence.fieldVisible && blind.evidence.canvasVisible && blind.evidence.shutterCount === 10 && blind.evidence.absenceCount === 4 && blind.evidence.memory === '4' && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, touch, blind, routes, interactionOk, touchOk, blindOk, readbacksOk, screenshotCount: 2, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ matrixRuns: matrix.length, failures: failures.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interactionOk, touchOk, blindOk, readbacksOk, proofDir }, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !touchOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
