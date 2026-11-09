import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = Number(process.env.QA_PORT || 4488);
const base = process.env.QA_BASE || `http://127.0.0.1:${port}`;
const isLocal = !process.env.QA_BASE;
const proofDir = resolve(process.env.QA_PROOF_DIR || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v048-2026-11-09-local');
const rawRoute = '/studies/webgpu/v048/?preview=1&interaction=1';
const canonicalRoute = '/works/webgpu-2026-11-09/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };

const server = isLocal ? http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, base);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) { response.writeHead(403); response.end('forbidden'); return; }
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
}) : null;

const diagnostics = (page) => {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
};
const diagnosticsOk = (result) => !result.consoleMessages.length && !result.pageErrors.length && !result.failedRequests.length && !result.badResponses.length;
const stateShape = (state) => state ? ({ stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, portCount: state.portCount, seamCount: state.seamCount, nextEntry: state.nextEntry, vertexCount: state.vertexCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable }) : null;

const waitForTableau = async (page, canonical) => {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV048), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v048/'));
  if (!frame) throw new Error('canonical v048 iframe not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV048), null, { timeout: 15000 });
  return frame;
};

const shellEvidence = async (page, canonical) => page.evaluate((isCanonical) => {
  const iframe = document.querySelector('.work-inspect__stage iframe');
  const heading = document.querySelector('.work-inspect__heading h1');
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeTop: iframe?.getBoundingClientRect().top ?? null,
    headingTop: heading?.getBoundingClientRect().top ?? null,
    tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
    ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
  };
}, canonical);

const tableauEvidence = async (frame, reduced) => frame.evaluate((reducedMotion) => {
  const field = document.querySelector('#pressure-field');
  const buttons = [...document.querySelectorAll('.pressure-controls button')];
  const state = window.__mutineWebGPUV048?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
    state: state ? { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, portCount: state.portCount, seamCount: state.seamCount, nextEntry: state.nextEntry, vertexCount: state.vertexCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.pressure-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.pressure-controls')).display,
    statusDisplay: getComputedStyle(document.querySelector('.pressure-status')).display,
    reducedMotion
  };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion, context = browser) => {
  const page = await context.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitForTableau(page, route === canonicalRoute);
  const shell = await shellEvidence(page, route === canonicalRoute);
  const tableau = await tableauEvidence(frame, reducedMotion);
  return { page, frame, diag, shell, tableau };
};

const runMatrix = async (browser) => {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of [['raw', rawRoute], ['canonical', canonicalRoute]]) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const screenshot = resolve(proofDir, `${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`);
        await run.page.screenshot({ path: screenshot, fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell: run.shell, tableau: run.tableau, diagnostics: run.diag, screenshot, screenshotBytes: (await stat(screenshot)).size });
        await run.page.close();
      }
    }
  }
  return results;
};

const portRatios = [[0.14, 0.18], [0.72, 0.12], [0.9, 0.52], [0.66, 0.88], [0.12, 0.72]];
const canvasPoint = (box, port) => ({ x: box.x + box.width * portRatios[port][0], y: box.y + box.height * portRatios[port][1] });
const dragPort = async (page, box, entry, exit) => {
  const source = canvasPoint(box, entry);
  const target = canvasPoint(box, exit);
  await page.mouse.move(source.x, source.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 4 });
  await page.mouse.up();
};

