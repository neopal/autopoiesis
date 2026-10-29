import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 49378;
const base = process.env.MUTINE_PROBE_BASE ?? `http://127.0.0.1:${port}`;
const useLocalServer = !process.env.MUTINE_PROBE_BASE;
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v038-2026-10-29');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/webgpu/v038/?preview=1&interaction=1',
  canonical: '/works/webgpu-2026-10-29/'
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };

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
  } catch { response.writeHead(404); response.end('not found'); }
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

const waitForTableau = async (page, canonical) => {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV038), null, { timeout: 30000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebGPUV038), null, { timeout: 30000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v038/'));
  if (!frame) throw new Error('canonical v038 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV038), null, { timeout: 30000 });
  return frame;
};

const shellEvidence = async (page, canonical) => page.evaluate((isCanonical) => {
  const iframe = document.querySelector('.work-inspect__stage iframe');
  const heading = document.querySelector('.work-inspect__heading h1');
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframeTop: iframe?.getBoundingClientRect().top ?? null, headingTop: heading?.getBoundingClientRect().top ?? null, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)), ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null };
}, canonical);

const tableauEvidence = async (frame, reduced) => frame.evaluate((reducedMotion) => {
  const canvas = document.querySelector('#signal-field');
  const buttons = [...document.querySelectorAll('.signal-controls button')];
  const state = window.__mutineWebGPUV038?.getState();
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0), canvasCount: document.querySelectorAll('canvas#signal-field').length, state: state ? { ...state, signature: state.signature.slice(0, 32) } : null, controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })), readoutDisplay: getComputedStyle(document.querySelector('.signal-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.signal-controls')).display, statusDisplay: getComputedStyle(document.querySelector('.signal-status')).display, reducedMotion };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion) => {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
  const frame = await waitForTableau(page, route === routes.canonical);
  const shell = await shellEvidence(page, route === routes.canonical);
  const tableau = await tableauEvidence(frame, reducedMotion);
  return { page, frame, diag, shell, tableau };
};

const runMatrix = async (browser) => {
  const results = [];
  await mkdir(proofDir, { recursive: true });
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const filename = `${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`;
        const screenshotPath = resolve(proofDir, filename);
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
  const state = () => frame.evaluate(() => window.__mutineWebGPUV038.getState());
  const initial = await state();
  const baseline = initial.signature;
  const canvas = frame.locator('#signal-field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('v038 signal canvas unavailable for interaction probe');
  const startX = box.x + box.width * 0.19;
  const startY = box.y + box.height * 0.7;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const armed = await state();
  await page.mouse.move(startX + box.width * 0.28, startY - box.height * 0.28);
  const aimed = await state();
  await page.waitForTimeout(120);
  await page.mouse.up();
  const committed = await state();
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await frame.getByRole('button', { name: 'release one signal' }).click();
  const buttonCommitted = await state();
  await frame.getByRole('button', { name: 'lift latest' }).click();
  const buttonLifted = await state();
  const buttons = await frame.locator('.signal-controls button').evaluateAll((nodes) => nodes.map((buttonNode) => ({ text: buttonNode.textContent.trim(), height: Number(buttonNode.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { initial, armed, aimed, committed, lifted, keyboardCommitted, released, buttonCommitted, buttonLifted, baseline, buttons, diagnostics: run.diag, screenshot: screenshotPath };
};

const runBlind = async (browser) => {
  const run = await gotoRoute(browser, '/studies/webgpu/v038/?preview=1&static=1&blind=1', [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV038.getState();
    return { canvasVisible: getComputedStyle(document.querySelector('#signal-field')).display !== 'none', state: { ...state, signature: state.signature.slice(0, 32) }, canvasCount: document.querySelectorAll('canvas#signal-field').length, readoutDisplay: getComputedStyle(document.querySelector('.signal-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.signal-controls')).display, statusDisplay: getComputedStyle(document.querySelector('.signal-status')).display, captionDisplay: getComputedStyle(document.querySelector('.signal-frame figcaption')).display, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  const screenshotPath = resolve(proofDir, 'blind-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot: screenshotPath };
};

const runReadback = async (browser, route, marker, name, expectedText) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForSelector(marker, { timeout: 30000 });
  const evidence = await page.evaluate((needle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, containsExpected: !needle || document.body.innerText.includes(needle) }), expectedText);
  const screenshotPath = resolve(proofDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();
  return { status: response.status(), evidence, diagnostics: diag, screenshot: screenshotPath };
};

const main = async () => {
  await mkdir(proofDir, { recursive: true });
  if (useLocalServer) await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const journal = await runReadback(browser, '/journal/', '#journal-webgpu-2026-10-29', 'journal-390x844', 'The archive wakes after the room empties.');
    const current = await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current-390x844', 'The archive wakes after the room empties.');
    const work = await runReadback(browser, '/works/webgpu-2026-10-29/', '[data-catalog-work-detail][data-ready="true"]', 'work-390x844', 'The archive wakes after the room empties.');
    const registry = await fetch(`${base}/studio/data/works.json`);
    const publicCatalog = await fetch(`${base}/studio/data/catalog-public.json`);
    const favicon = await fetch(`${base}/studio/favicon.svg`);
    const source = await registry.json();
    const catalog = await publicCatalog.json();
    const matrixPassed = matrix.length === 20 && matrix.every((run) => run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.canvasVisible && run.tableau.canvasCount === 1 && run.tableau.state?.kind === 'signal-lattice' && run.tableau.state?.cells?.length === 1152 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = interaction.armed.signature === interaction.baseline && interaction.aimed.signature === interaction.baseline && interaction.committed.memory === 1 && interaction.committed.signature !== interaction.baseline && interaction.lifted.signature === interaction.baseline && interaction.keyboardCommitted.memory === 1 && interaction.released.memory === 0 && interaction.buttonCommitted.memory === 1 && interaction.buttonLifted.memory === 0 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics);
    const blindPassed = blind.evidence.canvasVisible && blind.evidence.canvasCount === 1 && blind.evidence.state.memory === 4 && blind.evidence.state.cells.length === 1152 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'webgpu-2026-10-29');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'webgpu-2026-10-29');
    const readbacksPassed = [journal, current, work].every((result) => result.status === 200 && result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.containsExpected && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && registry.ok && publicCatalog.ok && favicon.ok;
    const summary = { matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registry.status, publicCatalogStatus: publicCatalog.status, faviconStatus: favicon.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work };
    await (await import('node:fs/promises')).writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registry.status, publicCatalogStatus: publicCatalog.status, faviconStatus: favicon.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (useLocalServer) server.close();
  }
};
await main();
