import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const proofDir = resolve('research/qa/proofs/svg-v014-2026-09-23/production');
const baseUrl = 'https://autopoiesis-nine.vercel.app';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const rawPath = '/studies/pure-svg/v014/?preview=1&interaction=1';
const blindPath = '/studies/pure-svg/v014/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-09-23/';

function diagnostics(page) {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push({ url: response.url(), status: response.status() }); });
  return output;
}

function rectSnapshot(element) {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

async function outerSnapshot(page) {
  return page.evaluate(() => {
    const rect = (element) => element ? (() => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; })() : null;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      frame: rect(document.querySelector('iframe')),
      heading: rect(document.querySelector('h1')),
      mountReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
      title: document.title
    };
  });
}

async function tableauState(page) {
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v014/'));
  if (!frame) return null;
  return frame.evaluate(() => ({
    state: window.__mutinePureSvgV014?.getState() ?? null,
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
  await page.waitForTimeout(120);
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
  const initial = await page.evaluate(() => window.__mutinePureSvgV014.getState());
  const initialSignature = await page.evaluate(() => window.__mutinePureSvgV014.getFrameSignature());
  const svg = page.locator('#field');
  const box = await svg.boundingBox();
  if (!box) throw new Error('raw SVG field has no bounding box');
  await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.22);
  const pointer = await page.evaluate(() => ({ state: window.__mutinePureSvgV014.getState(), signature: window.__mutinePureSvgV014.getFrameSignature() }));
  await svg.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ state: window.__mutinePureSvgV014.getState(), signature: window.__mutinePureSvgV014.getFrameSignature() }));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ state: window.__mutinePureSvgV014.getState(), signature: window.__mutinePureSvgV014.getFrameSignature() }));
  const controls = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
  await page.locator('#release-control').click();
  const released = await page.evaluate(() => ({ state: window.__mutinePureSvgV014.getState(), signature: window.__mutinePureSvgV014.getFrameSignature() }));
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
    state: window.__mutinePureSvgV014.getState(),
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    svgVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readout: getComputedStyle(document.querySelector('.field-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display,
    witnesses: (() => { const element = document.querySelector('.constraint-witness'); return element ? getComputedStyle(element).display : 'absent'; })(),
    gapMarks: (() => { const element = document.querySelector('.gap-mark'); return element ? getComputedStyle(element).display : 'absent'; })(),
    labels: getComputedStyle(document.querySelector('.artwork-label')).display,
    count: getComputedStyle(document.querySelector('.count-label')).display
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
    count: document.querySelectorAll('#journal-svg-2026-09-23').length,
    title: document.querySelector('#journal-svg-2026-09-23')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-svg-2026-09-23 a[href="/works/svg-2026-09-23/"]')?.getAttribute('href') ?? null
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
  const response = await page.goto(`${baseUrl}/currents/pure-svg/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    currentHeaders: document.querySelectorAll('[data-catalog-current-header]').length,
    firstArtwork: Boolean(document.querySelector('.catalog-card__art, iframe')),
    title: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null
  }));
  await page.screenshot({ path: join(proofDir, 'current-pure-svg-390x844.png'), fullPage: false });
  await context.close();
  return { path: '/currents/pure-svg/', httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
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
