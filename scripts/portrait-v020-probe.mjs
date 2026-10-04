import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4220;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/portrait-v020-2026-10-04');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
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
  raw: '/studies/self-portrait/v020/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-04/'
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
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV020));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutinePortraitV020));
  return page.frames().find((frame) => frame.url().includes('/studies/self-portrait/v020/'));
}

async function evidenceFor(page, frame, canonical, viewport, reducedMotion) {
  const evidence = await page.evaluate(({ isCanonical, targetViewport, reduced }) => {
    const owner = isCanonical ? document.querySelector('.work-inspect__stage iframe')?.contentDocument : document;
    const canvas = owner?.querySelector('#yield-field');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    const touchControls = [...(owner ?? document).querySelectorAll('.field-controls button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) };
    });
    return {
      targetViewport, reducedMotion: reduced, innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      canvas: canvas ? { width: Number(canvas.getBoundingClientRect().width.toFixed(2)), height: Number(canvas.getBoundingClientRect().height.toFixed(2)) } : null,
      iframe: iframe ? { top: Number(iframe.getBoundingClientRect().top.toFixed(2)), height: Number(iframe.getBoundingClientRect().height.toFixed(2)) } : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      mountReady: mount?.dataset.ready ?? null,
      ribCount: owner?.querySelector('#yield-field') ? 13 : null,
      touchControls
    };
  }, { isCanonical: canonical, targetViewport: viewport.join('x'), reduced: reducedMotion });
  return evidence;
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
        const frame = await waitForTableau(page, routeName === 'canonical');
        const evidence = await evidenceFor(page, frame, routeName === 'canonical', viewport, reducedMotion);
        const filename = `portrait-v020-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
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
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page, false);
  const canvas = page.locator('#yield-field');
  const initial = await page.evaluate(() => window.__mutinePortraitV020.getState());
  await canvas.click({ position: { x: 190, y: 320 } });
  const pointerTap = await page.evaluate(() => window.__mutinePortraitV020.getState());
  await canvas.focus();
  await page.mouse.move(190, 320);
  await page.mouse.down();
  await page.waitForTimeout(720);
  await page.mouse.move(214, 334);
  await page.mouse.up();
  const held = await page.evaluate(() => window.__mutinePortraitV020.getState());
  const committedSignature = held.signature;
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutinePortraitV020.getState());
  await page.keyboard.down(' ');
  await page.waitForTimeout(700);
  await page.keyboard.up(' ');
  const keyboardHold = await page.evaluate(() => window.__mutinePortraitV020.getState());
  await page.keyboard.press('r');
  const released = await page.evaluate(() => window.__mutinePortraitV020.getState());
  await page.locator('#press-control').click();
  const button = await page.evaluate(() => window.__mutinePortraitV020.getState());
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
  const frameInfo = await frame.evaluate(() => ({ canvasVisible: getComputedStyle(document.querySelector('#yield-field')).display !== 'none', dataMemory: document.querySelector('#yield-field').dataset.memory }));
  await page.screenshot({ path: resolve(proofDir, 'portrait-v020-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, pointerTap, held, committedSignature, lifted, keyboardHold, released, button, buttons, frameInfo, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/self-portrait/v020/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('#yield-field')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.surface-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    annotationDisplay: getComputedStyle(document.querySelector('.work-annotations')).display,
    innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofDir, 'portrait-v020-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-portrait-2026-10-04, [data-work-id="portrait-2026-10-04"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-portrait-2026-10-04', 'portrait-v020-journal-390x844.png');
  const current = await runReadback(browser, '/currents/self-portrait/', '[data-catalog-current="portrait"] [data-work-id="portrait-2026-10-04"]', 'portrait-v020-current-390x844.png');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const width = Number(result.viewport.split('x')[0]);
    return result.evidence.innerWidth !== width || result.evidence.scrollWidth > result.evidence.innerWidth
      || (result.routeName === 'canonical' && !result.evidence.tableauFirst)
      || result.evidence.touchControls.some((button) => button.height < 44)
      || result.diagnostics.consoleMessages.length || result.diagnostics.pageErrors.length
      || result.diagnostics.failedRequests.length || result.diagnostics.badResponses.length;
  });
  const interactionFailed = interaction.pointerTap.memory !== interaction.initial.memory
    || interaction.held.memory !== interaction.initial.memory + 1
    || interaction.held.signature === interaction.initial.signature
    || interaction.lifted.memory !== interaction.initial.memory
    || interaction.keyboardHold.memory !== interaction.initial.memory + 1
    || interaction.released.memory !== 0
    || interaction.button.memory !== 1
    || interaction.buttons.some((button) => button.height < 44)
    || interaction.diagnostics.consoleMessages.length || interaction.diagnostics.pageErrors.length
    || interaction.diagnostics.failedRequests.length || interaction.diagnostics.badResponses.length;
  const blindFailed = !blind.evidence.canvasVisible || blind.evidence.readoutDisplay !== 'none' || blind.evidence.controlsDisplay !== 'none'
    || blind.evidence.scrollWidth > blind.evidence.innerWidth;
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, proofDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || interactionFailed || blindFailed) process.exitCode = 1;
}

main().catch(async (error) => {
  server.close();
  await mkdir(proofDir, { recursive: true });
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
