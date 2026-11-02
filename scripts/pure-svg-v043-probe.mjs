import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

let baseUrl = process.env.MUTINE_BASE_URL ?? '';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v043-2026-11-02');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v043/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-11-02/';

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
  await page.waitForFunction(() => Array.from(window.frames).some((frame) => frame.location.href.includes('/studies/pure-svg/v043/')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v043/'));
  if (!frame) throw new Error('canonical page did not mount the v043 raw frame');
  await waitReady(frame);
  return frame;
}

async function measure(context, route, url, width, height, reduced) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const frame = route === 'canonical' ? await waitCanonicalFrame(page) : page.mainFrame();
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    firstArtwork: document.querySelector('.work-inspect__stage iframe, #field')?.getBoundingClientRect().toJSON() ?? null,
    overflowers: [...document.querySelectorAll('*')].filter((node) => { const rect = node.getBoundingClientRect(); return !node.closest('.work-timeline, .work-timeline-bar') && (rect.right > window.innerWidth + 1 || rect.left < -1); }).slice(0, 8).map((node) => ({ tag: node.tagName, id: node.id, className: node.className?.toString?.() ?? '', rect: node.getBoundingClientRect().toJSON() }))
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
      strandCount: field?.dataset.strandCount ?? null,
      zoneCount: field?.dataset.zoneCount ?? null,
      pathCount: field?.querySelectorAll('path[data-strand]').length ?? 0
    };
  });
  const result = { route, url, width, height, reduced, metrics, tableau, diagnostics };
  await page.close();
  return result;
}

async function zoneCenters(page) {
  return page.locator('#field .pressure-zone[data-zone]').evaluateAll((nodes) => nodes.filter((node) => node.hasAttribute('cx')).map((node) => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) })));
}

async function screenPoint(field, point) {
  const box = await field.boundingBox();
  if (!box) throw new Error('v043 field has no bounding box');
  return { x: box.x + box.width * point.x / 1000, y: box.y + box.height * point.y / 760 };
}

async function dragThroughZones(page, first, second, third) {
  const field = page.locator('#field');
  const a = await screenPoint(field, first);
  const b = await screenPoint(field, second);
  const c = await screenPoint(field, third);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.move(c.x, c.y, { steps: 8 });
  await page.mouse.up();
}

async function dispatchTouchPass(page, points) {
  await page.evaluate((points) => {
    const field = document.querySelector('#field');
    for (const [type, point] of points) field.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 27, pointerType: 'touch', clientX: point.x, clientY: point.y, buttons: type === 'pointerup' ? 0 : 1 }));
  }, points);
}

