import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4385;
const base = `http://127.0.0.1:${port}`;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v045-2026-11-06-local');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/webgpu/v045/?preview=1&interaction=1', canonical: '/works/webgpu-2026-11-06/' };

const server = http.createServer(async (request, response) => {
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
});

const diagnostics = (page) => {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
};
const diagnosticsOk = (result) => !result.consoleMessages.length && !result.pageErrors.length && !result.failedRequests.length && !result.badResponses.length;
const compactState = (state) => state ? {
  stage: state.stage,
  memory: state.memory,
  events: state.events,
  signature: state.signature?.slice(0, 32),
  gesture: state.gesture,
  lastAction: state.lastAction,
  kind: state.kind,
  cellCount: state.cellCount,
  columns: state.columns,
  rows: state.rows,
  gpuAvailable: state.gpuAvailable,
  memoryLimit: state.memoryLimit,
  loadThresholdMs: state.loadThresholdMs
} : null;

const waitForTableau = async (page, canonical) => {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV045), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v045/'));
  if (!frame) throw new Error('canonical v045 iframe not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV045), null, { timeout: 15000 });
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
  const field = document.querySelector('#strata-field');
  const buttons = [...document.querySelectorAll('.strata-controls button')];
  const state = window.__mutineWebGPUV045?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
    state: state ? { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, cellCount: state.cellCount, columns: state.columns, rows: state.rows, gpuAvailable: state.gpuAvailable, memoryLimit: state.memoryLimit, loadThresholdMs: state.loadThresholdMs } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.strata-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.strata-controls')).display,
    statusDisplay: getComputedStyle(document.querySelector('.strata-status')).display,
    reducedMotion
  };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion, context = browser) => {
  const page = await context.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitForTableau(page, route === routes.canonical);
  const shell = await shellEvidence(page, route === routes.canonical);
  const tableau = await tableauEvidence(frame, reducedMotion);
  return { page, frame, diag, shell, tableau };
};

const runMatrix = async (browser) => {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const screenshotPath = resolve(proofDir, `${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`);
        await run.page.screenshot({ path: screenshotPath, fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell: run.shell, tableau: run.tableau, diagnostics: run.diag, screenshot: screenshotPath, screenshotBytes: (await stat(screenshotPath)).size });
        await run.page.close();
      }
    }
  }
  return results;
};

const runInteraction = async (browser) => {
  const run = await gotoRoute(browser, routes.raw, [390, 844], false);
  const { page, frame } = run;
  const state = () => frame.evaluate(() => window.__mutineWebGPUV045.getState());
  const initial = await state();
  const baseline = initial.signature;
  const canvas = frame.locator('#strata-field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('v045 strata canvas unavailable for interaction probe');
  const point = (ratioX, ratioY) => ({ x: box.x + box.width * ratioX, y: box.y + box.height * ratioY });
  const sourcePoint = point(0.29, 0.31);

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  const armed = await state();
  await page.waitForTimeout(720);
  const loaded = await state();
  await page.mouse.up();
  const committed = await state();
  const event = committed.events[0];
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const released = await state();

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.up();
  const refused = await state();
  const buttons = await frame.locator('.strata-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: false });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, routes.raw, [390, 844], false, touchContext);
  await touchRun.frame.getByRole('button', { name: 'deposit weight' }).tap();
  const touch = { state: await touchRun.frame.evaluate(() => window.__mutineWebGPUV045.getState()), diagnostics: touchRun.diag };
  await touchRun.page.close();
  await touchContext.close();

  return {
    states: { initial: compactState(initial), armed: compactState(armed), loaded: compactState(loaded), committed: compactState(committed), lifted: compactState(lifted), keyboardCommitted: compactState(keyboardCommitted), released: compactState(released), refused: compactState(refused) }, baseline, event,
    geometryNeutralBeforeRelease: armed.memory === 0 && loaded.signature === baseline,
    sourceExact: event && JSON.stringify(initial.cells[event.sourceIndex]) === JSON.stringify(committed.cells[event.sourceIndex]),
    remoteChanged: event && committed.cells.some((cell, index) => index !== event.sourceIndex && JSON.stringify(cell) !== JSON.stringify(initial.cells[index])),
    committedMemory: committed.memory === 1,
    liftedQuiet: lifted.signature === baseline,
    keyboardMemory: keyboardCommitted.memory === 1,
    releasedQuiet: released.memory === 0,
    refusedCharge: refused.memory === 0,
    buttons,
    touch,
    diagnostics: run.diag,
    screenshot: screenshotPath
  };
};

const runBlind = async (browser) => {
  const route = '/studies/webgpu/v045/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV045.getState();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#strata-field')).display !== 'none',
      state: { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, cellCount: state.cellCount, columns: state.columns, rows: state.rows, gpuAvailable: state.gpuAvailable, memoryLimit: state.memoryLimit, loadThresholdMs: state.loadThresholdMs },
      readoutDisplay: getComputedStyle(document.querySelector('.strata-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.strata-controls')).display,
      statusDisplay: getComputedStyle(document.querySelector('.strata-status')).display,
      captionDisplay: getComputedStyle(document.querySelector('.strata-frame figcaption')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  const screenshotPath = resolve(proofDir, 'blind-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot: screenshotPath };
};

const runReadback = async (browser, route, marker, name, title) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector(marker, { timeout: 15000 });
  const evidence = await page.evaluate((expectedTitle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, bodyText: document.body.textContent?.includes(expectedTitle) ?? false }), title);
  const screenshotPath = resolve(proofDir, `${name}-390x844.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag, screenshot: screenshotPath };
};

const main = async () => {
  await mkdir(proofDir, { recursive: true });
  await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const journal = await runReadback(browser, '/journal/', '#journal-webgpu-2026-11-06', 'journal', 'The weight arrives after you leave.');
    const current = await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current', 'The weight arrives after you leave.');
    const work = await runReadback(browser, '/works/webgpu-2026-11-06/', '[data-catalog-work-detail][data-ready="true"]', 'work', 'The weight arrives after you leave.');
    const registryResponse = await fetch(`${base}/studio/data/works.json`);
    const publicResponse = await fetch(`${base}/studio/data/catalog-public.json`);
    const faviconResponse = await fetch(`${base}/studio/favicon.svg`);
    const source = await registryResponse.json();
    const catalog = await publicResponse.json();
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === Number(run.viewport.split('x')[0]) && run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.state?.kind === 'sediment-strata' && run.tableau.state?.cellCount === 72 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = interaction.geometryNeutralBeforeRelease && interaction.sourceExact && interaction.remoteChanged && interaction.committedMemory && interaction.liftedQuiet && interaction.keyboardMemory && interaction.releasedQuiet && interaction.refusedCharge && interaction.touch?.state?.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(interaction.touch.diagnostics);
    const blindPassed = blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.kind === 'sediment-strata' && blind.evidence.state.cellCount === 72 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-06');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-06');
    const readbacksPassed = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.bodyText && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && registryResponse.ok && publicResponse.ok && faviconResponse.ok;
    const summary = { matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work };
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
