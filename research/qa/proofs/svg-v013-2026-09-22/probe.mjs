import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.cwd());
const proofDir = resolve('research/qa/proofs/svg-v013-2026-09-22');
const baseUrl = 'http://127.0.0.1:4175';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const rawPath = '/studies/pure-svg/v013/?preview=1&interaction=1';
const blindPath = '/studies/pure-svg/v013/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-09-22/';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const relative = pathname.replace(/^\/+/, '');
  const candidate = resolve(root, normalize(relative));
  if (candidate !== root && !candidate.startsWith(`${root}${join('/')}`) && !candidate.startsWith(`${root}\\`)) return null;
  return candidate;
}

async function resolveFile(urlPath) {
  const candidate = safePath(urlPath);
  if (!candidate) return null;
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const direct = pathname.endsWith('/') ? join(candidate, 'index.html') : candidate;
  try {
    await readFile(direct);
    return direct;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const file = await resolveFile(request.url ?? '/');
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }
  const body = await readFile(file);
  response.writeHead(200, { 'content-type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(body);
});

function diagnostics(page) {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push({ url: response.url(), status: response.status() }); });
  return output;
}

async function outerSnapshot(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#field');
    const firstFrame = document.querySelector('iframe');
    const firstHeading = document.querySelector('h1');
    const rect = (element) => element ? (() => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: rect(field),
      firstFrame: rect(firstFrame),
      firstHeading: rect(firstHeading),
      title: document.title
    };
  });
}

async function tableauState(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v013/'));
  if (!frame) return null;
  return frame.evaluate(() => ({
    state: window.__mutinePureSvgV013?.getState() ?? null,
    fieldRect: (() => { const box = document.querySelector('#field')?.getBoundingClientRect(); return box ? { width: box.width, height: box.height } : null; })(),
    readout: document.querySelector('[data-memory]')?.textContent ?? null
  }));
}

async function openPage(browser, path, viewport, reduced, kind) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await context.addInitScript((value) => { window.__probeReducedMotion = value; }, reduced);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const outer = await outerSnapshot(page);
  const tableau = await tableauState(page);
  await page.screenshot({ path: join(proofDir, `${kind}-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: false });
  await context.close();
  return { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, outer, tableau, diagnostics: diag };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {});
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const initial = await page.evaluate(() => window.__mutinePureSvgV013.getState());
  const initialSignature = await page.evaluate(() => window.__mutinePureSvgV013.getFrameSignature());
  const svg = page.locator('#field');
  const box = await svg.boundingBox();
  if (!box) throw new Error('raw SVG field has no bounding box');
  await page.mouse.click(box.x + box.width * 0.74, box.y + box.height * 0.28);
  const pointer = await page.evaluate(() => ({ state: window.__mutinePureSvgV013.getState(), signature: window.__mutinePureSvgV013.getFrameSignature() }));
  await svg.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ state: window.__mutinePureSvgV013.getState(), signature: window.__mutinePureSvgV013.getFrameSignature() }));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ state: window.__mutinePureSvgV013.getState(), signature: window.__mutinePureSvgV013.getFrameSignature() }));
  const controls = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
  await page.locator('#release-control').click();
  const released = await page.evaluate(() => ({ state: window.__mutinePureSvgV013.getState(), signature: window.__mutinePureSvgV013.getFrameSignature() }));
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: join(proofDir, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return { path: rawPath, httpStatus: response?.status() ?? null, initial, initialSignature, pointer, keyboard, lifted, released, controls, outer, diagnostics: diag, exactLiftRestored: lifted.signature === pointer.signature, releaseCleared: released.state.memory === 0 };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const evidence = await page.evaluate(() => ({
    state: window.__mutinePureSvgV013.getState(),
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    svgVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readout: getComputedStyle(document.querySelector('.field-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display,
    witnesses: (() => { const element = document.querySelector('.node-witness'); return element ? getComputedStyle(element).display : 'absent'; })(),
    labels: getComputedStyle(document.querySelector('.artwork-label')).display,
    count: getComputedStyle(document.querySelector('.count-label')).display
  }));
  await page.screenshot({ path: join(proofDir, 'static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { path: blindPath, httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runRoute(browser, path, selector, screenshotName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate((target) => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll(target).length,
    title: document.querySelector(target)?.textContent?.trim() ?? null,
    firstArtwork: (() => { const element = document.querySelector('iframe, .catalog-card__art'); const box = element?.getBoundingClientRect(); return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null; })()
  }), selector);
  await page.screenshot({ path: join(proofDir, screenshotName), fullPage: false });
  await context.close();
  return { path, httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

await mkdir(proofDir, { recursive: true });
await new Promise((resolveServer) => server.listen(4175, '127.0.0.1', resolveServer));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = [];
  for (const viewport of viewports) {
    matrix.push(await openPage(browser, canonicalPath, viewport, false, 'canonical'));
    matrix.push(await openPage(browser, canonicalPath, viewport, true, 'canonical'));
  }
  const rawMatrix = [];
  for (const viewport of viewports) {
    rawMatrix.push(await openPage(browser, rawPath, viewport, false, 'raw'));
    rawMatrix.push(await openPage(browser, rawPath, viewport, true, 'raw'));
  }
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runRoute(browser, '/journal/', '#journal-svg-2026-09-22', 'journal-390x844.png');
  const current = await runRoute(browser, '/currents/pure-svg/', '[data-catalog-current-header] h1', 'current-pure-svg-390x844.png');
  const result = { baseUrl, canonicalPath, rawPath, blindPath, viewports, matrix, rawMatrix, interaction, blind, journal, current };
  await (await import('node:fs/promises')).writeFile(join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({
    matrixRuns: matrix.length,
    rawMatrixRuns: rawMatrix.length,
    interaction: { initial: interaction.initial, pointer: interaction.pointer.state, keyboard: interaction.keyboard.state, lifted: interaction.lifted.state, exactLiftRestored: interaction.exactLiftRestored, releaseCleared: interaction.releaseCleared },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    diagnostics: [...matrix, ...rawMatrix, interaction, blind, journal, current].reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0)
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}
