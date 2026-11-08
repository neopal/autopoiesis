import { chromium } from 'playwright';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/svg-v048-2026-11-08-local');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v048/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-11-08/';
const blindPath = '/studies/pure-svg/v048/?preview=1&static=1&blind=1';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (message.type() === 'error' && diagnostics.console.length < 12) diagnostics.console.push(message.text()); });
  page.on('pageerror', (error) => { if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error)); });
  page.on('requestfailed', (request) => { if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`); });
  page.on('response', (response) => { if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitReady(frame) {
  await frame.waitForFunction(() => window._mutineReady === true || document.querySelector('[data-ready="true"]'), null, { timeout: 10000 });
  await frame.waitForTimeout(80);
}

async function waitCanonicalFrame(page) {
  await page.waitForFunction(() => Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v048/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v048/'));
  if (!frame) throw new Error('canonical page did not mount the v048 raw frame');
  await waitReady(frame);
  return frame;
}

async function metricsFor(page, frame) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    firstArtwork: document.querySelector('.work-inspect__stage iframe, #seal')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#seal');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field?.getBoundingClientRect().toJSON() ?? null,
      memory: field?.dataset.memory ?? null,
      interaction: field?.dataset.interaction ?? null,
      compound: field?.querySelectorAll('path[data-compound]').length ?? 0,
      apertures: field?.querySelectorAll('path[data-aperture]').length ?? 0,
      inversionCount: field?.dataset.inversionCount ?? null
    };
  });
  return { metrics, tableau };
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const response = await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  const frame = route === 'canonical' ? await waitCanonicalFrame(page) : page.mainFrame();
  await waitReady(frame);
  const result = { route, url, width, height, reduced, status: response?.status(), ...(await metricsFor(page, frame)), diagnostics };
  await page.close();
  return result;
}

async function screenPoint(field, point) {
  const box = await field.boundingBox();
  if (!box) throw new Error('v048 seal has no bounding box');
  return { x: box.x + point.x * box.width / 1200, y: box.y + point.y * box.height / 760 };
}

async function drag(page, field, from, to) {
  const start = await screenPoint(field, from);
  const end = await screenPoint(field, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + (end.x - start.x) * .42, start.y + (end.y - start.y) * .42, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function dispatchTouchDrag(page, from, to) {
  await page.evaluate(({ from, to }) => {
    const field = document.querySelector('#seal');
    const rect = field.getBoundingClientRect();
    const point = ({ x, y }) => ({ x: rect.left + x * rect.width / 1200, y: rect.top + y * rect.height / 760 });
    const start = point(from);
    const end = point(to);
    const middle = { x: start.x + (end.x - start.x) * .5, y: start.y + (end.y - start.y) * .5 };
    const emit = (type, current, buttons) => field.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: current.x, clientY: current.y, pointerId: 77, pointerType: 'touch', isPrimary: true, buttons }));
    emit('pointerdown', start, 1);
    emit('pointermove', middle, 1);
    emit('pointermove', end, 1);
    emit('pointerup', end, 0);
  }, { from, to });
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const field = page.locator('#seal');
  const gates = await page.evaluate(() => [0, 1, 2].map((index) => window.__mutineSvgV048.gatePoint(index)));
  const initialSignature = await field.getAttribute('data-signature');
  await page.mouse.move((await screenPoint(field, gates[0])).x, (await screenPoint(field, gates[0])).y);
  const held = { memory: await field.getAttribute('data-memory'), signatureUnchanged: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await drag(page, field, gates[0], gates[1]);
  const committed = { memory: await field.getAttribute('data-memory'), geometryChanged: initialSignature !== await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction'), inversionCount: await field.getAttribute('data-inversion-count') };
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.focus();
  await field.press('Enter');
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction'), geometryChanged: initialSignature !== await field.getAttribute('data-signature') };
  await field.press('Escape');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const wrongField = page.locator('#seal');
  const wrongSignature = await wrongField.getAttribute('data-signature');
  await drag(page, wrongField, gates[0], gates[2]);
  const wrongOrder = { memory: await wrongField.getAttribute('data-memory'), restored: wrongSignature === await wrongField.getAttribute('data-signature'), interaction: await wrongField.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const touchField = page.locator('#seal');
  const touchSignature = await touchField.getAttribute('data-signature');
  await dispatchTouchDrag(page, gates[0], gates[1]);
  const touch = { memory: await touchField.getAttribute('data-memory'), interaction: await touchField.getAttribute('data-interaction'), geometryChanged: touchSignature !== await touchField.getAttribute('data-signature') };
  const buttons = await page.locator('.seal-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { held, committed, lifted, keyboard, released, wrongOrder, touch, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const tableauEvidence = await page.evaluate(() => {
    const field = document.querySelector('#seal');
    const readout = document.querySelector('.seal-readout');
    const controls = document.querySelector('.seal-controls');
    const annotations = document.querySelector('.work-annotations');
    const opening = document.querySelector('.work-opening');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      memory: field?.dataset.memory,
      compound: field?.querySelectorAll('path[data-compound]').length ?? 0,
      apertures: field?.querySelectorAll('path[data-aperture]').length ?? 0,
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
  const evidence = { status: response?.status(), ...tableauEvidence };
  await page.screenshot({ path: join(proofDir, 'blind-static-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics };
}

async function readbacks(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const entries = {};
  for (const [name, url, selector] of [
    ['journal', '/journal/', '#journal-svg-2026-11-08'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-11-08"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-11-08"]'],
    ['raw', blindPath, '#seal']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    if (name === 'canonical') await waitCanonicalFrame(page);
    else await waitReady(page);
    await page.waitForTimeout(180);
    entries[name] = { status: response?.status(), visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registryResponse = await page.request.get(`${baseUrl}/studio/data/works.json`);
  const registryJson = await registryResponse.json();
  const registry = { status: registryResponse.status(), matches: registryJson.works.filter((work) => work.id === 'svg-2026-11-08').length, title: registryJson.works.find((work) => work.id === 'svg-2026-11-08')?.title ?? null, rawPath: registryJson.works.find((work) => work.id === 'svg-2026-11-08')?.rawPath ?? null };
  const catalogResponse = await page.request.get(`${baseUrl}/studio/data/catalog-public.json`);
  const catalogJson = await catalogResponse.json();
  const catalog = { status: catalogResponse.status(), matches: catalogJson.works.works.filter((work) => work.id === 'svg-2026-11-08').length, title: catalogJson.works.works.find((work) => work.id === 'svg-2026-11-08')?.title ?? null };
  const favicon = await page.request.get(`${baseUrl}/studio/favicon.svg`);
  await page.screenshot({ path: join(proofDir, 'canonical-390x844.png'), fullPage: true });
  await page.close();
  return { entries, registry, catalog, favicon: { status: favicon.status(), contentType: favicon.headers()['content-type'] }, diagnostics };
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
  baseUrl = `http://127.0.0.1:${address.port}`;
  return server;
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const localServer = baseUrl ? null : await startLocalServer();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ deviceScaleFactor: 1, serviceWorkers: 'block' });
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
  const failures = matrix.filter((entry) => entry.status !== 200 || entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && (entry.tableau.innerWidth !== entry.width || entry.tableau.clientWidth !== entry.width || entry.tableau.scrollWidth > entry.tableau.innerWidth)) || entry.tableau.compound !== 1 || entry.tableau.apertures !== 3 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.held.memory === '0' && interaction.held.signatureUnchanged && interaction.committed.memory === '1' && interaction.committed.geometryChanged && interaction.committed.interaction === 'draw-committed' && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.keyboard.geometryChanged && interaction.released.restored && interaction.wrongOrder.memory === '0' && interaction.wrongOrder.restored && interaction.wrongOrder.interaction === 'draw-refused-order' && interaction.touch.memory === '1' && interaction.touch.geometryChanged && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.status === 200 && blind.evidence.fieldVisible && blind.evidence.compound === 1 && blind.evidence.apertures === 3 && blind.evidence.memory === '4' && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.annotationsHidden && blind.evidence.openingHidden && blind.evidence.keyShortcutsRemoved && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.status === 200 && entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.registry.title === 'The hole changes sides.' && routes.registry.rawPath === '/studies/pure-svg/v048/' && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.catalog.title === 'The hole changes sides.' && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, blind, routes, interactionOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'evidence.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v048 QA — 2026-11-08\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Matrix failures: ${failures.length}; overflow failures: ${overflow.length}; diagnostics: ${diagnostics.length}.\n- Interaction: held=${interaction.held.interaction}, committed=${interaction.committed.interaction}, inversion=${interaction.committed.inversionCount}, lift-restored=${interaction.lifted.restored}, keyboard=${interaction.keyboard.interaction}, release-restored=${interaction.released.restored}, wrong-order=${interaction.wrongOrder.interaction}, touch=${interaction.touch.interaction}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, compound=${blind.evidence.compound}, apertures=${blind.evidence.apertures}, memory=${blind.evidence.memory}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.status}/${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, catalog status=${routes.catalog.status}, catalog matches=${routes.catalog.matches}, favicon=${routes.favicon.status}.\n- Captures: interaction-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
  console.log(JSON.stringify({ baseUrl, matrixRuns: matrix.length, failures: failures.length, overflowCount: overflow.length, diagnostics: diagnostics.length, interactionOk, blindOk, readbacksOk, screenshotCount: 3 }, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
