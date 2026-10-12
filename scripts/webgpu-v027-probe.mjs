import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const production = process.argv.includes('--production');
const port = 4277;
const base = production ? 'https://autopoiesis-nine.vercel.app' : `http://127.0.0.1:${port}`;
const proofDir = resolve(`C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v027-2026-10-12${production ? '-production' : ''}`);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/webgpu/v027/?preview=1&interaction=1', canonical: '/works/webgpu-2026-10-12/' };

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
  if (canonical) {
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebGPUV027), null, { timeout: 15000 });
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v027/'));
    if (!frame) throw new Error('canonical v027 iframe frame not found');
    await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV027), null, { timeout: 15000 });
    return frame;
  }
  await page.waitForFunction(() => Boolean(window.__mutineWebGPUV027), null, { timeout: 15000 });
  return page;
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
  const field = document.querySelector('#volume-field');
  const buttons = [...document.querySelectorAll('.volume-controls button')];
  const state = window.__mutineWebGPUV027?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
    state: state ? { ...state, signature: state.signature.slice(0, 32) } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.volume-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.volume-controls')).display,
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
  const { page } = run;
  const state = () => page.evaluate(() => window.__mutineWebGPUV027.getState());
  const canvas = page.locator('#volume-field');
  const initial = await state();
  const points = await page.evaluate(() => window.__mutineWebGPUV027.getBasinPoints());
  const box = await canvas.boundingBox();
  if (!box || points.length < 3) throw new Error('v027 basin points unavailable for gesture probe');
  const moveToPoint = async (index) => page.mouse.move(box.x + points[index].x, box.y + points[index].y);
  await moveToPoint(4);
  await page.mouse.down();
  const armed = await state();
  await moveToPoint(5);
  await moveToPoint(8);
  await page.mouse.up();
  const wake = await state();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboardArmed = await state();
  await page.keyboard.press('Enter');
  const keyboardWake = await state();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'leave a wake' }).click();
  const button = await state();
  await page.getByRole('button', { name: 'release volume' }).click();
  const released = await state();
  const buttons = await page.locator('.volume-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}interaction-390x844.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();
  return { initial, armed, wake, lifted, keyboardArmed, keyboardWake, button, released, buttons, diagnostics: run.diag, screenshot: screenshotPath };
};

const runBlind = async (browser) => {
  const route = '/studies/webgpu/v027/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.page.evaluate(() => {
    const state = window.__mutineWebGPUV027.getState();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#volume-field')).display !== 'none',
      state: { ...state, signature: state.signature.slice(0, 32) },
      readoutDisplay: getComputedStyle(document.querySelector('.volume-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.volume-controls')).display,
      statusDisplay: getComputedStyle(document.querySelector('.volume-status')).display,
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

const allDiagnosticsOk = (matrix, ...runs) => matrix.every((result) => diagnosticsOk(result.diagnostics)) && runs.every((run) => diagnosticsOk(run.diagnostics));

async function main() {
  await mkdir(proofDir, { recursive: true });
  if (server) await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-webgpu-2026-10-12', 'journal-390x844');
  const current = await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"] [data-work-id="webgpu-2026-10-12"]', 'current-390x844');
  const work = await runReadback(browser, '/works/webgpu-2026-10-12/', '[data-catalog-work-detail="webgpu-2026-10-12"]', 'work-390x844');
  await browser.close();
  if (server) server.close();

  const matrixFailures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const state = result.tableau.state;
    const expectedMemory = result.reducedMotion ? 4 : 0;
    return result.shell.innerWidth !== target || result.shell.clientWidth !== target || result.shell.scrollWidth > target
      || result.tableau.innerWidth !== result.tableau.clientWidth || result.tableau.scrollWidth > result.tableau.innerWidth
      || !result.tableau.fieldVisible || !state || state.memory !== expectedMemory
      || (result.reducedMotion ? state.basins.filter((basin) => basin.swell > 0).length < 2 : state.memory !== 0)
      || (result.routeName === 'canonical' && !result.shell.tableauFirst)
      || result.tableau.controls.some((control) => control.height < 44)
      || !diagnosticsOk(result.diagnostics);
  });
  const interactionOk = interaction.initial.memory === 0
    && interaction.armed.memory === 0
    && interaction.armed.armed?.basin !== undefined
    && interaction.armed.signature === interaction.initial.signature
    && interaction.wake.memory === 1
    && interaction.wake.signature !== interaction.initial.signature
    && interaction.wake.events[0].elected !== interaction.wake.events[0].source
    && interaction.lifted.memory === 0
    && interaction.lifted.signature === interaction.initial.signature
    && interaction.keyboardArmed.memory === 0
    && interaction.keyboardWake.memory === 1
    && interaction.button.memory === 1
    && interaction.released.memory === 0
    && interaction.buttons.every((button) => button.height >= 44)
    && diagnosticsOk(interaction.diagnostics);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.state.memory === 4
    && blind.evidence.state.basins.filter((basin) => basin.swell > 0).length >= 2
    && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none'
    && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth && diagnosticsOk(blind.diagnostics);
  const readbacksOk = [journal, current, work].every((run) => run.evidence.innerWidth === run.evidence.clientWidth && run.evidence.scrollWidth <= run.evidence.innerWidth && diagnosticsOk(run.diagnostics));
  const compactState = (value) => value ? { ...value, signature: value.signature.slice(0, 32) } : value;
  const output = {
    target: 'webgpu-v027', base, production, matrixRuns: matrix.length,
    matrixFailures: matrixFailures.map((result) => ({ routeName: result.routeName, viewport: result.viewport, reducedMotion: result.reducedMotion, state: result.tableau.state })),
    interactionOk, blindOk, readbacksOk,
    allDiagnosticsOk: allDiagnosticsOk(matrix, interaction, blind, journal, current, work),
    interaction: { initial: compactState(interaction.initial), armed: compactState(interaction.armed), wake: compactState(interaction.wake), lifted: compactState(interaction.lifted), keyboardArmed: compactState(interaction.keyboardArmed), keyboardWake: compactState(interaction.keyboardWake), button: compactState(interaction.button), released: compactState(interaction.released), buttons: interaction.buttons },
    blind: blind.evidence, journal: journal.evidence, current: current.evidence, work: work.evidence,
    screenshotCount: matrix.length + 5, proofDir
  };
  await writeFile(resolve(proofDir, `${production ? 'production-' : ''}summary.json`), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
  if (matrixFailures.length || !interactionOk || !blindOk || !readbacksOk || !output.allDiagnosticsOk) process.exitCode = 1;
}

main().catch(async (error) => {
  if (server) server.close();
  await mkdir(proofDir, { recursive: true });
  await writeFile(resolve(proofDir, `${production ? 'production-' : ''}error.txt`), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
