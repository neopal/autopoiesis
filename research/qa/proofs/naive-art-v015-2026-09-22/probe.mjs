import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const proofDir = resolve('research/qa/proofs/naive-art-v015-2026-09-22');
const baseUrl = 'http://127.0.0.1:4175';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const rawPath = '/studies/naive-art/v015/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v015/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-09-22/';

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
    const rect = (element) => element ? (() => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstFrame: rect(document.querySelector('iframe')),
      firstHeading: rect(document.querySelector('h1')),
      canvas: rect(document.querySelector('#field')),
      title: document.title
    };
  });
}

async function tableauState(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v015/'));
  if (!frame) return null;
  return frame.evaluate(() => ({
    state: window.__mutineNaiveV015?.getState() ?? null,
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
  await page.waitForTimeout(140);
  const initial = await page.evaluate(() => window.__mutineNaiveV015.getState());
  const initialSignature = initial.misreadSignature;
  const canvas = page.locator('#field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('raw Canvas field has no bounding box');
  await page.mouse.click(box.x + box.width * 0.24, box.y + box.height * 0.24);
  const pointer = await page.evaluate(() => ({ state: window.__mutineNaiveV015.getState() }));
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ state: window.__mutineNaiveV015.getState() }));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ state: window.__mutineNaiveV015.getState() }));
  const controls = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
  await page.locator('#release-control').click();
  const released = await page.evaluate(() => ({ state: window.__mutineNaiveV015.getState() }));
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: join(proofDir, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return { path: rawPath, httpStatus: response?.status() ?? null, initial, initialSignature, pointer, keyboard, lifted, released, controls, outer, diagnostics: diag, exactLiftRestored: lifted.state.misreadSignature === pointer.state.misreadSignature, releaseCleared: released.state.memory === 0 };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${baseUrl}${blindPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  const evidence = await page.evaluate(() => ({
    state: window.__mutineNaiveV015.getState(),
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readout: getComputedStyle(document.querySelector('.field-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display
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
  await page.waitForTimeout(300);
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
  const journal = await runRoute(browser, '/journal/', '#journal-naive-2026-09-22', 'journal-390x844.png');
  const current = await runRoute(browser, '/currents/naive-art/', '[data-catalog-current-header] h1', 'current-naive-390x844.png');
  const result = { baseUrl, canonicalPath, rawPath, blindPath, viewports, matrix, rawMatrix, interaction, blind, journal, current };
  await writeFile(join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
  const runs = [...matrix, ...rawMatrix, interaction, blind, journal, current];
  const issueCount = runs.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
  const overflowCount = [...matrix, ...rawMatrix].filter((run) => run.outer.scrollWidth > run.outer.innerWidth).length;
  const tableauFirstCount = matrix.filter((run) => run.outer.firstFrame && run.outer.firstHeading && run.outer.firstFrame.y < run.outer.firstHeading.y).length;
  const summary = {
    matrixRuns: matrix.length,
    rawMatrixRuns: rawMatrix.length,
    tableauFirstCount,
    overflowCount,
    interaction: { initial: interaction.initial, pointer: interaction.pointer.state, keyboard: interaction.keyboard.state, lifted: interaction.lifted.state, exactLiftRestored: interaction.exactLiftRestored, releaseCleared: interaction.releaseCleared },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    issueCount
  };
  if (issueCount || overflowCount || tableauFirstCount !== matrix.length || !interaction.exactLiftRestored || !interaction.releaseCleared) process.exitCode = 1;
} finally {
  await browser.close();
}
