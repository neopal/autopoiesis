import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const proofDir = resolve('research/qa/proofs/brush-v017-2026-09-23');
const baseUrl = 'http://127.0.0.1:4177';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/brush-2026-09-23/';
const rawPath = '/studies/p5-brush/v017/?preview=1&interaction=1';
const blindPath = '/studies/p5-brush/v017/?preview=1&static=1&blind=1';

function diagnostics(page) {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push({ url: response.url(), status: response.status() }); });
  return output;
}

function rect(element) {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

async function outerSnapshot(page) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    frame: (() => { const el = document.querySelector('iframe'); return el ? (() => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null; })(),
    heading: (() => { const el = document.querySelector('h1'); return el ? (() => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null; })(),
    mountReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
    title: document.title
  }));
}

async function tableauState(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v017/'));
  if (!frame) return null;
  return frame.evaluate(() => ({
    state: window.__mutineBrushV017?.getState() ?? null,
    signature: window.__mutineBrushV017?.getFrameSignature() ?? null,
    fieldRect: (() => { const box = document.querySelector('#field')?.getBoundingClientRect(); return box ? { width: box.width, height: box.height } : null; })(),
    readout: document.querySelector('[data-memory]')?.textContent ?? null
  }));
}

async function openPage(browser, path, viewport, reduced, kind) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  const outer = await outerSnapshot(page);
  const tableau = await tableauState(page);
  await page.screenshot({ path: join(proofDir, `${kind}-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: false });
  await context.close();
  return { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, outer, tableau, diagnostics: diag };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v017/'));
  if (!frame) throw new Error('raw v017 frame missing');
  const initial = await frame.evaluate(() => window.__mutineBrushV017.getState());
  const initialSignature = await frame.evaluate(() => window.__mutineBrushV017.getFrameSignature());
  const canvas = frame.locator('#field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('raw v017 canvas has no bounding box');
  await page.mouse.click(box.x + box.width * .28, box.y + box.height * .42);
  const pointer = await frame.evaluate(() => ({ state: window.__mutineBrushV017.getState(), signature: window.__mutineBrushV017.getFrameSignature() }));
  if (pointer.state.memory !== 1) throw new Error(`pointer encounter count expected 1, got ${pointer.state.memory}`);
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await frame.evaluate(() => ({ state: window.__mutineBrushV017.getState(), signature: window.__mutineBrushV017.getFrameSignature() }));
  await page.keyboard.press('Delete');
  const lifted = await frame.evaluate(() => ({ state: window.__mutineBrushV017.getState(), signature: window.__mutineBrushV017.getFrameSignature() }));
  const controls = await frame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
  await frame.locator('#release-control').click();
  const released = await frame.evaluate(() => ({ state: window.__mutineBrushV017.getState(), signature: window.__mutineBrushV017.getFrameSignature() }));
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: join(proofDir, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return {
    path: rawPath,
    httpStatus: response?.status() ?? null,
    initial,
    initialSignature,
    pointer,
    keyboard,
    lifted,
    released,
    controls,
    outer,
    diagnostics: diag,
    exactLiftRestored: lifted.signature === pointer.signature,
    releaseCleared: released.state.memory === 0
  };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v017/'));
  if (!frame) throw new Error('blind v017 frame missing');
  const evidence = await frame.evaluate(() => ({
    state: window.__mutineBrushV017.getState(),
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readout: getComputedStyle(document.querySelector('.field-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display,
    header: getComputedStyle(document.querySelector('.studio-header')).display,
    annotations: getComputedStyle(document.querySelector('.annotations')).display
  }));
  await page.screenshot({ path: join(proofDir, 'static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { path: blindPath, httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runJournal(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}/journal/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll('#journal-brush-2026-09-23').length,
    title: document.querySelector('#journal-brush-2026-09-23')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-brush-2026-09-23 a[href="/works/brush-2026-09-23/"]')?.getAttribute('href') ?? null
  }));
  await page.screenshot({ path: join(proofDir, 'journal-390x844.png'), fullPage: false });
  await context.close();
  return { path: '/journal/', httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runCurrent(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}/currents/brush/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    currentHeaders: document.querySelectorAll('[data-catalog-current-header]').length,
    firstArtwork: Boolean(document.querySelector('.catalog-card__art, iframe')),
    title: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null
  }));
  await page.screenshot({ path: join(proofDir, 'current-brush-390x844.png'), fullPage: false });
  await context.close();
  return { path: '/currents/brush/', httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
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
  const journal = await runJournal(browser);
  const current = await runCurrent(browser);
  const result = { baseUrl, canonicalPath, rawPath, blindPath, viewports, matrix, rawMatrix, interaction, blind, journal, current };
  await writeFile(join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const allRuns = [...matrix, ...rawMatrix, interaction, blind, journal, current];
  console.log(JSON.stringify({
    matrixRuns: matrix.length,
    rawMatrixRuns: rawMatrix.length,
    interaction: { initial: interaction.initial, pointer: interaction.pointer.state, keyboard: interaction.keyboard.state, lifted: interaction.lifted.state, exactLiftRestored: interaction.exactLiftRestored, releaseCleared: interaction.releaseCleared },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    diagnostics: allRuns.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0)
  }, null, 2));
} finally {
  await browser.close();
}
