import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const production = process.argv.includes('--production');
const smoke = process.argv.includes('--smoke');
const port = 4350;
const base = production ? 'https://autopoiesis-nine.vercel.app' : `http://127.0.0.1:${port}`;
const proofDir = resolve(`C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v035-2026-10-26${production ? '-production' : ''}`);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = smoke ? [[390, 844]] : [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = smoke ? { raw: '/studies/webgpu/v035/?preview=1&interaction=1' } : { raw: '/studies/webgpu/v035/?preview=1&interaction=1', canonical: '/works/webgpu-2026-10-26/' };

const server = production ? null : http.createServer(async (request, response) => {
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
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV035), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebGPUV035), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v035/'));
  if (!frame) throw new Error('canonical v035 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV035), null, { timeout: 15000 });
  return frame;
};
const shellEvidence = async (page, canonical) => page.evaluate((isCanonical) => {
  const iframe = document.querySelector('.work-inspect__stage iframe');
  const heading = document.querySelector('.work-inspect__heading h1');
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframeTop: iframe?.getBoundingClientRect().top ?? null, headingTop: heading?.getBoundingClientRect().top ?? null, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)), ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null };
}, canonical);
const tableauEvidence = async (frame, reduced) => frame.evaluate((reducedMotion) => {
  const field = document.querySelector('#vault-field');
  const buttons = [...document.querySelectorAll('.vault-controls button')];
  const state = window.__mutineWebGPUV035?.getState();
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0), field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null, state: state ? { ...state, signature: state.signature.slice(0, 32) } : null, controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })), readoutDisplay: getComputedStyle(document.querySelector('.vault-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.vault-controls')).display, reducedMotion };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion) => {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
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
  await mkdir(proofDir, { recursive: true });
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const filename = `${production ? 'production-' : ''}${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`;
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
  const state = () => frame.evaluate(() => window.__mutineWebGPUV035.getState());
  const initial = await state();
  const baseline = initial.signature;
  const canvas = frame.locator('#vault-field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('v035 vault canvas unavailable for interaction probe');
  await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.5);
  const primed = await state();
  await page.waitForTimeout(180);
  const waiting = await state();
  await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.5);
  const committed = await state();
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboardPrimed = await state();
  await page.waitForTimeout(180);
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await frame.getByRole('button', { name: 'compress vault' }).click();
  const button = await state();
  const buttons = await frame.locator('.vault-controls button').evaluateAll((nodes) => nodes.map((buttonNode) => ({ text: buttonNode.textContent.trim(), height: Number(buttonNode.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}interaction-390x844.png`);
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { initial, primed, waiting, committed, lifted, keyboardPrimed, keyboardCommitted, released, button, baseline, buttons, diagnostics: run.diag, screenshot: screenshotPath };
};

const runBlind = async (browser) => {
  const route = '/studies/webgpu/v035/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV035.getState();
    return { fieldVisible: getComputedStyle(document.querySelector('#vault-field')).display !== 'none', state: { ...state, signature: state.signature.slice(0, 32) }, readoutDisplay: getComputedStyle(document.querySelector('.vault-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.vault-controls')).display, statusDisplay: getComputedStyle(document.querySelector('.vault-status')).display, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}blind-390x844.png`);
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot: screenshotPath };
};

const runReadback = async (browser, route, marker, name) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector(marker, { timeout: 15000 });
  const evidence = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null }));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag, screenshot: screenshotPath };
};

const main = async () => {
  await mkdir(proofDir, { recursive: true });
  if (server) await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = smoke ? null : await runInteraction(browser);
    const blind = smoke ? null : await runBlind(browser);
    const journal = smoke ? null : await runReadback(browser, '/journal/', '#journal-webgpu-2026-10-26', 'journal-390x844');
    const current = smoke ? null : await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current-390x844');
    const work = smoke ? null : await runReadback(browser, '/works/webgpu-2026-10-26/', '[data-catalog-work-detail][data-ready="true"]', 'work-390x844');
    const registry = await fetch(`${base}/studio/data/works.json`);
    const publicCatalog = await fetch(`${base}/studio/data/catalog-public.json`);
    const favicon = await fetch(`${base}/studio/favicon.svg`);
    const source = await registry.json();
    const catalog = await publicCatalog.json();
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.state?.panels?.length === 12 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = smoke ? true : interaction.primed.signature === interaction.baseline && interaction.waiting.signature === interaction.baseline && interaction.primed.pressure && interaction.committed.memory === 1 && interaction.committed.event.mode === 'double-tap-pressure' && interaction.committed.event.sourcePanel !== interaction.committed.event.responsePanel && interaction.lifted.signature === interaction.baseline && interaction.keyboardPrimed.signature === interaction.baseline && interaction.keyboardCommitted.memory === 1 && interaction.released.memory === 0 && interaction.button.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics);
    const blindPassed = smoke ? true : blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.panels?.length === 12 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'webgpu-2026-10-26');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'webgpu-2026-10-26');
    const readbacksPassed = smoke ? true : [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && registry.ok && publicCatalog.ok && favicon.ok;
    const summary = { production, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registry.status, publicCatalogStatus: publicCatalog.status, faviconStatus: favicon.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, matrix, interaction, blind, journal, current, work };
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ production, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registry.status, publicCatalogStatus: publicCatalog.status, faviconStatus: favicon.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.close();
  }
};
await main();
