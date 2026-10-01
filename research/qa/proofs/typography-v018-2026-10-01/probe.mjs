import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = resolve('.');
const proofDir = resolve('research/qa/proofs/typography-v018-2026-10-01');
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/typography-2026-10-01/';
const rawPath = '/studies/handwriting/v018/?preview=1&interaction=1';
const blindPath = '/studies/handwriting/v018/?preview=1&static=1&blind=1';
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

const tableauSnapshot = (frame) => frame.locator('body').evaluate(() => {
  const field = document.querySelector('#piece');
  const rect = field?.getBoundingClientRect();
  const runtime = window.__mutineHandwritingV018;
  return {
    field: rect ? { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 } : null,
    runtime: runtime ? { ...runtime.getState(), signature: runtime.getSignature() } : null,
    wordCount: document.querySelectorAll('#ink-layer text').length,
    maskPathCount: document.querySelectorAll('#ink-mask path').length
  };
});

const waitForTableau = async (page) => {
  const iframe = page.locator('iframe').first();
  if (await iframe.count()) {
    await iframe.waitFor({ state: 'visible' });
    const frame = await iframe.contentFrame();
    await frame.locator('#piece').waitFor({ state: 'visible' });
    await frame.locator('body').evaluate(() => Boolean(window.__mutineHandwritingV018));
    return frame;
  }
  await page.locator('#piece').waitFor({ state: 'visible' });
  await page.locator('body').evaluate(() => Boolean(window.__mutineHandwritingV018));
  return page;
};

const issues = (run) => [...run.diagnostics.consoleMessages, ...run.diagnostics.pageErrors, ...run.diagnostics.failedRequests, ...run.diagnostics.badResponses];

async function runMatrix(browser, path, kind, viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page);
  const snapshot = await tableauSnapshot(frame);
  const outer = await outerSnapshot(page);
  const tableau = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return { iframeCount: mount?.querySelectorAll('iframe').length ?? 0, tableauFirst: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)), iframeVisible: Boolean(iframe?.getBoundingClientRect().width && iframe?.getBoundingClientRect().height) };
  });
  const screenshot = resolve(proofDir, `${kind}-${viewport.name}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { kind, viewport: viewport.name, motion: reducedMotion ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, snapshot, outer, tableau, diagnostics: diag, screenshot };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page);
  const field = frame.locator('#piece');
  const initial = await tableauSnapshot(frame);
  const box = await field.boundingBox();
  if (!box) throw new Error('raw SVG has no bounding box');
  const point = { x: box.x + box.width * 0.42, y: box.y + box.height * 0.38 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.up();
  const shortClick = await tableauSnapshot(frame);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(660);
  await page.mouse.up();
  const sustained = await tableauSnapshot(frame);
  await field.focus();
  await field.press('Enter');
  const keyboard = await tableauSnapshot(frame);
  await field.press('Delete');
  const lifted = await tableauSnapshot(frame);
  await frame.locator('[data-gesture="release"]').click();
  const released = await tableauSnapshot(frame);
  const controls = await frame.locator('.interaction-actions button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  const outer = await outerSnapshot(page);
  const screenshot = resolve(proofDir, 'raw-interaction-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return {
    httpStatus: response?.status(),
    initial,
    shortClick,
    sustained,
    keyboard,
    lifted,
    released,
    controls,
    outer,
    shortClickUnchanged: shortClick.runtime?.signature === initial.runtime?.signature,
    sustainedChanged: sustained.runtime?.signature !== initial.runtime?.signature && sustained.runtime?.memory.length === 1,
    keyboardChanged: keyboard.runtime?.signature !== sustained.runtime?.signature && keyboard.runtime?.memory.length === 2,
    liftRestoredSustained: lifted.runtime?.signature === sustained.runtime?.signature && lifted.runtime?.memory.length === 1,
    releaseCleared: released.runtime?.memory.length === 0,
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
  const frame = await waitForTableau(page);
  const evidence = await frame.locator('body').evaluate(() => {
    const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const field = document.querySelector('#piece').getBoundingClientRect();
    return { fieldVisible: field.width > 0 && field.height > 0, fieldWidth: field.width, fieldHeight: field.height, interactionPanel: display('.interaction-panel'), caption: display('figcaption'), header: display('.studio-header'), annotations: display('.annotations'), innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, state: window.__mutineHandwritingV018.getState() };
  });
  const screenshot = resolve(proofDir, 'static-blind-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { httpStatus: response?.status(), evidence, diagnostics: diag, screenshot };
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
  return { path, httpStatus: response?.status(), evidence, diagnostics: diag, screenshot };
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
  const journal = await runRoute(browser, '/journal/', '#journal-typography-2026-10-01', 'journal-390x844.png');
  const current = await runRoute(browser, '/currents/handwriting/', '[data-catalog-current-header="typography"]', 'current-handwriting-390x844.png');
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
    wordCount: rawMatrix[0]?.snapshot.wordCount ?? null,
    interaction: { initial: interaction.initial.runtime, shortClick: interaction.shortClick.runtime, sustained: interaction.sustained.runtime, keyboard: interaction.keyboard.runtime, lifted: interaction.lifted.runtime, released: interaction.released.runtime, shortClickUnchanged: interaction.shortClickUnchanged, sustainedChanged: interaction.sustainedChanged, keyboardChanged: interaction.keyboardChanged, liftRestoredSustained: interaction.liftRestoredSustained, releaseCleared: interaction.releaseCleared, controls: interaction.controls, outer: interaction.outer },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    issues: allIssues
  };
  await writeFile(resolve(proofDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.issueCount || summary.viewportOverflow || summary.tableauFirstCount !== matrix.length || !interaction.shortClickUnchanged || !interaction.sustainedChanged || !interaction.keyboardChanged || !interaction.liftRestoredSustained || !interaction.releaseCleared) process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
