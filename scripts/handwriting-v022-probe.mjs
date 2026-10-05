import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4230;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/handwriting-v022-2026-10-05');
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
  raw: '/studies/handwriting/v022/?preview=1&interaction=1',
  canonical: '/works/typography-2026-10-05/'
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
    await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV022));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v022/'));
  if (!frame) throw new Error('canonical artwork iframe missing');
  await frame.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV022));
  return frame;
}

async function evidence(page, frame, canonical, viewport, reducedMotion) {
  const shell = await page.evaluate(({ isCanonical }) => {
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
  }, { isCanonical: canonical });
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#countertype-field');
    const svg = document.querySelector('#countertype-svg');
    const canvas = document.querySelector('#countertype-field canvas');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      svgVisible: Boolean(svg && svg.getBoundingClientRect().width > 0 && svg.querySelectorAll('.stone-group').length === 18),
      canvasVisible: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
      state: window.__mutineHandwritingV022.getState(),
      signature: window.__mutineHandwritingV022.getSignature(),
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      touchControls: controls.map((node) => ({ text: node.textContent.trim(), width: Number(node.getBoundingClientRect().width.toFixed(2)), height: Number(node.getBoundingClientRect().height.toFixed(2)) }))
    };
  });
  return { targetViewport: viewport.join('x'), reducedMotion, shell, tableau };
}

async function captureMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
        const frame = await waitForTableau(page, routeName === 'canonical');
        const item = await evidence(page, frame, routeName === 'canonical', viewport, reducedMotion);
        const filename = `handwriting-v022-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
        results.push({ routeName, route, viewport: viewport.join('x'), reducedMotion, evidence: item, diagnostics: diag, screenshot: filename });
        await page.close();
      }
    }
  }
  return results;
}

async function state(frame) {
  return frame.evaluate(() => ({ ...window.__mutineHandwritingV022.getState(), signature: window.__mutineHandwritingV022.getSignature() }));
}

async function interaction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page, false);
  const initial = await state(frame);
  const field = page.locator('#countertype-field');
  await field.click({ position: { x: 160, y: 250 } });
  const tap = await state(frame);
  await frame.locator('#countertype-field').focus();
  await frame.locator('#countertype-field').press('Enter');
  const keyboard = await state(frame);
  await frame.locator('#countertype-field').press('Delete');
  const lifted = await state(frame);
  const box = await field.boundingBox();
  if (!box) throw new Error('countertype field has no bounding box');
  await page.mouse.move(box.x + box.width * 0.11, box.y + box.height * 0.21);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.32, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.61, box.y + box.height * 0.48, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.69, { steps: 4 });
  await page.mouse.up();
  const drag = await state(frame);
  await frame.locator('#countertype-field').press('Delete');
  const dragLifted = await state(frame);
  await frame.locator('#release-pressure').click();
  const released = await state(frame);
  await frame.locator('#press-type-control').click();
  const button = await state(frame);
  const buttons = await frame.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v022-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, tap, keyboard, lifted, drag, dragLifted, released, button, buttons, diagnostics: diag };
}

async function blind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/handwriting/v022/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const result = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#countertype-field')).display !== 'none',
    svgVisible: Boolean(document.querySelector('#countertype-svg')?.querySelectorAll('.stone-group').length === 18),
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v022-blind-390x844.png'), fullPage: true });
  await page.close();
  return { result, diagnostics: diag };
}

async function readbacks(browser) {
  const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiag = diagnostics(journalPage);
  await journalPage.goto(`http://127.0.0.1:${port}/journal/`, { waitUntil: 'networkidle' });
  await journalPage.waitForSelector('[data-catalog="journal"][data-ready="true"]');
  const journal = await journalPage.evaluate(() => ({
    anchorCount: document.querySelectorAll('#journal-typography-2026-10-05').length,
    titleVisible: document.body.innerText.includes('Pressure changes the word.'),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await journalPage.screenshot({ path: resolve(proofDir, 'handwriting-v022-journal-390x844.png'), fullPage: true });
  await journalPage.close();

  const currentPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const currentDiag = diagnostics(currentPage);
  await currentPage.goto(`http://127.0.0.1:${port}/currents/handwriting/`, { waitUntil: 'networkidle' });
  await currentPage.waitForSelector('[data-catalog-current="typography"][data-ready="true"], [data-catalog-current="typography"]');
  const current = await currentPage.evaluate(() => ({
    cardCount: document.querySelectorAll('[data-work-id="typography-2026-10-05"]').length,
    titleVisible: document.body.innerText.includes('Pressure changes the word.'),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await currentPage.screenshot({ path: resolve(proofDir, 'handwriting-v022-current-390x844.png'), fullPage: true });
  await currentPage.close();
  return { journal, journalDiagnostics: journalDiag, current, currentDiagnostics: currentDiag };
}

function countProblems(items) {
  return items.reduce((count, item) => {
    const diagnostics = [item.diagnostics, item.journalDiagnostics, item.currentDiagnostics].filter(Boolean);
    return count + diagnostics.reduce((subtotal, diag) => subtotal + diag.consoleMessages.length + diag.pageErrors.length + diag.failedRequests.length + diag.badResponses.length, 0);
  }, 0);
}

await mkdir(proofDir, { recursive: true });
await new Promise((resolvePromise, reject) => server.listen(port, '127.0.0.1', (error) => error ? reject(error) : resolvePromise()));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = await captureMatrix(browser);
  const interactionResult = await interaction(browser);
  const blindResult = await blind(browser);
  const readbackResult = await readbacks(browser);
  const report = {
    target: 'typography-2026-10-05',
    matrix,
    interaction: interactionResult,
    blind: blindResult,
    readbacks: readbackResult,
    diagnostics: countProblems(matrix) + countProblems([interactionResult, blindResult, readbackResult])
  };
  await writeFile(resolve(proofDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    matrixRuns: matrix.length,
    matrixFailures: matrix.filter((item) => item.evidence.shell.innerWidth !== item.evidence.shell.clientWidth || item.evidence.shell.scrollWidth !== item.evidence.shell.clientWidth || !item.evidence.shell.tableauFirst || !item.evidence.tableau.svgVisible || !item.evidence.tableau.canvasVisible).length,
    interaction: interactionResult,
    blind: blindResult,
    readbacks: readbackResult,
    diagnostics: report.diagnostics,
    proofDir
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolvePromise) => server.close(() => resolvePromise()));
}