async function interactionRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const field = page.locator('#field');
  const centers = await zoneCenters(page);
  const points = await Promise.all(centers.map((center) => screenPoint(field, center)));
  const initialSignature = await field.getAttribute('data-signature');
  const initialPaths = await field.locator('path[data-strand]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  await dragThroughZones(page, centers[0], centers[1], centers[2]);
  const committedPaths = await field.locator('path[data-strand]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
  const committedSignature = await field.getAttribute('data-signature');
  const committed = {
    memory: await field.getAttribute('data-memory'),
    geometryChanged: initialSignature !== committedSignature,
    interaction: await field.getAttribute('data-interaction'),
    strandCount: await field.getAttribute('data-strand-count'),
    pathCount: await field.locator('path[data-strand]').count(),
    pending: await field.getAttribute('data-selected'),
    changedStrandCount: committedPaths.filter((path, index) => path !== initialPaths[index]).length
  };
  await field.press('Delete');
  const lifted = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };
  await field.focus();
  await field.press('ArrowRight');
  await field.press('ArrowRight');
  await field.press('ArrowRight');
  await field.press('Enter');
  const keyboard = { memory: await field.getAttribute('data-memory'), interaction: await field.getAttribute('data-interaction'), geometryChanged: initialSignature !== await field.getAttribute('data-signature') };
  await field.press('r');
  const released = { memory: await field.getAttribute('data-memory'), restored: initialSignature === await field.getAttribute('data-signature'), interaction: await field.getAttribute('data-interaction') };

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const fresh = page.locator('#field');
  const freshCenters = await zoneCenters(page);
  const freshField = await fresh.boundingBox();
  const freshPoints = freshCenters.map((center) => ({ x: freshField.x + freshField.width * center.x / 1000, y: freshField.y + freshField.height * center.y / 760 }));
  const unarmedStart = await fresh.getAttribute('data-signature');
  await page.mouse.click(freshPoints[0].x, freshPoints[0].y);
  const incomplete = { memory: await fresh.getAttribute('data-memory'), signatureUnchanged: unarmedStart === await fresh.getAttribute('data-signature'), interaction: await fresh.getAttribute('data-interaction') };
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const reversedField = page.locator('#field');
  const reversedCenters = await zoneCenters(page);
  const reversedPoints = await Promise.all(reversedCenters.map((center) => screenPoint(reversedField, center)));
  const reversedStart = await reversedField.getAttribute('data-signature');
  await page.mouse.move(reversedPoints[2].x, reversedPoints[2].y);
  await page.mouse.down();
  await page.mouse.move(reversedPoints[1].x, reversedPoints[1].y, { steps: 8 });
  await page.mouse.move(reversedPoints[0].x, reversedPoints[0].y, { steps: 8 });
  await page.mouse.up();
  const reversed = { memory: await reversedField.getAttribute('data-memory'), signatureUnchanged: reversedStart === await reversedField.getAttribute('data-signature'), interaction: await reversedField.getAttribute('data-interaction') };
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const touchField = page.locator('#field');
  const touchCenters = await zoneCenters(page);
  const touchPoints = await Promise.all(touchCenters.map((center) => screenPoint(touchField, center)));
  await dispatchTouchPass(page, [['pointerdown', touchPoints[0]], ['pointermove', touchPoints[1]], ['pointermove', touchPoints[2]], ['pointerup', touchPoints[2]]]);
  const touch = { memory: await touchField.getAttribute('data-memory'), interaction: await touchField.getAttribute('data-interaction'), geometryChanged: initialSignature !== await touchField.getAttribute('data-signature') };
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ label: node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: join(proofDir, 'interaction-pressure-loom-390x844.png'), fullPage: true });
  await page.close();
  return { initialSignatureLength: initialSignature?.length ?? 0, committed, lifted, keyboard, released, incomplete, reversed, touch, buttons, diagnostics };
}

