import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const production = process.argv.includes('--production');
const smoke = process.argv.includes('--smoke');
const port = 4280;
const base = production ? 'https://autopoiesis-nine.vercel.app' : `http://127.0.0.1:${port}`;
const proofDir = resolve(`C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v030-2026-10-21${production ? '-production' : ''}`);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = smoke ? [[390, 844]] : [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = smoke ? { raw: '/studies/webgpu/v030/?preview=1&interaction=1' } : { raw: '/studies/webgpu/v030/?preview=1&interaction=1', canonical: '/works/webgpu-2026-10-21/' };

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
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV030), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebGPUV030), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v030/'));
  if (!frame) throw new Error('canonical v030 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV030), null, { timeout: 15000 });
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
  const field = document.querySelector('#exposure-field');
  const buttons = [...document.querySelectorAll('.exposure-controls button')];
  const state = window.__mutineWebGPUV030?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
    state: state ? { ...state, signature: state.signature.slice(0, 32) } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.exposure-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.exposure-controls')).display,
    reducedMotion
  };
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
        if (smoke) console.log(`smoke: ${routeName} ${viewport.join('x')} reduced=${reducedMotion}`);
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
  const state = () => frame.evaluate(() => window.__mutineWebGPUV030.getState());
  const initial = await state();
  const baseline = initial.signature;
  const points = await frame.evaluate(() => window.__mutineWebGPUV030.getWitnessPoints());
  const canvas = frame.locator('#exposure-field');
  const box = await canvas.boundingBox();
  if (!box || points.length < 3) throw new Error('v030 witness points unavailable for interaction probe');
  for (const point of points.slice(0, 3)) {
    await page.mouse.move(box.x + point.x * box.width, box.y + point.y * box.height);
    await page.waitForTimeout(40);
  }
  await page.mouse.move(box.x + box.width + 24, box.y + box.height + 24);
  await page.waitForTimeout(60);
  const committed = await state();
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await frame.getByRole('button', { name: 'leave the room' }).click();
  const button = await state();
  const buttons = await frame.locator('.exposure-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}interaction-390x844.png`);
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { initial, committed, lifted, keyboardCommitted, released, button, baseline, buttons, diagnostics: run.diag, screenshot: screenshotPath };
};

const runBlind = async (browser) => {
  const route = '/studies/webgpu/v030/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV030.getState();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#exposure-field')).display !== 'none',
      state: { ...state, signature: state.signature.slice(0, 32) },
      readoutDisplay: getComputedStyle(document.querySelector('.exposure-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.exposure-controls')).display,
      statusDisplay: getComputedStyle(document.querySelector('.exposure-status')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
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
    const journal = smoke ? null : await runReadback(browser, '/journal/', '#journal-webgpu-2026-10-21', 'journal-390x844');
    const current = smoke ? null : await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current-390x844');
    const work = smoke ? null : await runReadback(browser, '/works/webgpu-2026-10-21/', '[data-catalog-work-detail][data-ready="true"]', 'work-390x844');
    const favicon = smoke ? null : await fetch(`${base}/studio/favicon.svg`);
    const summary = {
      production,
      matrixCount: matrix.length,
      matrixPassed: matrix.every((run) => run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics)),
      diagnosticsCount: matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0),
      overflowCount: matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length,
      matrix,
      interaction,
      blind,
      journal,
      current,
      work,
      favicon: favicon ? { status: favicon.status, contentType: favicon.headers.get('content-type') } : null
    };
    await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ production, matrixCount: matrix.length, matrixPassed: summary.matrixPassed, diagnosticsCount: summary.diagnosticsCount, overflowCount: summary.overflowCount, interaction: interaction ? { initialMemory: interaction.initial.memory, committedMemory: interaction.committed.memory, committedClosed: interaction.committed.event?.closed, committedOpen: interaction.committed.event?.open, liftedMemory: interaction.lifted.memory, keyboardMemory: interaction.keyboardCommitted.memory, releasedMemory: interaction.released.memory, buttonMemory: interaction.button.memory, exactLift: interaction.lifted.signature === interaction.baseline, geometryNeutralBeforeDeparture: interaction.initial.signature === interaction.committed.signature ? 'not-observed' : true, buttons: interaction.buttons } : null, blind: blind ? { fieldVisible: blind.evidence.fieldVisible, memory: blind.evidence.state.memory, scrollWidth: blind.evidence.scrollWidth, readoutDisplay: blind.evidence.readoutDisplay, controlsDisplay: blind.evidence.controlsDisplay } : null, readbacks: { journalTitle: journal?.evidence.title ?? null, currentTitle: current?.evidence.title ?? null, workTitle: work?.evidence.title ?? null }, favicon: summary.favicon }, null, 2));
    if (!summary.matrixPassed || summary.diagnosticsCount || summary.overflowCount || (!smoke && (interaction.committed.memory !== 1 || interaction.committed.event?.closed === interaction.committed.event?.entry || interaction.lifted.signature !== interaction.baseline || interaction.keyboardCommitted.memory !== 1 || interaction.released.memory !== 0 || interaction.button.memory !== 1 || blind.evidence.scrollWidth > blind.evidence.clientWidth || blind.evidence.fieldVisible === false || summary.favicon.status !== 200))) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
  }
};

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
