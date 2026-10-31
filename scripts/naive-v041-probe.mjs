import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/naive-v041-2026-10-31');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v041/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v041/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-10-31/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { const failure = request.failure()?.errorText ?? ''; if (failure !== 'net::ERR_ABORTED' && diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${failure}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(frame) {
  await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  await frame.waitForSelector('#misread-field .sentence-token');
  await frame.waitForTimeout(120);
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
    await page.waitForSelector('[data-catalog-work-detail] iframe');
    await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v041/'), null, { timeout: 15000 });
    frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v041/'));
    await waitReady(frame);
  }
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    artwork: document.querySelector('.work-inspect__stage, .misread-field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, dataToken: node.dataset?.token ?? null, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tokenCount: document.querySelectorAll('#misread-field .sentence-token').length,
    fieldVisible: Boolean(document.querySelector('#misread-field')?.getBoundingClientRect().width),
    memory: document.querySelector('#misread-field')?.dataset.memoryCount ?? null,
    stage: document.querySelector('[data-stage]')?.textContent ?? null
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
  await waitReady(page.mainFrame());
  const field = page.locator('#misread-field');
  const initial = await page.evaluate(() => ({ signature: window.__mutineNaiveV041.renderSignature(), state: window.__mutineNaiveV041.getState(), memory: document.querySelector('#misread-field').dataset.memoryCount }));
  const source = page.locator('.sentence-token[data-token="2"]');
  const reply = page.locator('.sentence-token[data-token="10"]');
  await source.click();
  const armed = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, signature: window.__mutineNaiveV041.renderSignature(), interaction: window.__mutineNaiveV041.getState().interaction }));
  await source.click();
  const selfReply = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, interaction: window.__mutineNaiveV041.getState().interaction }));
  await reply.click();
  const committed = await page.evaluate(() => {
    const api = window.__mutineNaiveV041;
    const current = api.getState();
    const event = current.memory.at(-1);
    return {
      memory: document.querySelector('#misread-field').dataset.memoryCount,
      interaction: current.interaction,
      signature: api.renderSignature(),
      event,
      sourceSignature: api.tokenSignature(current.scene.tokens[event.source]),
      replySignature: api.tokenSignature(current.scene.tokens[event.reply]),
      baselineSource: api.tokenSignature(api.buildFrame().scene.tokens[event.source]),
      baselineReply: api.tokenSignature(api.buildFrame().scene.tokens[event.reply]),
      changedTokenCount: current.scene.trace.changedTokenCount
    };
  });
  await field.press('Delete');
  const lifted = await page.evaluate((baseline) => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, restored: window.__mutineNaiveV041.renderSignature() === baseline, interaction: window.__mutineNaiveV041.getState().interaction }), initial.signature);
  await field.press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, interaction: window.__mutineNaiveV041.getState().interaction }));
  await field.press('r');
  const released = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, interaction: window.__mutineNaiveV041.getState().interaction }));
  await page.locator('[data-action="infer"]').click();
  const control = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, interaction: window.__mutineNaiveV041.getState().interaction }));
  await page.locator('[data-action="release"]').click();
  const buttons = await page.locator('.misread-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return {
    initialMemory: initial.memory,
    armed,
    selfReply,
    committedMemory: committed.memory,
    committedInteraction: committed.interaction,
    geometryChanged: initial.signature !== committed.signature,
    sourceStayedExact: committed.sourceSignature === committed.baselineSource,
    replyStayedExact: committed.replySignature === committed.baselineReply,
    remoteChanged: committed.changedTokenCount >= 3,
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
  const source = page.locator('.sentence-token[data-token="1"]');
  const reply = page.locator('.sentence-token[data-token="10"]');
  await source.tap();
  await reply.tap();
  const result = await page.evaluate(() => ({ memory: document.querySelector('#misread-field').dataset.memoryCount, interaction: window.__mutineNaiveV041.getState().interaction }));
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
  const evidence = await page.evaluate(() => {
    const state = window.__mutineNaiveV041.getState();
    return {
      tokenCount: document.querySelectorAll('#misread-field .sentence-token').length,
      fieldVisible: document.querySelector('#misread-field')?.getBoundingClientRect().height > 0,
      memory: document.querySelector('#misread-field')?.dataset.memoryCount,
      changedTokenCount: state.scene.trace.changedTokenCount,
      readoutHidden: getComputedStyle(document.querySelector('.misread-readout')).display === 'none',
      controlsHidden: getComputedStyle(document.querySelector('.misread-controls')).display === 'none',
      hintHidden: getComputedStyle(document.querySelector('.misread-hint')).display === 'none',
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
    ['journal', '/journal/', '#journal-naive-2026-10-31'],
    ['current', '/currents/naive-art/', '[data-work-id="naive-2026-10-31"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="naive-2026-10-31"]'],
    ['raw', blindPath, '#misread-field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (name === 'canonical') {
      await page.waitForSelector('[data-catalog-work-detail] iframe');
      await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail] iframe')?.src.includes('/studies/naive-art/v041/'), null, { timeout: 15000 });
    } else if (name === 'raw') await waitReady(page.mainFrame());
    else await page.waitForSelector(selector, { timeout: 15000 });
    if (name === 'canonical') {
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v041/'));
      await waitReady(frame);
      await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
    }
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'naive-2026-10-31'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'naive-2026-10-31'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || entry.tableau.innerWidth !== entry.tableau.clientWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || !entry.tableau.fieldVisible || entry.tableau.tokenCount !== 13 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.committedMemory === '1' && interaction.geometryChanged && interaction.committedInteraction === 'witness-committed' && interaction.sourceStayedExact && interaction.replyStayedExact && interaction.remoteChanged && interaction.selfReply.memory === '0' && interaction.selfReply.interaction === 'witness-refused-self' && interaction.lifted.memory === '0' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.released.memory === '0' && interaction.control.memory === '1' && interaction.buttons.every((button) => button.height >= 44);
  const touchOk = touch.result.memory === '1' && touch.result.interaction === 'witness-committed';
  const blindOk = blind.evidence.fieldVisible && blind.evidence.tokenCount === 13 && blind.evidence.memory === '4' && blind.evidence.changedTokenCount >= 3 && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.hintHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, touch, blind, routes, interactionOk, touchOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !touchOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
