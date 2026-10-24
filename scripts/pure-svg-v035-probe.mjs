import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v035-2026-10-24');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v035/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-10-24/';

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
  await page.waitForTimeout(80);
}

async function waitFrameReady(page) {
  await page.waitForFunction(() => Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v035/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v035/'));
  if (!frame) throw new Error('canonical page did not mount the v035 raw frame');
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
    firstArtwork: document.querySelector('.work-inspect__stage iframe, #field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await scope.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
    memory: document.querySelector('#field')?.dataset.memory ?? null,
    interaction: document.querySelector('#field')?.dataset.interaction ?? null,
    portCount: document.querySelector('#field')?.dataset.portCount ?? null,
    openings: document.querySelector('#field')?.dataset.openings ?? null,
    portVisible: document.querySelectorAll('.topology-port').length
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
  if (!box) throw new Error('v035 field has no bounding box');
  const point = { x: box.x + box.width * 0.73, y: box.y + box.height * 0.26 };
  const initialSignature = await field.getAttribute('data-signature');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const committed = {
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== await field.getAttribute('data-signature'),
    interaction: await field.getAttribute('data-interaction'),
    openings: await field.getAttribute('data-openings'),
    roles: await field.locator('.topology-port').evaluateAll((nodes) => ({
      watched: nodes.filter((node) => node.classList.contains('topology-port--watched')).length,
      unobserved: nodes.filter((node) => node.classList.contains('topology-port--unobserved')).length,
      seam: nodes.filter((node) => node.classList.contains('topology-port--seam')).length
    }))
  };
  await field.focus();
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction'), openings: await field.getAttribute('data-openings') };
  await field.press('r');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const fresh = page.locator('#field');
  const weakStart = await fresh.getAttribute('data-signature');
  const weakBox = await fresh.boundingBox();
  await page.mouse.move(weakBox.x + weakBox.width * .5, weakBox.y + weakBox.height * .5);
  await page.mouse.click(weakBox.x + weakBox.width * .5, weakBox.y + weakBox.height * .5);
  const weak = { memory: await fresh.getAttribute('data-memory'), signatureUnchanged: weakStart === await fresh.getAttribute('data-signature'), interaction: await fresh.getAttribute('data-interaction') };
  await page.mouse.move(weakBox.x + weakBox.width * .5, weakBox.y + weakBox.height * .5);
  await page.mouse.down();
  await page.waitForTimeout(1360);
  await page.mouse.up();
  const late = { memory: await fresh.getAttribute('data-memory'), interaction: await fresh.getAttribute('data-interaction') };
  await page.screenshot({ path: join(proofDir, 'interaction-attention-topology-390x844.png'), fullPage: true });
  await page.close();
  return { initialSignatureLength: initialSignature?.length ?? 0, committed, lifted, keyboard, released, weak, late, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v035/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      portCount: field?.querySelectorAll('.topology-port').length ?? 0,
      memory: field?.dataset.memory,
      openings: field?.dataset.openings,
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      annotationsHidden: getComputedStyle(annotations).display === 'none',
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
    ['journal', '/journal/', '#journal-svg-2026-10-24'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-10-24"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-10-24"]'],
    ['raw', '/studies/pure-svg/v035/?preview=1&static=1', '#field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    if (name === 'canonical') await waitFrameReady(page);
    await page.waitForTimeout(250);
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => {
    const response = await fetch('/studio/data/works.json');
    const json = await response.json();
    const matches = json.works.filter((work) => work.id === 'svg-2026-10-24');
    return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null };
  });
  const favicon = await page.evaluate(async () => {
    const response = await fetch('/studio/favicon.svg');
    return { status: response.status, contentType: response.headers.get('content-type') };
  });
  await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
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
  const overflow = matrix.filter((entry) => entry.metrics.scrollWidth > entry.metrics.innerWidth || entry.tableau.scrollWidth > entry.tableau.innerWidth || entry.metrics.overflowers.length > 0);
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, overflowCount: overflow.length, diagnostics, interaction, blind, routes, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v035 QA — 2026-10-24\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Overflow failures: ${overflow.length}.\n- Diagnostics: ${diagnostics.length}.\n- Interaction: committed=${interaction.committed.interaction}, geometry-changed=${interaction.committed.geometryChanged}, openings=${interaction.committed.openings}, lift-restored=${interaction.lifted.restored}, keyboard=${interaction.keyboard.interaction}, release-restored=${interaction.released.restored}, weak=${interaction.weak.interaction}, late=${interaction.late.interaction}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, ports=${blind.evidence.portCount}, memory=${blind.evidence.memory}, openings=${blind.evidence.openings}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, title=${routes.registry.title}, favicon=${routes.favicon.status}.\n- Captures: interaction-attention-topology-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
}

await main();
