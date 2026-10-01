import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4196;
const targetBase = process.env.MUTINE_PROBE_BASE_URL || `http://127.0.0.1:${port}`;
const proofRoot = resolve(process.env.MUTINE_PROBE_OUTPUT || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v021-2026-10-01');
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
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/p5-brush/v021/?preview=1&interaction=1',
  canonical: '/works/brush-2026-10-01/'
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

function diagnosticsFor(page) {
  const diagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => diagnostics.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitForSurface(page, route) {
  if (route === routes.raw) await page.waitForSelector('#grain-canvas', { state: 'attached', timeout: 12000 });
  else await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { state: 'attached', timeout: 12000 });
}

async function probePage(browser, path, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${targetBase}${path}`, { waitUntil: 'networkidle' });
  await waitForSurface(page, path);
  await page.waitForTimeout(100);
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('#grain-canvas');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const frame = iframe?.contentDocument?.querySelector('#grain-canvas');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    const field = document.querySelector('#grain-field');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: (canvas || frame) ? { width: (canvas || frame).getBoundingClientRect().width, height: (canvas || frame).getBoundingClientRect().height } : null,
      tableauTop: iframe?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      mountReady: mount?.dataset.ready ?? null,
      fieldDataset: field ? { stage: field.dataset.stage, memory: field.dataset.memory, removed: field.dataset.removed, interaction: field.dataset.interaction } : null
    };
  });
  if (viewport[0] === 390 || viewport[0] === 1920) await page.screenshot({ path: resolve(proofRoot, `${path === routes.raw ? 'raw' : 'canonical'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { path, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics };
}

async function interactionProbe(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${targetBase}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#grain-canvas');
  const snapshot = () => page.evaluate(() => ({
    ...document.querySelector('#grain-field').dataset,
    touchTargets: [...document.querySelectorAll('.grain-controls button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
  }));
  const initial = await snapshot();
  const field = page.locator('#grain-canvas');
  const box = await field.boundingBox();
  await field.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  const tap = await snapshot();
  await page.mouse.move(box.x + box.width * 0.18, box.y + box.height * 0.7);
  await page.mouse.down();
  for (const amount of [0.32, 0.48, 0.64, 0.8]) await page.mouse.move(box.x + box.width * amount, box.y + box.height * (0.7 - (amount - 0.18) * 0.28));
  await page.mouse.up();
  const dragged = await snapshot();
  await field.focus();
  await page.keyboard.press('Enter');
  const keyboard = await snapshot();
  await page.keyboard.press('Delete');
  const lifted = await snapshot();
  await page.keyboard.press('r');
  const released = await snapshot();
  await page.screenshot({ path: resolve(proofRoot, 'interaction-390x844-reduced.png'), fullPage: true });
  await page.close();
  return { initial, tap, dragged, keyboard, lifted, released, diagnostics };
}

async function blindProbe(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = diagnosticsFor(page);
  const path = '/studies/p5-brush/v021/?preview=1&static=1&blind=1';
  await page.goto(`${targetBase}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#grain-canvas');
  const evidence = await page.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('#grain-canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.grain-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.grain-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofRoot, 'blind-390x844-reduced.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics };
}

async function focusedProbe(browser) {
  const checks = [
    { name: 'journal', path: '/journal/', selector: '[data-catalog="journal"]', assertion: () => ({ anchor: Boolean(document.querySelector('#journal-brush-2026-10-01')), title: document.body.textContent.includes('The brush answers under the cut.') }) },
    { name: 'current', path: '/currents/brush/', selector: '[data-catalog-current="brush"][data-ready="true"]', assertion: () => ({ latestCard: Boolean(document.querySelector('[data-work-id="brush-2026-10-01"]')), header: document.querySelector('.catalog-current-header__title')?.textContent ?? null }) },
    { name: 'works-json', path: '/studio/data/works.json', selector: null, assertion: () => ({ record: true }) },
    { name: 'favicon', path: '/studio/favicon.svg', selector: null, assertion: () => ({ record: true }) }
  ];
  const results = [];
  for (const check of checks) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const diagnostics = diagnosticsFor(page);
    const response = await page.goto(`${targetBase}${check.path}`, { waitUntil: 'networkidle' });
    if (check.selector) await page.waitForSelector(check.selector, { timeout: 12000 });
    const evidence = await page.evaluate(check.assertion);
    evidence.status = response?.status() ?? null;
    Object.assign(evidence, await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    })));
    if (check.name !== 'works-json' && check.name !== 'favicon') await page.screenshot({ path: resolve(proofRoot, `${check.name}-390x844-reduced.png`), fullPage: true });
    await page.close();
    results.push({ name: check.name, evidence, diagnostics });
  }
  return results;
}

async function main() {
  await mkdir(proofRoot, { recursive: true });
  const localServer = targetBase.startsWith(`http://127.0.0.1:${port}`);
  if (localServer) await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const path of Object.values(routes)) {
      for (const viewport of viewports) results.push(await probePage(browser, path, viewport, reducedMotion));
    }
  }
  const interaction = await interactionProbe(browser);
  const blind = await blindProbe(browser);
  const focused = await focusedProbe(browser);
  await browser.close();
  if (localServer) server.close();
  const matrixFailures = results.filter((result) => {
    const width = Number(result.viewport.split('x')[0]);
    return result.evidence.innerWidth !== width || result.evidence.scrollWidth > result.evidence.innerWidth || result.diagnostics.consoleMessages.length || result.diagnostics.pageErrors.length || result.diagnostics.failedRequests.length || result.diagnostics.badResponses.length;
  });
  const allDiagnostics = [...results.map((item) => item.diagnostics), interaction.diagnostics, blind.diagnostics, ...focused.map((item) => item.diagnostics)];
  const diagnosticsCount = allDiagnostics.reduce((sum, item) => sum + item.consoleMessages.length + item.pageErrors.length + item.failedRequests.length + item.badResponses.length, 0);
  const result = { target: 'brush v021 / 2026-10-01', targetBase, matrixRuns: results.length, matrixFailures, interaction, blind, focused, results, diagnosticsCount };
  await writeFile(resolve(proofRoot, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ matrixRuns: result.matrixRuns, matrixFailures: result.matrixFailures.length, diagnosticsCount: result.diagnosticsCount, interaction: result.interaction, blind: result.blind, focused: result.focused }, null, 2));
}

main().catch((error) => {
  if (server.listening) server.close();
  console.error(error.stack || error);
  process.exitCode = 1;
});
