import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v033-2026-10-21');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v033/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-10-21/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(page) {
  await page.waitForFunction(() => window._mutineReady === true || document.querySelector('[data-ready="true"]'), null, { timeout: 10000 });
  await page.waitForTimeout(70);
}

async function waitFrameReady(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v033/'));
  if (!frame) return null;
  await frame.waitForFunction(() => window._mutineReady === true, null, { timeout: 10000 });
  return frame;
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const frame = route === 'canonical' ? await waitFrameReady(page) : null;
  const scope = frame ?? page.mainFrame();
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    firstArtwork: document.querySelector('.work-inspect__stage iframe, #field')?.getBoundingClientRect().toJSON() ?? null
  }));
  const tableau = await scope.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
    memory: document.querySelector('#field')?.dataset.memory ?? null,
    interaction: document.querySelector('#field')?.dataset.interaction ?? null,
    sheetVisible: Boolean(document.querySelector('.sheet'))
  }));
  const result = { route, url, width, height, reduced, metrics, tableau, diagnostics };
  await page.close();
  return result;
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const field = page.locator('#field');
  const box = await field.boundingBox();
  if (!box) throw new Error('v033 field has no bounding box');
  const point = { x: box.x + box.width * 0.22, y: box.y + box.height * 0.34 };
  const initialSignature = await field.getAttribute('data-signature');
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const armedMemory = await field.getAttribute('data-memory');
  await page.waitForTimeout(260);
  await page.mouse.up();
  await page.waitForTimeout(90);
  const committed = {
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== await field.getAttribute('data-signature'),
    interaction: await field.getAttribute('data-interaction'),
    roles: await field.locator('.fault').evaluateAll((nodes) => ({
      receded: nodes.filter((node) => node.classList.contains('fault--receded')).length,
      counterweight: nodes.filter((node) => node.classList.contains('fault--counterweight')).length,
      scarred: nodes.filter((node) => node.classList.contains('fault--scarred')).length
    }))
  };
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature') };
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction') };
  await field.press('r');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const fresh = page.locator('#field');
  const weakStart = await fresh.getAttribute('data-signature');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  const weak = { memory: await fresh.getAttribute('data-memory'), signatureUnchanged: weakStart === await fresh.getAttribute('data-signature'), interaction: await fresh.getAttribute('data-interaction') };
  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();
  const held = { memory: await fresh.getAttribute('data-memory'), interaction: await fresh.getAttribute('data-interaction') };
  await page.screenshot({ path: join(proofDir, 'interaction-pressure-390x844.png'), fullPage: true });
  await page.close();
  return { initialSignatureLength: initialSignature?.length ?? 0, armedMemory, committed, lifted, keyboard, released, weak, held, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v033/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      sheetVisible: Boolean(field?.querySelector('.sheet')),
      faultsVisible: Boolean(field?.querySelectorAll('.fault').length === 7),
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      annotationsHidden: getComputedStyle(annotations).display === 'none',
      memory: field?.dataset.memory,
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
    ['journal', '/journal/', '#journal-svg-2026-10-21'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-10-21"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-10-21"]'],
    ['raw', '/studies/pure-svg/v033/?preview=1&static=1', '#field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    if (name === 'canonical') await waitFrameReady(page);
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => {
    const response = await fetch('/studio/data/works.json');
    const json = await response.json();
    return { status: response.status, matches: json.works.filter((work) => work.id === 'svg-2026-10-21').length };
  });
  await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
  await page.close();
  return { entries, registry, diagnostics };
}

async function startLocalServer() {
  const root = resolve('.');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
      const candidate = resolve(root, `.${requestPath}`);
      if (candidate !== root && !candidate.startsWith(`${root}/`) && !candidate.startsWith(`${root}\\`)) {
        response.writeHead(403); response.end('forbidden'); return;
      }
      let filePath = candidate;
      const details = await stat(filePath);
      if (details.isDirectory()) filePath = resolve(filePath, 'index.html');
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': types[extname(filePath).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404); response.end('not found');
    }
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
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v033 QA — 2026-10-21\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Overflow failures: ${overflow.length}.\n- Diagnostics: ${diagnostics.length}.\n- Interaction: weak=${interaction.weak.interaction}, held=${interaction.held.interaction}, committed memory=${interaction.committed.memory}, roles=${JSON.stringify(interaction.committed.roles)}, lift=${interaction.lifted.memory}, release=${interaction.released.memory}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, sheet=${blind.evidence.sheetVisible}, faults=${blind.evidence.faultsVisible}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}.\n- Captures: interaction-pressure-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
  console.log(JSON.stringify({ matrixRuns: matrix.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interaction, blind, routes, proofDir }, null, 2));
}

await main();
