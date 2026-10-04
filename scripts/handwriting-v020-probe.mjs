import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4210;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/handwriting-v020-2026-10-03');
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
  raw: '/studies/handwriting/v020/?preview=1&interaction=1',
  canonical: '/works/typography-2026-10-03/'
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
    await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV020));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._p5Ready));
  return page.frames().find((frame) => frame.url().includes('/studies/handwriting/v020/'));
}

async function frameEvidence(page, frame, canonical, viewport, reducedMotion) {
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
    const field = document.querySelector('#pressure-field');
    const canvas = document.querySelector('#pressure-field canvas');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      canvasVisible: Boolean(canvas && canvas.width > 0 && canvas.height > 0),
      memory: Number(field?.dataset.memory ?? -1),
      resistance: Number(field?.dataset.resistance ?? -1),
      interaction: field?.dataset.interaction ?? null,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      touchControls: controls.map((node) => ({ text: node.textContent.trim(), width: Number(node.getBoundingClientRect().width.toFixed(2)), height: Number(node.getBoundingClientRect().height.toFixed(2)) }))
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
        const evidence = await frameEvidence(page, frame, routeName === 'canonical', viewport, reducedMotion);
        const filename = `handwriting-v020-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
        results.push({ routeName, route, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function getState(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#pressure-field');
    return { memory: Number(field.dataset.memory), resistance: Number(field.dataset.resistance), interaction: field.dataset.interaction, signature: window.__mutineHandwritingV020.getSignature() };
  });
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page, false);
  const initial = await getState(frame);
  const canvas = page.locator('#pressure-field canvas');
  await canvas.click({ position: { x: 140, y: 230 } });
  const tap = await getState(frame);
  await frame.locator('#pressure-field').focus();
  await frame.locator('#pressure-field').press('Enter');
  const keyboard = await getState(frame);
  await frame.locator('#pressure-field').press('Delete');
  const lifted = await getState(frame);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.42);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.48, box.y + box.height * 0.5, { steps: 3 });
  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.61, { steps: 3 });
  await page.mouse.up();
  const drag = await getState(frame);
  await frame.locator('#pressure-field').press('Delete');
  const dragLifted = await getState(frame);
  await frame.locator('#release-strokes').click();
  const released = await getState(frame);
  await frame.locator('#press-type-control').click();
  const button = await getState(frame);
  const buttons = await frame.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v020-interaction.png'), fullPage: true });
  await page.close();
  return { initial, tap, keyboard, lifted, drag, dragLifted, released, button, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/handwriting/v020/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#pressure-field')).display !== 'none',
    canvasVisible: Boolean(document.querySelector('#pressure-field canvas')),
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v020-blind.png'), fullPage: true });
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
    recordAnchor: Boolean(document.querySelector('#journal-typography-2026-10-03, [data-work-id="typography-2026-10-03"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, `handwriting-v020-${path.includes('journal') ? 'journal' : 'current'}.png`), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsOk(diag) {
  return !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length;
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await mkdir(scratchDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-typography-2026-10-03');
  const current = await runReadback(browser, '/currents/handwriting/', '[data-catalog-current="typography"] [data-work-id="typography-2026-10-03"]');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const { shell, tableau } = result.evidence;
    return shell.innerWidth !== target || shell.scrollWidth > shell.innerWidth || tableau.scrollWidth > tableau.innerWidth || !tableau.canvasVisible || (result.routeName === 'canonical' && !shell.tableauFirst) || tableau.touchControls.some((control) => control.height < 44) || !diagnosticsOk(result.diagnostics);
  });
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, proofDir, scratchDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  const interactionOk = interaction.tap.memory === interaction.initial.memory && interaction.keyboard.memory === interaction.initial.memory + 1 && interaction.lifted.memory === interaction.initial.memory && interaction.drag.memory === 1 && interaction.dragLifted.memory === 0 && interaction.released.memory === 0 && interaction.button.memory === 1 && interaction.buttons.every((button) => button.height >= 44);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.canvasVisible && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth;
  const readbacksOk = journal.evidence.recordAnchor && current.evidence.recordAnchor;
  if (failures.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

main().catch(async (error) => {
  server.close();
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
