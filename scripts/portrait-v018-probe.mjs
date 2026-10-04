import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4198;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/portrait-v018-2026-10-02');
const scratchDir = resolve('C:/Users/ASUS/AppData/Local/hermes/profiles/autopoiesis/cache/scratch');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) {
      response.writeHead(403); response.end('forbidden'); return;
    }
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v018/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-02/'
};

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
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV018));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutinePortraitV018));
  return page.frames().find((frame) => frame.url().includes('/studies/self-portrait/v018/'));
}

async function evidenceFor(page, canonical, viewport, reducedMotion) {
  const frame = await waitForTableau(page, canonical);
  return page.evaluate(({ canonical: isCanonical, viewport: targetViewport, reduced }) => {
    const field = isCanonical
      ? document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#pressure-field')
      : document.querySelector('#pressure-field');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    const touchControls = [...(field?.ownerDocument ?? document).querySelectorAll('.field-controls button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
    return {
      targetViewport,
      reducedMotion: reduced,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      iframe: iframe ? { top: Number(iframe.getBoundingClientRect().top.toFixed(2)), height: Number(iframe.getBoundingClientRect().height.toFixed(2)) } : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      mountReady: mount?.dataset.ready ?? null,
      controlsVisible: Boolean(field?.ownerDocument.querySelector('.field-controls') && getComputedStyle(field.ownerDocument.querySelector('.field-controls')).display !== 'none'),
      readoutVisible: Boolean(field?.ownerDocument.querySelector('.surface-readout') && getComputedStyle(field.ownerDocument.querySelector('.surface-readout')).display !== 'none'),
      strandCount: field?.ownerDocument.querySelectorAll('.pressure-strand').length ?? 0,
      touchControls
    };
  }, { canonical, viewport: viewport.join('x'), reduced: reducedMotion });
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
        await waitForTableau(page, routeName === 'canonical');
        const evidence = await evidenceFor(page, routeName === 'canonical', viewport, reducedMotion);
        const filename = `portrait-v018-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(scratchDir, filename), fullPage: true });
        results.push({ routeName, route, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const field = page.locator('#pressure-field');
  const initial = await page.evaluate(() => window.__mutinePortraitV018.getState());
  await field.click({ position: { x: 140, y: 230 } });
  const pointer = await page.evaluate(() => window.__mutinePortraitV018.getState());
  await field.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutinePortraitV018.getState());
  const keyboardSignature = keyboard.signature;
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutinePortraitV018.getState());
  await page.keyboard.press('r');
  const released = await page.evaluate(() => window.__mutinePortraitV018.getState());
  const control = page.locator('#press-control');
  await control.click();
  const button = await page.evaluate(() => window.__mutinePortraitV018.getState());
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: resolve(scratchDir, 'portrait-v018-interaction.png'), fullPage: true });
  await page.close();
  return { initial, pointer, keyboard, keyboardSignature, lifted, released, button, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/self-portrait/v018/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#pressure-field')).display !== 'none',
    registerVisible: document.querySelectorAll('.pressure-strand').length === 17,
    readoutDisplay: getComputedStyle(document.querySelector('.surface-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    marksDisplay: getComputedStyle(document.querySelector('.register-mark')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(scratchDir, 'portrait-v018-blind.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-portrait-2026-10-02, [data-work-id="portrait-2026-10-02"]'))
  }));
  await page.close();
  return { evidence, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await mkdir(scratchDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-portrait-2026-10-02');
  const current = await runReadback(browser, '/currents/self-portrait/', '[data-catalog-current="portrait"] [data-work-id="portrait-2026-10-02"]');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => result.evidence.innerWidth !== Number(result.viewport.split('x')[0])
    || result.evidence.scrollWidth > result.evidence.innerWidth
    || result.evidence.strandCount !== 17
    || (result.routeName === 'canonical' && !result.evidence.tableauFirst)
    || result.diagnostics.consoleMessages.length
    || result.diagnostics.pageErrors.length
    || result.diagnostics.failedRequests.length
    || result.diagnostics.badResponses.length);
  const summary = {
    matrixRuns: matrix.length,
    matrixFailures: failures,
    interaction,
    blind,
    journal,
    current,
    proofDir,
    scratchDir
  };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || interaction.pointer.memory !== interaction.initial.memory || interaction.keyboard.memory !== interaction.initial.memory + 1 || interaction.lifted.memory !== interaction.initial.memory || interaction.released.memory !== 0 || !blind.evidence.registerVisible || blind.evidence.scrollWidth > blind.evidence.innerWidth) process.exitCode = 1;
}

main().catch(async (error) => {
  server.close();
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