async function blindRun(context) {
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v043/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    const zones = document.querySelector('.pressure-zones');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      strandCount: field?.dataset.strandCount,
      memory: field?.dataset.memory,
      pathCount: field?.querySelectorAll('path[data-strand]').length ?? 0,
      zonesHidden: getComputedStyle(zones).display === 'none',
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
    ['journal', '/journal/', '#journal-svg-2026-11-02'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-11-02"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-11-02"]'],
    ['raw', '/studies/pure-svg/v043/?preview=1&static=1', '#field']
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded' });
    await waitReady(page);
    if (name === 'canonical') await waitCanonicalFrame(page);
    await page.waitForTimeout(180);
    entries[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), innerWidth: await page.evaluate(() => window.innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  }
  const registry = await page.evaluate(async () => { const response = await fetch('/studio/data/works.json'); const json = await response.json(); const matches = json.works.filter((work) => work.id === 'svg-2026-11-02'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null }; });
  const catalog = await page.evaluate(async () => { const response = await fetch('/studio/data/catalog-public.json'); const json = await response.json(); const matches = json.works.works.filter((work) => work.id === 'svg-2026-11-02'); return { status: response.status, matches: matches.length, title: matches[0]?.title ?? null }; });
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
  const failures = matrix.filter((entry) => entry.metrics.innerWidth !== entry.width || entry.metrics.clientWidth !== entry.width || entry.metrics.scrollWidth > entry.width || (entry.route === 'raw' && (entry.tableau.innerWidth !== entry.width || entry.tableau.clientWidth !== entry.width)) || entry.tableau.scrollWidth > entry.tableau.innerWidth || entry.tableau.strandCount !== '11' || entry.tableau.pathCount !== 11 || entry.metrics.overflowers.length > 0);
  const interactionOk = interaction.committed.memory === '1' && interaction.committed.geometryChanged && interaction.committed.interaction === 'pass-committed' && interaction.committed.strandCount === '11' && interaction.committed.pathCount === 11 && interaction.committed.changedStrandCount >= 6 && interaction.lifted.restored && interaction.keyboard.memory === '1' && interaction.keyboard.geometryChanged && interaction.released.restored && interaction.incomplete.memory === '0' && interaction.incomplete.signatureUnchanged && interaction.incomplete.interaction === 'pass-refused-incomplete' && interaction.reversed.memory === '0' && interaction.reversed.signatureUnchanged && interaction.reversed.interaction === 'pass-refused-direction' && interaction.touch.memory === '1' && interaction.touch.geometryChanged && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.strandCount === '11' && blind.evidence.memory === '4' && blind.evidence.pathCount === 11 && blind.evidence.zonesHidden && blind.evidence.readoutHidden && blind.evidence.controlsHidden && blind.evidence.annotationsHidden && blind.evidence.keyShortcutsRemoved && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(routes.entries).every((entry) => entry.visible && entry.innerWidth === entry.clientWidth && entry.scrollWidth <= entry.innerWidth) && routes.registry.status === 200 && routes.registry.matches === 1 && routes.registry.title === 'The loom spends the pressure.' && routes.registry.rawPath === '/studies/pure-svg/v043/' && routes.catalog.status === 200 && routes.catalog.matches === 1 && routes.catalog.title === 'The loom spends the pressure.' && routes.favicon.status === 200;
  const result = { baseUrl, proofDir, viewports, matrixRuns: matrix.length, matrix, failures, overflowCount: overflow.length, diagnostics, interaction, blind, routes, interactionOk, blindOk, readbacksOk, screenshotCount: 3, generatedAt: new Date().toISOString() };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(join(proofDir, 'README.md'), `# Pure SVG v043 QA — 2026-11-02\n\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Matrix failures: ${failures.length}; overflow failures: ${overflow.length}; diagnostics: ${diagnostics.length}.\n- Interaction: committed=${interaction.committed.interaction}, geometry-changed=${interaction.committed.geometryChanged}, changed-strands=${interaction.committed.changedStrandCount}, lift-restored=${interaction.lifted.restored}, keyboard=${interaction.keyboard.interaction}, release-restored=${interaction.released.restored}, incomplete=${interaction.incomplete.interaction}, reversed=${interaction.reversed.interaction}, touch=${interaction.touch.interaction}.\n- Touch targets: ${interaction.buttons.map((button) => `${button.label}=${button.width.toFixed(1)}×${button.height.toFixed(1)}`).join(', ')}.\n- Blind preview: field=${blind.evidence.fieldVisible}, strands=${blind.evidence.strandCount}, memory=${blind.evidence.memory}, paths=${blind.evidence.pathCount}, zones-hidden=${blind.evidence.zonesHidden}, readout-hidden=${blind.evidence.readoutHidden}, controls-hidden=${blind.evidence.controlsHidden}, annotations-hidden=${blind.evidence.annotationsHidden}, width=${blind.evidence.innerWidth}/${blind.evidence.clientWidth}/${blind.evidence.scrollWidth}.\n- Readbacks: ${Object.entries(routes.entries).map(([key, value]) => `${key}=${value.visible}`).join(', ')}; registry status=${routes.registry.status}, matches=${routes.registry.matches}, catalog status=${routes.catalog.status}, catalog matches=${routes.catalog.matches}, favicon=${routes.favicon.status}.\n- Captures: interaction-pressure-loom-390x844.png, blind-static-390x844.png, canonical-390x844.png.\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failures.length || diagnostics.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

await main();
