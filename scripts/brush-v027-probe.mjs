import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4253;
const baseUrl = process.env.MUTINE_PROBE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v027-2026-10-08');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/p5-brush/v027/?preview=1&interaction=1',
  canonical: '/works/brush-2026-10-08/'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
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

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForTableau(page, canonical) {
  if (canonical) {
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineBrushV027Ready));
    return page.frames().find((frame) => frame.url().includes('/studies/p5-brush/v027/'));
  }
  await page.waitForFunction(() => Boolean(window.__mutineBrushV027Ready));
  return page;
}

async function shellEvidence(page, canonical, viewport) {
  return page.evaluate(({ isCanonical, targetViewport }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      targetViewport,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    };
  }, { isCanonical: canonical, targetViewport: viewport.join('x') });
}

async function tableauEvidence(frame, viewport, reduced) {
  return frame.evaluate(({ targetViewport, reducedMotion }) => {
    const field = document.querySelector('#fracture-field');
    const canvas = document.querySelector('canvas');
    const buttons = [...document.querySelectorAll('.fracture-controls button')];
    const state = window.__mutineBrushV027?.getState();
    return {
      targetViewport,
      reducedMotion,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      canvas: canvas ? { width: Number(canvas.getBoundingClientRect().width.toFixed(2)), height: Number(canvas.getBoundingClientRect().height.toFixed(2)) } : null,
      state: state ? { ...state, signature: state.signature.slice(0, 32) } : null,
      controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      readoutDisplay: getComputedStyle(document.querySelector('.fracture-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.fracture-controls')).display
    };
  }, { targetViewport: viewport.join('x'), reducedMotion: reduced });
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
        const frame = await waitForTableau(page, routeName === 'canonical');
        const shell = await shellEvidence(page, routeName === 'canonical', viewport);
        const tableau = await tableauEvidence(frame, viewport, reducedMotion);
        await page.screenshot({ path: resolve(proofDir, `brush-v027-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell, tableau, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'domcontentloaded' });
  await waitForTableau(page, false);
  const state = () => page.evaluate(() => window.__mutineBrushV027.getState());
  const initial = await state();
  const canvas = page.locator('canvas');
  const scrape = async (points) => {
    await canvas.hover({ position: points[0] });
    await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(point.x, point.y);
    await page.mouse.up();
  };
  await scrape([{ x: 38, y: 150 }, { x: 150, y: 120 }, { x: 298, y: 60 }]);
  const first = await state();
  const firstSignature = first.signature;
  await scrape([{ x: 38, y: 150 }, { x: 150, y: 120 }, { x: 298, y: 60 }]);
  const repeated = await state();
  await scrape([{ x: 310, y: 150 }, { x: 220, y: 110 }, { x: 84, y: 50 }]);
  const second = await state();
  await page.locator('#fracture-field').focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('r');
  const released = await state();
  await page.keyboard.press('Enter');
  const keyboard = await state();
  await page.keyboard.press('Delete');
  await page.locator('#scrape-control').click();
  const button = await state();
  const buttons = await page.locator('.fracture-controls button').evaluateAll((nodes) => nodes.map((node) => {
    return { text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) };
  }));
  await page.screenshot({ path: resolve(proofDir, 'brush-v027-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, first, firstSignature, repeated, second, lifted, released, keyboard, button, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/p5-brush/v027/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => {
    const state = window.__mutineBrushV027.getState();
    return {
      canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
      fieldVisible: getComputedStyle(document.querySelector('#fracture-field')).display !== 'none',
      state: { ...state, signature: state.signature.slice(0, 32) },
      readoutDisplay: getComputedStyle(document.querySelector('.fracture-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.fracture-controls')).display,
      hintDisplay: getComputedStyle(document.querySelector('.fracture-hint')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: resolve(proofDir, 'brush-v027-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-brush-2026-10-08, [data-work-id="brush-2026-10-08"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsOk(diag) {
  return !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length;
}

function compactState(state) {
  return {
    stage: state.stage,
    memory: state.memory,
    fracture: state.fracturedCount,
    returnCount: state.returnedCount,
    signature: state.signature.slice(0, 32),
    interaction: state.interaction,
    grammar: state.grammar,
    islandCount: state.islandCount,
    lastScrape: state.lastScrape
  };
}

function compactInteraction(interaction) {
  return {
    ...interaction,
    initial: compactState(interaction.initial),
    first: compactState(interaction.first),
    repeated: compactState(interaction.repeated),
    second: compactState(interaction.second),
    lifted: compactState(interaction.lifted),
    released: compactState(interaction.released),
    keyboard: compactState(interaction.keyboard),
    button: compactState(interaction.button)
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-brush-2026-10-08', 'brush-v027-journal-390x844.png');
  const current = await runReadback(browser, '/currents/brush/', '[data-catalog-current="brush"] [data-work-id="brush-2026-10-08"]', 'brush-v027-current-390x844.png');
  const work = await runReadback(browser, '/works/brush-2026-10-08/', '[data-catalog-work-detail="brush-2026-10-08"]', 'brush-v027-work-390x844.png');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const { shell, tableau } = result;
    const state = tableau.state;
    return shell.innerWidth !== target || shell.clientWidth !== target || shell.scrollWidth > target || tableau.clientWidth !== tableau.innerWidth || tableau.scrollWidth > tableau.innerWidth
      || !state || state.islandCount !== 13 || (result.reducedMotion ? state.memory !== 4 || state.fracturedCount <= 0 || state.returnedCount <= 0 : state.memory !== 0)
      || (result.routeName === 'canonical' && !shell.tableauFirst) || tableau.controls.some((control) => control.height < 44) || !diagnosticsOk(result.diagnostics);
  });
  const interactionOk = interaction.initial.memory === 0
    && interaction.first.memory === 1
    && interaction.first.signature !== interaction.initial.signature
    && interaction.repeated.memory === 1
    && interaction.repeated.interaction === 'scrape-refused'
    && interaction.repeated.signature === interaction.firstSignature
    && interaction.second.memory === 2
    && interaction.second.signature !== interaction.first.signature
    && interaction.lifted.memory === 1
    && interaction.lifted.signature === interaction.firstSignature
    && interaction.released.memory === 0
    && interaction.keyboard.memory === 1
    && interaction.button.memory === 1
    && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.canvasVisible && blind.evidence.fieldVisible && blind.evidence.state.memory === 4
    && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none'
    && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const allReadbacksOk = [journal, current, work].every((result) => result.evidence.recordAnchor && result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.innerWidth && diagnosticsOk(result.diagnostics));
  const allDiagnosticsOk = matrix.every((result) => diagnosticsOk(result.diagnostics)) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(blind.diagnostics) && diagnosticsOk(journal.diagnostics) && diagnosticsOk(current.diagnostics) && diagnosticsOk(work.diagnostics);
  const summary = { matrixRuns: matrix.length, matrixFailures: failures.map((result) => ({ routeName: result.routeName, viewport: result.viewport, reducedMotion: result.reducedMotion })), interaction: compactInteraction(interaction), blind, journal, current, work, allDiagnosticsOk, allReadbacksOk, proofDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || !interactionOk || !blindOk || !allReadbacksOk || !allDiagnosticsOk) process.exitCode = 1;
}

await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
main().catch(async (error) => {
  await mkdir(proofDir, { recursive: true });
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  server.close();
  console.error(error.stack || error);
  process.exitCode = 1;
});
