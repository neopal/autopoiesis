import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4247;
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/portrait-v023-2026-10-07');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
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

const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v023/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-07/'
};

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForTableau(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV023));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutinePortraitV023));
  return page.frames().find((frame) => frame.url().includes('/studies/self-portrait/v023/'));
}

async function evidenceFor(page, frame, canonical, viewport, reducedMotion) {
  return page.evaluate(({ isCanonical, targetViewport, reduced }) => {
    const owner = isCanonical ? document.querySelector('.work-inspect__stage iframe')?.contentDocument : document;
    const field = owner?.querySelector('#observation-field');
    const canvas = owner?.querySelector('#solid-canvas');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    const controls = [...(owner ?? document).querySelectorAll('.observation-controls button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { text: button.textContent.trim(), width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
    return {
      targetViewport, reducedMotion: reduced, innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      canvasVisible: Boolean(canvas && getComputedStyle(canvas).display !== 'none'),
      iframe: iframe ? { top: Number(iframe.getBoundingClientRect().top.toFixed(2)), height: Number(iframe.getBoundingClientRect().height.toFixed(2)) } : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      mountReady: mount?.dataset.ready ?? null,
      memory: owner?.querySelector('#observation-field')?.dataset.memory ?? null,
      controls
    };
  }, { isCanonical: canonical, targetViewport: viewport.join('x'), reduced: reducedMotion });
}

async function runMatrix(browser, baseUrl) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        const frame = await waitForTableau(page, routeName === 'canonical');
        const evidence = await evidenceFor(page, frame, routeName === 'canonical', viewport, reducedMotion);
        const filename = `portrait-v023-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
        results.push({ routeName, route, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag, screenshot: filename });
        await page.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForTableau(page, false);
  const field = page.locator('#observation-field');
  const initial = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await field.focus();
  await page.keyboard.press('ArrowRight');
  const armed = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await page.keyboard.press('Enter');
  const keyboardSealed = await page.evaluate(() => ({ state: window.__mutinePortraitV023.getState(), frame: window.__mutinePortraitV023.getFrame() }));
  await page.keyboard.press('Delete');
  const restored = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await field.click({ position: { x: 90, y: 220 } });
  const pointerSealed = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await page.locator('[data-action="lift"]').click();
  const liftedByButton = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await page.locator('[data-action="seal"]').click();
  const buttonSealed = await page.evaluate(() => window.__mutinePortraitV023.getState());
  const buttonMetrics = await page.locator('.observation-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.locator('[data-action="release"]').click();
  const released = await page.evaluate(() => window.__mutinePortraitV023.getState());
  await page.screenshot({ path: resolve(proofDir, 'portrait-v023-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, armed, keyboardSealed, restored, pointerSealed, liftedByButton, buttonSealed, buttonMetrics, released, diagnostics: diag };
}

async function runBlind(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/self-portrait/v023/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#observation-field')).display !== 'none',
    canvasVisible: getComputedStyle(document.querySelector('#solid-canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.observation-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.field-hint')).display,
    innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutinePortraitV023.getState()
  }));
  await page.screenshot({ path: resolve(proofDir, 'portrait-v023-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, baseUrl, path, marker, title, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate((expectedTitle) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    titleVisible: document.body.innerText.includes(expectedTitle),
    markerCount: document.querySelectorAll('[id^="journal-portrait-2026-10-07"], [data-work-id="portrait-2026-10-07"], [data-catalog-work-detail="portrait-2026-10-07"]').length
  }), title);
  await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function main() {
  const baseUrl = process.env.MUTINE_PROBE_BASE_URL || `http://127.0.0.1:${port}`;
  const useLocalServer = !process.env.MUTINE_PROBE_BASE_URL;
  await mkdir(proofDir, { recursive: true });
  if (useLocalServer) await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser, baseUrl);
    const interaction = await runInteraction(browser, baseUrl);
    const blind = await runBlind(browser, baseUrl);
    const journal = await runReadback(browser, baseUrl, '/journal/', '#journal-portrait-2026-10-07', 'The portrait keeps what you never saw.', 'portrait-v023-journal-390x844.png');
    const current = await runReadback(browser, baseUrl, '/currents/self-portrait/', '[data-catalog-current="portrait"] [data-work-id="portrait-2026-10-07"]', 'The portrait keeps what you never saw.', 'portrait-v023-current-390x844.png');
    const work = await runReadback(browser, baseUrl, '/works/portrait-2026-10-07/', '[data-catalog-work-detail="portrait-2026-10-07"]', 'The portrait keeps what you never saw.', 'portrait-v023-work-390x844.png');
    const failures = matrix.filter((result) => {
      const width = Number(result.viewport.split('x')[0]);
      return result.evidence.innerWidth !== width || result.evidence.scrollWidth > result.evidence.innerWidth
        || (result.routeName === 'canonical' && !result.evidence.tableauFirst)
        || !result.evidence.canvasVisible
        || result.evidence.controls.some((button) => button.height < 44)
        || result.diagnostics.consoleMessages.length || result.diagnostics.pageErrors.length
        || result.diagnostics.failedRequests.length || result.diagnostics.badResponses.length;
    });
    const interactionFailed = interaction.initial.memory !== 0
      || interaction.armed.memory !== 0
      || interaction.keyboardSealed.state.memory !== 1
      || interaction.keyboardSealed.state.watchedFace === interaction.keyboardSealed.state.alteredFace
      || interaction.keyboardSealed.state.signature === interaction.restored.signature
      || interaction.restored.memory !== 0
      || interaction.pointerSealed.memory !== 1
      || interaction.liftedByButton.memory !== 0
      || interaction.buttonSealed.memory !== 1
      || interaction.buttonMetrics.some((button) => button.height < 44)
      || interaction.released.memory !== 0
      || interaction.diagnostics.consoleMessages.length || interaction.diagnostics.pageErrors.length
      || interaction.diagnostics.failedRequests.length || interaction.diagnostics.badResponses.length;
    const blindFailed = !blind.evidence.fieldVisible || !blind.evidence.canvasVisible
      || blind.evidence.readoutDisplay !== 'none' || blind.evidence.controlsDisplay !== 'none'
      || blind.evidence.hintDisplay !== 'none' || blind.evidence.scrollWidth > blind.evidence.innerWidth;
    const readbacks = { journal, current, work };
    const readbackFailed = Object.values(readbacks).some((entry) => !entry.evidence.titleVisible || entry.evidence.scrollWidth > entry.evidence.innerWidth || entry.diagnostics.consoleMessages.length || entry.diagnostics.pageErrors.length || entry.diagnostics.failedRequests.length || entry.diagnostics.badResponses.length);
    const summary = { baseUrl, matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, readbacks, proofDir };
    await writeFile(resolve(proofDir, `${useLocalServer ? 'local' : 'production'}-results.json`), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    if (failures.length || interactionFailed || blindFailed || readbackFailed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (useLocalServer) server.close();
  }
}

main().catch(async (error) => {
  server.close();
  await mkdir(proofDir, { recursive: true });
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
