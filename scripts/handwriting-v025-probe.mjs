import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4247;
const baseUrl = process.env.MUTINE_PROBE_BASE_URL ?? `http://127.0.0.1:${port}`;
const useLocalServer = baseUrl.startsWith('http://127.0.0.1');
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/handwriting-v025-2026-10-08');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/handwriting/v025/?preview=1&interaction=1', canonical: '/works/typography-2026-10-08/' };

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
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

function diagnostics(page) {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
}

async function waitForTableau(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV025), null, { timeout: 30000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._p5Ready), null, { timeout: 30000 });
  return page.frames().find((frame) => frame.url().includes('/studies/handwriting/v025/'));
}

async function inspect(page, frame, canonical, viewport, reducedMotion) {
  const shell = await page.evaluate(({ isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframeTop: iframe?.getBoundingClientRect().top ?? null, headingTop: heading?.getBoundingClientRect().top ?? null, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)) };
  }, { isCanonical: canonical });
  const tableau = await frame.evaluate(() => {
    const plate = document.querySelector('#refusal-plate');
    const blocks = [...document.querySelectorAll('.clause-block')];
    const buttons = [...document.querySelectorAll('.plate-controls button')];
    return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, plateWidth: plate?.getBoundingClientRect().width ?? 0, plateHeight: plate?.getBoundingClientRect().height ?? 0, blockCount: blocks.length, blockText: blocks.map((node) => node.textContent), memory: Number(plate?.dataset.memory ?? -1), grammar: plate?.dataset.grammar ?? null, interaction: plate?.dataset.interaction ?? null, readoutDisplay: getComputedStyle(document.querySelector('.plate-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.plate-controls')).display, hintDisplay: getComputedStyle(document.querySelector('.plate-hint')).display, touchControls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })) };
  });
  return { targetViewport: viewport.join('x'), reducedMotion, shell, tableau };
}

async function state(frame) {
  return frame.evaluate(() => ({ ...window.__mutineHandwritingV025.getState(), signature: window.__mutineHandwritingV025.getSignature(), frame: window.__mutineHandwritingV025.getFrame() }));
}

async function runMatrix(browser) {
  const matrix = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
        const frame = await waitForTableau(page, routeName === 'canonical');
        const evidence = await inspect(page, frame, routeName === 'canonical', viewport, reducedMotion);
        const filename = `handwriting-v025-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
        matrix.push({ routeName, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag, screenshot: filename });
        await page.close();
      }
    }
  }
  return matrix;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle', timeout: 60000 });
  const frame = await waitForTableau(page, false);
  const initial = await state(frame);
  await frame.locator('.clause-block').nth(2).click();
  const selected = await state(frame);
  await frame.locator('#refusal-plate').press('b');
  const keyboard = await state(frame);
  await frame.locator('#refusal-plate').press('Delete');
  const lifted = await state(frame);
  await frame.locator('#letter-input').fill('m');
  await frame.locator('#commit-letter').click();
  const button = await state(frame);
  await frame.locator('#release-letters').click();
  const released = await state(frame);
  const buttons = await frame.locator('.plate-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v025-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, selected, keyboard, lifted, button, released, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/handwriting/v025/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 60000 });
  const frame = await waitForTableau(page, false);
  const evidence = await frame.evaluate(() => ({ plateVisible: getComputedStyle(document.querySelector('#refusal-plate')).display !== 'none', blockCount: document.querySelectorAll('.clause-block').length, readoutDisplay: getComputedStyle(document.querySelector('.plate-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.plate-controls')).display, hintDisplay: getComputedStyle(document.querySelector('.plate-hint')).display, innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v025-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadbacks(browser) {
  const results = {};
  for (const [name, path, marker, title] of [
    ['journal', '/journal/', '#journal-typography-2026-10-08', 'The word asks another word.'],
    ['current', '/currents/handwriting/', '[data-work-id="typography-2026-10-08"]', 'The word asks another word.'],
    ['work', '/works/typography-2026-10-08/', '[data-catalog-work-detail="typography-2026-10-08"]', 'The word asks another word.']
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const diag = diagnostics(page);
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector(marker, { timeout: 30000 });
    results[name] = { found: await page.locator(marker).count(), titleVisible: (await page.locator('body').innerText()).includes(title), innerWidth: await page.evaluate(() => innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), diagnostics: diag };
    await page.screenshot({ path: resolve(proofDir, `handwriting-v025-${name}-390x844.png`), fullPage: true });
    await page.close();
  }
  return results;
}

await mkdir(proofDir, { recursive: true });
if (useLocalServer) await new Promise((resolvePromise, reject) => server.listen(port, '127.0.0.1', (error) => error ? reject(error) : resolvePromise()));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const readbacks = await runReadbacks(browser);
  const report = { target: 'typography-2026-10-08', matrix, interaction, blind, readbacks };
  await writeFile(resolve(proofDir, 'report.json'), JSON.stringify(report, null, 2));
  const diagnosticCount = [...matrix.map((item) => item.diagnostics), interaction.diagnostics, blind.diagnostics, ...Object.values(readbacks).map((item) => item.diagnostics)].reduce((sum, item) => sum + item.consoleMessages.length + item.pageErrors.length + item.failedRequests.length + item.badResponses.length, 0);
  const matrixFailures = matrix.filter((item) => item.evidence.shell.innerWidth !== item.evidence.shell.clientWidth || item.evidence.shell.scrollWidth > item.evidence.shell.innerWidth || item.evidence.tableau.scrollWidth > item.evidence.tableau.innerWidth || !item.evidence.tableau.blockCount || item.evidence.tableau.touchControls.some((button) => button.height < 44));
  const interactionOk = interaction.initial.memory === 0 && interaction.selected.memory === 0 && interaction.selected.selectedClause === 2 && interaction.keyboard.memory === 1 && interaction.keyboard.grammar === 'b' && interaction.keyboard.signature !== interaction.initial.signature && interaction.lifted.memory === 0 && interaction.lifted.signature === interaction.initial.signature && interaction.button.memory === 1 && interaction.button.grammar === 'm' && interaction.released.memory === 0 && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.plateVisible && blind.evidence.blockCount === 12 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = Object.values(readbacks).every((item) => item.found === 1 && item.titleVisible && item.innerWidth === item.clientWidth && item.scrollWidth <= item.innerWidth);
  console.log(JSON.stringify({ matrixRuns: matrix.length, matrixFailures, interaction, blind, readbacks, diagnosticCount, interactionOk, blindOk, readbacksOk, proofDir }, null, 2));
  if (matrixFailures.length || diagnosticCount || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
} finally {
  await browser.close();
  if (useLocalServer) await new Promise((resolvePromise) => server.close(() => resolvePromise()));
}