const runInteraction = async (browser) => {
  const run = await gotoRoute(browser, rawRoute, [390, 844], false);
  const { page, frame } = run;
  const getState = () => frame.evaluate(() => window.__mutineWebGPUV048.getState());
  const initial = await getState();
  const baseline = initial.signature;
  const canvas = frame.locator('#pressure-field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('v048 pressure canvas unavailable');
  await page.mouse.move(box.x + box.width * .14, box.y + box.height * .18);
  await page.mouse.down();
  const armed = await getState();
  await page.mouse.move(box.x + box.width * .72, box.y + box.height * .12, { steps: 2 });
  await page.mouse.up();
  const wrongExit = await getState();
  await dragPort(page, box, 0, 2);
  const committed = await getState();
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await getState();
  await page.keyboard.press('Enter');
  const keyboardCommitted = await getState();
  await page.keyboard.press('Escape');
  const released = await getState();
  const buttons = await frame.locator('.pressure-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshot = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshot, fullPage: false });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, rawRoute, [390, 844], false, touchContext);
  await touchRun.frame.getByRole('button', { name: 'route pressure' }).tap();
  const touch = { state: await touchRun.frame.evaluate(() => window.__mutineWebGPUV048.getState()), diagnostics: touchRun.diag };
  await touchRun.page.close();
  await touchContext.close();

  return {
    states: { initial: stateShape(initial), armed: stateShape(armed), wrongExit: stateShape(wrongExit), committed: stateShape(committed), lifted: stateShape(lifted), keyboardCommitted: stateShape(keyboardCommitted), released: stateShape(released) },
    baseline,
    geometryNeutralBeforeCommit: armed.memory === 0 && armed.signature === baseline && wrongExit.memory === 0 && wrongExit.signature === baseline,
    committedMemory: committed.memory === 1,
    changedGeometry: committed.signature !== baseline,
    handoff: committed.nextEntry === committed.events[0]?.exit,
    wrongExitRefused: wrongExit.memory === 0 && /refused|exit/i.test(wrongExit.lastAction),
    liftedQuiet: lifted.memory === 0 && lifted.signature === baseline,
    keyboardMemory: keyboardCommitted.memory === 1,
    releasedQuiet: released.memory === 0,
    buttons,
    touch,
    diagnostics: run.diag,
    screenshot
  };
};

const runBlind = async (browser) => {
  const route = '/studies/webgpu/v048/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV048.getState();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#pressure-field')).display !== 'none',
      state: state ? { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, portCount: state.portCount, seamCount: state.seamCount, nextEntry: state.nextEntry, vertexCount: state.vertexCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable } : null,
      readoutDisplay: getComputedStyle(document.querySelector('.pressure-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.pressure-controls')).display,
      statusDisplay: getComputedStyle(document.querySelector('.pressure-status')).display,
      hintDisplay: getComputedStyle(document.querySelector('.pressure-hint')).display,
      captionDisplay: getComputedStyle(document.querySelector('.pressure-frame figcaption')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  const screenshot = resolve(proofDir, 'blind-390x844.png');
  await run.page.screenshot({ path: screenshot, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot };
};

const runReadback = async (browser, route, marker, name, title) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector(marker, { timeout: 15000 });
  const evidence = await page.evaluate((expectedTitle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, bodyText: document.body.textContent?.includes(expectedTitle) ?? false }), title);
  const screenshot = resolve(proofDir, `${name}-390x844.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag, screenshot };
};

const main = async () => {
  await mkdir(proofDir, { recursive: true });
  if (server) await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const journal = await runReadback(browser, '/journal/', '#journal-webgpu-2026-11-09', 'journal', 'The surface chooses the next mouth.');
    const current = await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current', 'The surface chooses the next mouth.');
    const work = await runReadback(browser, canonicalRoute, '[data-catalog-work-detail][data-ready="true"]', 'work', 'The surface chooses the next mouth.');
    const registryResponse = await fetch(`${base}/studio/data/works.json`);
    const publicResponse = await fetch(`${base}/studio/data/catalog-public.json`);
    const faviconResponse = await fetch(`${base}/studio/favicon.svg`);
    const source = await registryResponse.json();
    const catalog = await publicResponse.json();
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === Number(run.viewport.split('x')[0]) && run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.state?.kind === 'pressure-shell' && run.tableau.state?.portCount === 5 && run.tableau.state?.vertexCount === 360 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const interactionPassed = interaction.geometryNeutralBeforeCommit && interaction.committedMemory && interaction.changedGeometry && interaction.handoff && interaction.wrongExitRefused && interaction.liftedQuiet && interaction.keyboardMemory && interaction.releasedQuiet && interaction.touch?.state?.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(interaction.touch.diagnostics);
    const blindPassed = blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.kind === 'pressure-shell' && blind.evidence.state.seamCount === 4 && blind.evidence.state.vertexCount === 360 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-09');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-09');
    const readbacksPassed = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.bodyText && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && registryResponse.ok && publicResponse.ok && faviconResponse.ok;
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0) + interaction.diagnostics.consoleMessages.length + interaction.diagnostics.pageErrors.length + interaction.diagnostics.failedRequests.length + interaction.diagnostics.badResponses.length + blind.diagnostics.consoleMessages.length + blind.diagnostics.pageErrors.length + blind.diagnostics.failedRequests.length + blind.diagnostics.badResponses.length;
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const summary = { base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.close();
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
