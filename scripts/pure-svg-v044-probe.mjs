import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/svg-v044-2026-11-04-local');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v044/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-11-04/';

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => { if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`); });
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
  await page.waitForFunction(() => Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v044/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v044/'));
  if (!frame) throw new Error('canonical page did not mount the v044 raw frame');
  await waitReady(frame);
  return frame;
}

async function pageMetrics(page, route, frame) {
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
      return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
  }));
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field?.getBoundingClientRect().toJSON() ?? null,
      memory: field?.dataset.memory ?? null,
      interaction: field?.dataset.interaction ?? null,
      apertureCount: field?.dataset.apertureCount ?? null,
      splitCount: field?.dataset.splitCount ?? null,
      aperturePaths: field?.querySelectorAll('path[data-aperture]').length ?? 0,
      secondaryPaths: field?.querySelectorAll('path[data-secondary-aperture]').length ?? 0
    };
  });
  return { route, metrics, tableau };
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  const frame = route === 'canonical' ? await waitCanonicalFrame(page) : page.mainFrame();
  await waitReady(frame);
  const result = { route, url, width, height, reduced, ...(await pageMetrics(page, route, frame)), diagnostics };
  await page.close();
  return result;
}

async function screenPoint(field, point) {
  const box = await field.boundingBox();
  if (!box) throw new Error('v044 field has no bounding box');
  return { x: box.x + box.width * point.x / 1000, y: box.y + box.height * point.y / 760 };
}

async function dispatchTouchCut(page, start, rim) {
  await page.evaluate(({ start, rim }) => {
    const field = document.querySelector('#field');
    const events = [
      ['pointerdown', start, 1],
      ['pointermove', rim, 1],
      ['pointerup', rim, 0]
    ];
    for (const [type, point, buttons] of events) field.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 27, pointerType: 'touch', clientX: point.x, clientY: point.y, buttons }));
  }, { start, rim });
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const field = page.locator('#field');
  const start = await screenPoint(field, { x: 302, y: 262 });
  const rim = await screenPoint(field, { x: 146, y: 258 });
  const initialSignature = await field.getAttribute('data-signature');
  const initialSourcePath = await field.locator('path[data-aperture="0"]').getAttribute('d');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(rim.x, rim.y, { steps: 10 });
  await page.mouse.up();
  const committedSourcePath = await field.locator('path[data-aperture="0"]').getAttribute('d');
  const committed = {
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== await field.getAttribute('data-signature'),
    interaction: await field.getAttribute('data-interaction'),
    splitCount: await field.getAttribute('data-split-count'),
    aperturePaths: await field.locator('path[data-aperture]').count(),
    secondaryPaths: await field.locator('path[data-secondary-aperture]').count(),
    sourceExact: initialSourcePath === committedSourcePath
  };
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.focus();
  await field.press('ArrowRight');
  await field.press('ArrowRight');
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction'), geometryChanged: initialSignature !== await field.getAttribute('data-signature') };
  await field.press('Escape');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const incompleteField = page.locator('#field');
  const incompleteStart = await screenPoint(incompleteField, { x: 500, y: 216 });
  const incompleteSignature = await incompleteField.getAttribute('data-signature');
  await page.mouse.click(incompleteStart.x, incompleteStart.y);
  const incomplete = { memory: await incompleteField.getAttribute('data-memory'), signatureUnchanged: incompleteSignature === await incompleteField.getAttribute('data-signature'), interaction: await incompleteField.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const reentryField = page.locator('#field');
  const reentryStart = await screenPoint(reentryField, { x: 500, y: 216 });
  const reentryRim = await screenPoint(reentryField, { x: 432, y: 118 });
  const reentrySignature = await reentryField.getAttribute('data-signature');
  await page.mouse.move(reentryStart.x, reentryStart.y);
  await page.mouse.down();
  await page.mouse.move(reentryRim.x, reentryRim.y, { steps: 8 });
  await page.mouse.move(reentryStart.x, reentryStart.y, { steps: 8 });
  await page.mouse.up();
  const reentry = { memory: await reentryField.getAttribute('data-memory'), signatureUnchanged: reentrySignature === await reentryField.getAttribute('data-signature'), interaction: await reentryField.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const touchField = page.locator('#field');
  const touchStart = await screenPoint(touchField, { x: 302, y: 262 });
  const touchRim = await screenPoint(touchField, { x: 146, y: 258 });
  await dispatchTouchCut(page, touchStart, touchRim);
  const touch = { memory: await touchField.getAttribute('data-memory'), interaction: await touchField.getAttribute('data-interaction'), geometryChanged: initialSignature !== await touchField.getAttribute('data-signature') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-topology-skin-390x844.png'), fullPage: true });
  await page.close();
  return { committed, lifted, keyboard, released, incomplete, reentry, touch, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v044/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    const rims = document.querySelector('.rim-field');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      memory: field?.dataset.memory,
      splitCount: field?.dataset.splitCount,
      apertureCount: field?.dataset.apertureCount,
      aperturePaths: field?.querySelectorAll('path[data-aperture]').length ?? 0,
      secondaryPaths: field?.querySelectorAll('path[data-secondary-aperture]').length ?? 0,
      rimsHidden: Boolean(rims && [...rims.querySelectorAll('.rim-marker')].every((node) => getComputedStyle(node).display === 'none')),
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      annotationsHidden: getComputedStyle(annotations).display === 'none',
      keyShortcutsRemoved: !field?.hasAttribute('aria-keyshortcuts'),
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
    ['journal', '/journal/', '#journal-svg-2026-11-04'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-11-04"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-11-04"]'],
    ['raw', '/studies/pure-svg/v044/?preview=1&static=1', '#field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    if (name === 'canonical') await waitCanonicalFrame(page);
    else await waitReady(page);
    await page.waitForTimeout(180);
    entries[name] = { status: (await page.request.get(`${baseUrl}${url}`)).status(), visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'svg-2026-11-04'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'svg-2026-11-04'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && (entry.tableau.innerWidth !== entry.width || entry.tableau.clientWidth !== entry.width || entry.tableau.scrollWidth > entry.tableau.innerWidth)) || entry.tableau.apertureCount !== '6' || entry.tableau.aperturePaths !== 6 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.committed.memory === '1' && interaction.committed.geometryChanged && interaction.committed.interaction === 'cut-committed' && interaction.committed.splitCount === '1' && interaction.committed.aperturePaths === 6 && interaction.committed.secondaryPaths === 1 && interaction.committed.sourceExact && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.keyboard.geometryChanged && interaction.released.restored && interaction.incomplete.memory === '0' && interaction.incomplete.signatureUnchanged && interaction.incomplete.interaction === 'cut-refused-incomplete' && interaction.reentry.memory === '0' && interaction.reentry.signatureUnchanged && interaction.reentry.interaction === 'cut-refused-reentry' && interaction.touch.memory === '1' && interaction.touch.geometryChanged && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.apertureCount === '6' && blind.evidence.memory === '4' && blind.evidence.splitCount === '4' && blind.evidence.aperturePaths === 6 && blind.evidence.secondaryPaths === 4 && blind.evidence.rimsHidden && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.annotationsHidden && blind.evidence.keyShortcutsRemoved && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.status === 200 && entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.registry.title === 'The cut changes its elsewhere.' && routes.registry.rawPath === '/studies/pure-svg/v044/' && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.catalog.title === 'The cut changes its elsewhere.' && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, blind, routes, interactionOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v044 QA — 2026-11-04\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Matrix failures: ${failures.length}; overflow failures: ${overflow.length}; diagnostics: ${diagnostics.length}.\n- Interaction: committed=${interaction.committed.interaction}, geometry-changed=${interaction.committed.geometryChanged}, remote-splits=${interaction.committed.secondaryPaths}, source-exact=${interaction.committed.sourceExact}, lift-restored=${interaction.lifted.restored}, keyboard=${interaction.keyboard.interaction}, release-restored=${interaction.released.restored}, incomplete=${interaction.incomplete.interaction}, reentry=${interaction.reentry.interaction}, touch=${interaction.touch.interaction}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, apertures=${blind.evidence.apertureCount}, splits=${blind.evidence.splitCount}, memory=${blind.evidence.memory}, secondary-paths=${blind.evidence.secondaryPaths}, rims-hidden=${blind.evidence.rimsHidden}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.status}/${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, catalog status=${routes.catalog.status}, catalog matches=${routes.catalog.matches}, favicon=${routes.favicon.status}.\n- Captures: interaction-topology-skin-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
