import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4262;
const baseUrl = process.env.MUTINE_PROBE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v028-2026-10-09');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/p5-brush/v028/?preview=1&interaction=1', canonical: '/works/brush-2026-10-09/' };

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
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineBrushV028Ready));
    return page.frames().find((frame) => frame.url().includes('/studies/p5-brush/v028/'));
  }
  await page.waitForFunction(() => Boolean(window.__mutineBrushV028Ready));
  return page;
}

async function shellEvidence(page, canonical, viewport) {
  return page.evaluate(({ isCanonical, targetViewport }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return { targetViewport, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null, headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)), ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null };
  }, { isCanonical: canonical, targetViewport: viewport.join('x') });
}

async function tableauEvidence(frame, viewport, reduced) {
  return frame.evaluate(({ targetViewport, reducedMotion }) => {
    const field = document.querySelector('#mending-field');
    const svg = document.querySelector('#reservoir-svg');
    const buttons = [...document.querySelectorAll('.mending-controls button')];
    const state = window.__mutineBrushV028?.getState();
    return { targetViewport, reducedMotion, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null, svg: svg ? { width: Number(svg.getBoundingClientRect().width.toFixed(2)), height: Number(svg.getBoundingClientRect().height.toFixed(2)), pathCount: svg.querySelectorAll('[data-wound]').length } : null, state: state ? { ...state, signature: state.signature.slice(0, 32) } : null, controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })), readoutDisplay: getComputedStyle(document.querySelector('.mending-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.mending-controls')).display };
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
        const tableau = await waitForTableau(page, routeName === 'canonical');
        const shell = await shellEvidence(page, routeName === 'canonical', viewport);
        const evidence = await tableauEvidence(tableau, viewport, reducedMotion);
        await page.screenshot({ path: resolve(proofDir, `brush-v028-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell, tableau: evidence, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function drag(page, points) {
  const box = await page.locator('#reservoir-svg').boundingBox();
  await page.mouse.move(box.x + box.width * points[0].x, box.y + box.height * points[0].y, { steps: 3 });
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(box.x + box.width * point.x, box.y + box.height * point.y, { steps: 6 });
  await page.waitForTimeout(20);
  await page.mouse.up();
  await page.waitForTimeout(20);
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'domcontentloaded' });
  await waitForTableau(page, false);
  const state = () => page.evaluate(() => window.__mutineBrushV028.getState());
  const initial = await state();
  const pointsA = [{ x: 0.16, y: 0.62 }, { x: 0.36, y: 0.48 }, { x: 0.64, y: 0.28 }];
  const pointsB = [{ x: 0.82, y: 0.62 }, { x: 0.62, y: 0.44 }, { x: 0.38, y: 0.32 }];
  await page.locator('#reservoir-svg').hover({ position: { x: 15, y: 15 } });
  await page.mouse.down();
  const armed = await state();
  await page.mouse.up();
  const short = await state();
  await drag(page, pointsA);
  const first = await state();
  const firstSignature = first.signature;
  await drag(page, pointsA);
  const repeated = await state();
  await drag(page, pointsB);
  const second = await state();
  await page.locator('#mending-field').focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('r');
  const released = await state();
  await page.keyboard.press('Enter');
  const keyboard = await state();
  await page.keyboard.press('Delete');
  await page.locator('#mend-control').click();
  const button = await state();
  const buttons = await page.locator('.mending-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'brush-v028-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, armed, short, first, firstSignature, repeated, second, lifted, released, keyboard, button, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/p5-brush/v028/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => { const state = window.__mutineBrushV028.getState(); return { fieldVisible: getComputedStyle(document.querySelector('#mending-field')).display !== 'none', svgVisible: getComputedStyle(document.querySelector('#reservoir-svg')).display !== 'none', state: { ...state, signature: state.signature.slice(0, 32) }, readoutDisplay: getComputedStyle(document.querySelector('.mending-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.mending-controls')).display, hintDisplay: getComputedStyle(document.querySelector('.mending-hint')).display, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }; });
  await page.screenshot({ path: resolve(proofDir, 'brush-v028-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, recordAnchor: Boolean(document.querySelector('#journal-brush-2026-10-09, [data-work-id="brush-2026-10-09"]')) }));
  await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsOk(diag) { return !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length; }
function compactState(state) { return { stage: state.stage, memory: state.memory, sealed: state.sealedCount, opened: state.openedCount, signature: state.signature.slice(0, 32), interaction: state.interaction, grammar: state.grammar, woundCount: state.woundCount, pathCount: state.pathCount }; }

async function main() {
  await mkdir(proofDir, { recursive: true });
  server.listen(port, '127.0.0.1');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-brush-2026-10-09', 'brush-v028-journal-390x844.png');
  const current = await runReadback(browser, '/currents/brush/', '[data-catalog-current="brush"] [data-work-id="brush-2026-10-09"]', 'brush-v028-current-390x844.png');
  const work = await runReadback(browser, '/works/brush-2026-10-09/', '[data-catalog-work-detail="brush-2026-10-09"]', 'brush-v028-work-390x844.png');
  const favicon = await (async () => { const response = await fetch(`${baseUrl}/studio/favicon.svg`); return { status: response.status, contentType: response.headers.get('content-type') }; })();
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const { shell, tableau } = result;
    const state = tableau.state;
    return shell.innerWidth !== target || shell.clientWidth !== target || shell.scrollWidth > target || tableau.clientWidth !== tableau.innerWidth || tableau.scrollWidth > tableau.innerWidth || !state || state.woundCount !== 9 || state.pathCount !== 9 || tableau.svg.pathCount !== 9 || (result.reducedMotion ? state.memory !== 4 || state.sealedCount <= 0 || state.openedCount <= 0 : state.memory !== 0) || (result.routeName === 'canonical' && !shell.tableauFirst) || tableau.controls.some((control) => control.height < 44) || !diagnosticsOk(result.diagnostics);
  });
  const interactionOk = interaction.initial.memory === 0 && interaction.armed.memory === 0 && interaction.short.memory === 0 && interaction.first.memory === 1 && interaction.first.signature !== interaction.initial.signature && interaction.repeated.memory === 1 && interaction.repeated.interaction === 'mend-refused' && interaction.repeated.signature === interaction.firstSignature && interaction.second.memory === 2 && interaction.second.signature !== interaction.first.signature && interaction.lifted.memory === 1 && interaction.lifted.signature === interaction.firstSignature && interaction.released.memory === 0 && interaction.keyboard.memory === 1 && interaction.button.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.svgVisible && blind.evidence.state.memory === 4 && blind.evidence.state.woundCount === 9 && blind.evidence.state.pathCount === 9 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth === blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
  const readbacksOk = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth === result.evidence.clientWidth && result.evidence.recordAnchor && diagnosticsOk(result.diagnostics));
  const output = { matrix, interaction: { ...interaction, initial: compactState(interaction.initial), armed: compactState(interaction.armed), short: compactState(interaction.short), first: compactState(interaction.first), repeated: compactState(interaction.repeated), second: compactState(interaction.second), lifted: compactState(interaction.lifted), released: compactState(interaction.released), keyboard: compactState(interaction.keyboard), button: compactState(interaction.button) }, blind, journal, current, work, favicon, summary: { matrixRuns: matrix.length, matrixFailures: failures.length, interactionOk, blindOk, readbacksOk, faviconOk: favicon.status === 200, diagnostics: matrix.filter((result) => diagnosticsOk(result.diagnostics)).length + (interactionOk ? 1 : 0) + (blindOk ? 1 : 0) + (readbacksOk ? 3 : 0) } };
  await writeFile(resolve(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ summary: output.summary, failures }, null, 2));
  if (failures.length || !interactionOk || !blindOk || !readbacksOk || favicon.status !== 200) process.exitCode = 1;
}

main().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
