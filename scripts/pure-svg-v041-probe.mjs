import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v041-2026-10-31');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v041/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-10-31/';
const NODE_POINTS = [
  { x: .19, y: .28 }, { x: .40, y: .18 }, { x: .74, y: .23 },
  { x: .27, y: .49 }, { x: .53, y: .42 }, { x: .80, y: .50 },
  { x: .17, y: .74 }, { x: .47, y: .72 }, { x: .77, y: .76 }
];

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
  await page.waitForFunction(() => window.frames.length && Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v041/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v041/'));
  if (!frame) throw new Error('canonical page did not mount the v041 raw frame');
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
    overflowers: [...document.querySelectorAll('*')].filter((node) => { const rect = node.getBoundingClientRect(); return !node.closest('.work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1); }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await scope.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
    memory: document.querySelector('#field')?.dataset.memory ?? null,
    interaction: document.querySelector('#field')?.dataset.interaction ?? null,
    nodeCount: document.querySelector('#field')?.dataset.nodeCount ?? null,
    pathCount: document.querySelectorAll('#field path[data-node]').length
  }));
  const result = { route, url, width, height, reduced, metrics, tableau, diagnostics };
  await page.close();
  return result;
}

async function clickNode(page, box, index) {
  const node = NODE_POINTS[index];
  await page.mouse.click(box.x + box.width * node.x, box.y + box.height * node.y);
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
  if (!box) throw new Error('v041 field has no bounding box');
  const initialSignature = await field.getAttribute('data-signature');
  const initialPaths = await field.locator('path[data-node]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  await clickNode(page, box, 0);
  const first = { selected: await field.getAttribute('data-selected'), geometryUnchanged: initialSignature === await field.getAttribute('data-signature'), pathUnchanged: JSON.stringify(initialPaths) === JSON.stringify(await field.locator('path[data-node]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')))) };
  await clickNode(page, box, 1);
  await clickNode(page, box, 4);
  const ready = { selected: await field.getAttribute('data-selected'), geometryUnchanged: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.focus();
  await field.press('Enter');
  const committed = { memory: await field.getAttribute('data-memory'), geometryChanged: initialSignature !== await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction'), nodeCount: await field.getAttribute('data-node-count'), pathCount: await field.locator('path[data-node]').count() };
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.focus();
  await field.press('ArrowRight');
  await field.press('ArrowRight');
  await field.press('ArrowRight');
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction') };
  await field.press('r');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const fresh = page.locator('#field');
  const freshBox = await fresh.boundingBox();
  const unarmedStart = await fresh.getAttribute('data-signature');
  if (!freshBox) throw new Error('fresh v041 field has no bounding box');
  await clickNode(page, freshBox, 2);
  await page.locator('#verdict-control').click();
  const incomplete = { memory: await fresh.getAttribute('data-memory'), signatureUnchanged: unarmedStart === await fresh.getAttribute('data-signature'), interaction: await fresh.getAttribute('data-interaction') };
  await page.screenshot({ path: join(proofDir, 'interaction-hinge-register-390x844.png'), fullPage: true });
  await page.close();
  return { initialSignatureLength: initialSignature?.length ?? 0, first, ready, committed, lifted, keyboard, released, incomplete, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v041/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      nodeCount: field?.dataset.nodeCount,
      memory: field?.dataset.memory,
      pathCount: field?.querySelectorAll('path[data-node]').length ?? 0,
      markersHidden: getComputedStyle(field.querySelector('.field-markers') ?? document.body).display === 'none' || !field.querySelector('.field-markers'),
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
    ['journal', '/journal/', '#journal-svg-2026-10-31'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-10-31"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-10-31"]'],
    ['raw', '/studies/pure-svg/v041/?preview=1&static=1', '#field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    if (name === 'canonical') await waitFrameReady(page);
    await page.waitForTimeout(250);
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'svg-2026-10-31'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'svg-2026-10-31'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
  const favicon = await page.evaluate(async () => { const response = await fetch('/studio/favicon.svg'); return { status: response.status, contentType: response.headers.get('content-type') }; });
  await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && (entry.tableau.innerWidth !== entry.width || entry.tableau.clientWidth !== entry.width)) || entry.tableau.scrollWidth > entry.tableau.innerWidth || entry.tableau.nodeCount !== '9' || entry.tableau.pathCount !== 9 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.first.selected === '0' && interaction.first.geometryUnchanged && interaction.first.pathUnchanged && interaction.ready.selected === '0,1,4' && interaction.ready.geometryUnchanged && interaction.ready.interaction === 'route-ready' && interaction.committed.memory === '1' && interaction.committed.geometryChanged && interaction.committed.interaction === 'route-committed' && interaction.committed.nodeCount === '9' && interaction.committed.pathCount === 9 && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.released.restored && interaction.incomplete.memory === '0' && interaction.incomplete.signatureUnchanged && interaction.incomplete.interaction === 'route-refused-incomplete' && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.nodeCount === '9' && blind.evidence.memory === '4' && blind.evidence.pathCount === 9 && blind.evidence.markersHidden && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.annotationsHidden && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.registry.title === 'The hinge keeps two histories apart.' && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.catalog.title === 'The hinge keeps two histories apart.' && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, blind, routes, interactionOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v041 QA — 2026-10-31\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Matrix failures: ${failures.length}; overflow failures: ${overflow.length}; diagnostics: ${diagnostics.length}.\n- Interaction: first=${interaction.first.geometryUnchanged}, route-ready=${interaction.ready.interaction}, committed=${interaction.committed.interaction}, geometry-changed=${interaction.committed.geometryChanged}, lift-restored=${interaction.lifted.restored}, keyboard=${interaction.keyboard.interaction}, release-restored=${interaction.released.restored}, incomplete=${interaction.incomplete.interaction}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, nodes=${blind.evidence.nodeCount}, memory=${blind.evidence.memory}, paths=${blind.evidence.pathCount}, markers-hidden=${blind.evidence.markersHidden}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, catalog status=${routes.catalog.status}, catalog matches=${routes.catalog.matches}, favicon=${routes.favicon.status}.\n- Captures: interaction-hinge-register-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
