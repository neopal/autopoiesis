import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4202;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/pure-svg-v022-2026-10-04');
const scratchDir = resolve('C:/Users/ASUS/AppData/Local/hermes/profiles/autopoiesis/cache/scratch');
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
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/pure-svg/v022/?preview=1&interaction=1',
  canonical: '/works/svg-2026-10-04/'
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
    await page.waitForFunction(() => Boolean(window._mutineReady));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._mutineReady));
  return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v022/'));
}

async function tableauEvidence(page, frame, canonical, viewport, reducedMotion) {
  const shell = await page.evaluate(({ canonical: isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      mountReady: mount?.dataset.ready ?? null
    };
  }, { canonical });
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#field');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      signature: field?.dataset.signature ?? null,
      memory: Number(field?.dataset.memory ?? -1),
      exchanges: Number(field?.dataset.exchangeCount ?? -1),
      facetCount: document.querySelectorAll('.facet').length,
      touchControls: controls.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)) })),
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display
    };
  });
  return { targetViewport: viewport.join('x'), reducedMotion, shell, tableau };
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
        const evidence = await tableauEvidence(page, frame, routeName === 'canonical', viewport, reducedMotion);
        await page.screenshot({ path: resolve(proofDir, `${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
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
  await waitForTableau(page, false);
  const state = () => page.evaluate(() => {
    const field = document.querySelector('#field');
    return { memory: Number(field.dataset.memory), exchanges: Number(field.dataset.exchangeCount), signature: field.dataset.signature, interaction: field.dataset.interaction, notice: field.dataset.notice };
  });
  const initial = await state();
  await page.locator('#field').click({ position: { x: 120, y: 220 } });
  const pointerTap = await state();
  await page.locator('#field').focus();
  await page.keyboard.press('1');
  const armed = await state();
  await page.keyboard.press('Enter');
  const keyboard = await state();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('r');
  const released = await state();
  await page.locator('#field').hover({ position: { x: 90, y: 300 } });
  await page.mouse.move(-10, -10);
  const departure = await state();
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, pointerTap, armed, keyboard, lifted, released, departure, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/pure-svg/v022/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    facetCount: document.querySelectorAll('.facet').length,
    exchangeCount: Number(document.querySelector('#field').dataset.exchangeCount),
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    labelsDisplay: (() => { const node = document.querySelector('.svg-labels'); return node ? getComputedStyle(node).display : 'none'; })(),
    armDisplay: (() => { const node = document.querySelector('.arm-marks'); return node ? getComputedStyle(node).display : 'none'; })(),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
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
    recordAnchor: Boolean(document.querySelector('#journal-svg-2026-10-04, [data-work-id="svg-2026-10-04"]'))
  }));
  await page.close();
  return { evidence, diagnostics: diag };
}

function allDiagnostics(results) {
  return results.flatMap((result) => [result.diagnostics]).every((diag) => !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length);
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await mkdir(scratchDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-svg-2026-10-04');
  const current = await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-04"]');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const evidence = result.evidence;
    return evidence.shell.innerWidth !== target || evidence.shell.scrollWidth > evidence.shell.innerWidth || evidence.tableau.scrollWidth > evidence.tableau.innerWidth || evidence.tableau.facetCount !== 6 || (result.routeName === 'canonical' && !evidence.shell.tableauFirst) || evidence.tableau.touchControls.some((control) => control.height < 44) || !allDiagnostics([result]);
  });
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, proofDir, scratchDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  const interactionOk = interaction.pointerTap.memory === interaction.initial.memory && interaction.armed.memory === interaction.initial.memory && interaction.keyboard.memory === interaction.initial.memory + 1 && interaction.lifted.memory === interaction.initial.memory && interaction.released.memory === 0 && interaction.departure.memory === 1 && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.facetCount === 6 && blind.evidence.exchangeCount >= 4 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.labelsDisplay === 'none' && blind.evidence.armDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  if (failures.length || !interactionOk || !blindOk || !journal.evidence.recordAnchor || !current.evidence.recordAnchor) process.exitCode = 1;
}

main().catch(async (error) => {
  server.close();
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
