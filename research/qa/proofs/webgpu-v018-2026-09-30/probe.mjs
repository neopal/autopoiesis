import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = resolve('.');
const proofDir = resolve('research/qa/proofs/webgpu-v018-2026-09-30');
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/webgpu-2026-09-30/';
const rawPath = '/studies/webgpu/v018/?preview=1&interaction=1';
const blindPath = '/studies/webgpu/v018/?preview=1&static=1&blind=1';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
let baseUrl;

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname);
    const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const candidate = resolve(root, `.${relative}`);
    if (!(candidate === root || candidate.startsWith(`${root}${sep}`))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(candidate);
    response.writeHead(200, { 'Content-Type': mime[extname(candidate)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const diagnostics = (page) => {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push(`${response.status()} ${response.url()}`); });
  return output;
};

const outerSnapshot = (page) => page.evaluate(() => {
  const box = (selector) => { const element = document.querySelector(selector); const rect = element?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; };
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframe: box('iframe'), heading: box('h1') };
});

const stateSnapshot = (frame) => frame.locator('body').evaluate(() => {
  const canvas = document.querySelector('#field');
  const gpu = document.querySelector('#gpu-field');
  const rect = canvas?.getBoundingClientRect();
  const runtime = window.__MUTINE_STATE__;
  return {
    stage: document.querySelector('[data-stage]')?.textContent ?? null,
    memory: document.querySelector('[data-memory]')?.textContent ?? null,
    renderer: document.querySelector('[data-renderer]')?.textContent ?? null,
    canvas: rect ? { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 } : null,
    gpuCanvas: gpu ? { width: gpu.getBoundingClientRect().width, height: gpu.getBoundingClientRect().height } : null,
    runtime: runtime ? { stage: runtime.frame.stage, memory: runtime.frame.memory.length, armedNode: runtime.frame.armedNode, signature: runtime.signature, vacancies: runtime.frame.field.vacancies.length, apertures: runtime.frame.field.apertures.length, gpuReady: window.__MUTINE_GPU_READY__ === true } : null
  };
});

const waitForFrame = async (page) => {
  const iframe = page.locator('iframe').first();
  if (await iframe.count()) {
    await iframe.waitFor({ state: 'visible' });
    const frame = await iframe.contentFrame();
    await frame.locator('#field').waitFor({ state: 'visible' });
    await frame.locator('body').evaluate(() => window.__MUTINE_READY__ === true);
    return frame;
  }
  await page.locator('#field').waitFor({ state: 'visible' });
  await page.locator('body').evaluate(() => window.__MUTINE_READY__ === true);
  return page;
};

const issues = (run) => [...run.diagnostics.consoleMessages, ...run.diagnostics.pageErrors, ...run.diagnostics.failedRequests, ...run.diagnostics.badResponses];

async function runMatrix(browser, path, kind, viewport, reduced) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  const frame = await waitForFrame(page);
  const snapshot = await stateSnapshot(frame);
  const outer = await outerSnapshot(page);
  const tableau = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return { iframeCount: mount?.querySelectorAll('iframe').length ?? 0, tableauFirst: Boolean(iframe && heading && iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING), iframeVisible: Boolean(iframe?.getBoundingClientRect().width && iframe?.getBoundingClientRect().height) };
  });
  const screenshot = resolve(proofDir, `${kind}-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, snapshot, outer, tableau, diagnostics: diag, screenshot };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  const frame = await waitForFrame(page);
  const canvas = frame.locator('#field');
  const initial = await stateSnapshot(frame);
  const node = await frame.locator('body').evaluate(() => window.__MUTINE_STATE__.frame.field.nodes[2]);
  const box = await canvas.boundingBox();
  if (!box) throw new Error('raw canvas has no bounding box');
  const point = { x: box.x + node.x * box.width, y: box.y + node.y * box.height };
  await page.mouse.move(point.x, point.y);
  const armedOnly = await stateSnapshot(frame);
  await page.mouse.down();
  await page.mouse.up();
  const shortClick = await stateSnapshot(frame);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  const sustained = await stateSnapshot(frame);
  await canvas.focus();
  await canvas.press('Enter');
  const keyboard = await stateSnapshot(frame);
  await canvas.press('Delete');
  const lifted = await stateSnapshot(frame);
  await frame.locator('[data-gesture="release"]').click();
  const released = await stateSnapshot(frame);
  const controls = await frame.locator('.witness-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  const outer = await outerSnapshot(page);
  const screenshot = resolve(proofDir, 'raw-interaction-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return {
    httpStatus: response?.status() ?? null,
    initial,
    armedOnly,
    shortClick,
    sustained,
    keyboard,
    lifted,
    released,
    controls,
    outer,
    armedWithoutMemory: armedOnly.runtime?.armedNode === 2 && armedOnly.runtime?.memory === 0,
    shortClickUnchanged: shortClick.runtime?.signature === initial.runtime?.signature,
    sustainedChanged: sustained.runtime?.signature !== initial.runtime?.signature && sustained.runtime?.memory === 1,
    keyboardChanged: keyboard.runtime?.signature !== sustained.runtime?.signature && keyboard.runtime?.memory === 2,
    liftRestoredSustained: lifted.runtime?.signature === sustained.runtime?.signature && lifted.runtime?.memory === 1,
    releaseCleared: released.runtime?.memory === 0,
    diagnostics: diag,
    screenshot
  };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'networkidle' });
  const frame = await waitForFrame(page);
  const evidence = await frame.locator('body').evaluate(() => {
    const styles = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const canvas = document.querySelector('#field').getBoundingClientRect();
    return { canvasVisible: canvas.width > 0 && canvas.height > 0, canvasWidth: canvas.width, canvasHeight: canvas.height, readout: styles('.witness-readout'), controls: styles('.witness-controls'), caption: styles('figcaption'), header: styles('.studio-header'), annotations: styles('.witness-notes'), innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, state: window.__MUTINE_STATE__ ? { stage: window.__MUTINE_STATE__.frame.stage, memory: window.__MUTINE_STATE__.frame.memory.length, vacancies: window.__MUTINE_STATE__.frame.field.vacancies.length, apertures: window.__MUTINE_STATE__.frame.field.apertures.length } : null };
  });
  const screenshot = resolve(proofDir, 'static-blind-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, evidence, diagnostics: diag, screenshot };
}

async function runRoute(browser, path, selector, file) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.locator(selector).waitFor({ state: 'visible' });
  const evidence = await page.evaluate((target) => ({ count: document.querySelectorAll(target).length, text: document.querySelector(target)?.textContent?.trim() ?? null, innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }), selector);
  const screenshot = resolve(proofDir, file);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { path, httpStatus: response?.status() ?? null, evidence, diagnostics: diag, screenshot };
}

await mkdir(proofDir, { recursive: true });
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = [];
  const rawMatrix = [];
  for (const viewport of viewports) {
    matrix.push(await runMatrix(browser, canonicalPath, 'canonical', viewport, false));
    matrix.push(await runMatrix(browser, canonicalPath, 'canonical', viewport, true));
    rawMatrix.push(await runMatrix(browser, rawPath, 'raw', viewport, false));
    rawMatrix.push(await runMatrix(browser, rawPath, 'raw', viewport, true));
  }
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runRoute(browser, '/journal/', '#journal-webgpu-2026-09-30', 'journal-390x844.png');
  const current = await runRoute(browser, '/currents/webgpu/', '[data-catalog-current-header="webgpu"]', 'current-webgpu-390x844.png');
  const results = { baseUrl, canonicalPath, rawPath, blindPath, matrix, rawMatrix, interaction, blind, journal, current };
  await writeFile(resolve(proofDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  const allRuns = [...matrix, ...rawMatrix];
  const overflow = allRuns.filter((run) => run.outer.scrollWidth > run.outer.innerWidth).length;
  const allIssues = [...allRuns, interaction, blind, journal, current].flatMap(issues);
  const summary = {
    canonicalRuns: matrix.length,
    rawRuns: rawMatrix.length,
    viewportOverflow: overflow,
    issueCount: allIssues.length,
    tableauFirstCount: matrix.filter((run) => run.tableau.tableauFirst).length,
    interaction: { initial: interaction.initial.runtime, armedOnly: interaction.armedOnly.runtime, shortClick: interaction.shortClick.runtime, sustained: interaction.sustained.runtime, keyboard: interaction.keyboard.runtime, lifted: interaction.lifted.runtime, released: interaction.released.runtime, armedWithoutMemory: interaction.armedWithoutMemory, shortClickUnchanged: interaction.shortClickUnchanged, sustainedChanged: interaction.sustainedChanged, keyboardChanged: interaction.keyboardChanged, liftRestoredSustained: interaction.liftRestoredSustained, releaseCleared: interaction.releaseCleared, controls: interaction.controls, outer: interaction.outer },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    issues: allIssues
  };
  await writeFile(resolve(proofDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.issueCount || summary.viewportOverflow || summary.tableauFirstCount !== matrix.length || !interaction.armedWithoutMemory || !interaction.shortClickUnchanged || !interaction.sustainedChanged || !interaction.keyboardChanged || !interaction.liftRestoredSustained || !interaction.releaseCleared) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
