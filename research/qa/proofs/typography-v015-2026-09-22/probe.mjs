import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.MUTINE_BASE_URL ?? 'http://127.0.0.1:4173';
const PROOF_DIR = process.env.MUTINE_PROOF_DIR
  ? resolve(process.env.MUTINE_PROOF_DIR)
  : fileURLToPath(new URL('./', import.meta.url));
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/typography-2026-09-22/';
const rawPath = '/studies/handwriting/v015/?preview=1&interaction=1';
const blindPath = '/studies/handwriting/v015/?preview=1&static=1&blind=1';

const collectDiagnostics = (page) => {
  const diagnostics = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
};

const outerSnapshot = (page) => page.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));

const frameSnapshot = async (frame) => frame.locator('body').evaluate(() => ({
  state: globalThis.__mutineHandwritingV015?.getState?.() ?? null,
  canvas: (() => {
    const element = document.querySelector('#piece');
    const rect = element?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 } : null;
  })(),
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));

const resolveFrame = async (page) => {
  const iframe = page.locator('iframe').first();
  if (await iframe.count() === 0) {
    await page.locator('#piece').waitFor({ state: 'visible' });
    return { iframe: null, frame: page };
  }
  await iframe.waitFor({ state: 'visible' });
  const frame = iframe.contentFrame();
  await frame.locator('#piece').waitFor({ state: 'visible' });
  return { iframe, frame };
};

async function runTableau(browser, path, viewport, reduced, kind) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference'
  });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const { frame } = await resolveFrame(page);
  await page.waitForTimeout(reduced ? 80 : 60);
  const frameData = await frameSnapshot(frame);
  const outer = await outerSnapshot(page);
  const tableau = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    const nodes = mount ? [...mount.querySelectorAll('*')] : [];
    return {
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      tableauFirst: !mount || !heading ? true : nodes.indexOf(iframe) < nodes.indexOf(heading),
      iframeVisible: Boolean(iframe?.getBoundingClientRect().width && iframe?.getBoundingClientRect().height),
      headingVisible: Boolean(heading?.getBoundingClientRect().width && heading?.getBoundingClientRect().height)
    };
  });
  const visibleFurniture = await frame.locator('body').evaluate(() => ({
    caption: getComputedStyle(document.querySelector('figcaption')).display,
    corner: getComputedStyle(document.querySelector('.canvas-corner')).display,
    controls: getComputedStyle(document.querySelector('.interaction-panel')).display
  }));
  await page.screenshot({ path: join(PROOF_DIR, `${kind}-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: false });
  const result = { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, outer, tableau, frame: frameData, visibleFurniture, diagnostics };
  await context.close();
  return result;
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${rawPath}`, { waitUntil: 'networkidle' });
  const { frame } = await resolveFrame(page);
  const canvas = frame.locator('#piece');
  const state0 = await frameSnapshot(frame);
  const before = await canvas.evaluate((element) => element.toDataURL('image/png'));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('raw canvas has no bounding box');
  await canvas.click({ position: { x: Math.round(bounds.width * 0.52), y: Math.round(bounds.height * 0.38) } });
  const state1 = await frameSnapshot(frame);
  const pointerImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.press('Enter');
  const state2 = await frameSnapshot(frame);
  const keyboardImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.press('Delete');
  const state3 = await frameSnapshot(frame);
  const liftedImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await frame.locator('[data-gesture="release"]').click();
  const state4 = await frameSnapshot(frame);
  const controls = await frame.locator('.interaction-actions button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height })));
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: join(PROOF_DIR, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, state0, state1, state2, state3, state4, changedOnPointer: before !== pointerImage, changedOnKeyboard: pointerImage !== keyboardImage, liftRestoredPointer: liftedImage === pointerImage, controls, outer, diagnostics };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${blindPath}`, { waitUntil: 'networkidle' });
  const { frame } = await resolveFrame(page);
  const evidence = await frame.locator('body').evaluate(() => {
    const canvas = document.querySelector('#piece');
    const rect = canvas.getBoundingClientRect();
    return {
      canvasVisible: rect.width > 0 && rect.height > 0,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      captionDisplay: getComputedStyle(document.querySelector('figcaption')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.interaction-panel')).display,
      cornerDisplay: getComputedStyle(document.querySelector('.canvas-corner')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      state: globalThis.__mutineHandwritingV015?.getState?.() ?? null
    };
  });
  await page.screenshot({ path: join(PROOF_DIR, 'static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, evidence, diagnostics };
}

async function runRoute(browser, path, selector, screenshotName) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.locator(selector).waitFor({ state: 'visible' });
  const evidence = await page.evaluate((target) => ({
    targetCount: document.querySelectorAll(target).length,
    entryTitle: document.querySelector(`${target} h3`)?.textContent?.trim() ?? null,
    entryHref: document.querySelector(`${target} h3 a`)?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector(target)?.textContent?.trim() ?? null
  }), selector);
  await page.screenshot({ path: join(PROOF_DIR, screenshotName), fullPage: false });
  await context.close();
  return { path, httpStatus: response?.status() ?? null, evidence, diagnostics };
}

await mkdir(PROOF_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = [];
  for (const viewport of viewports) {
    matrix.push(await runTableau(browser, canonicalPath, viewport, false, 'canonical'));
    matrix.push(await runTableau(browser, canonicalPath, viewport, true, 'canonical'));
  }
  const rawMatrix = [];
  for (const viewport of viewports) {
    rawMatrix.push(await runTableau(browser, rawPath, viewport, false, 'raw'));
    rawMatrix.push(await runTableau(browser, rawPath, viewport, true, 'raw'));
  }
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runRoute(browser, '/journal/', '#journal-typography-2026-09-22', 'journal-390x844.png');
  const current = await runRoute(browser, '/currents/handwriting/', '[data-catalog-current-header="typography"]', 'current-handwriting-390x844.png');
  const results = { generatedAt: new Date().toISOString(), matrix, rawMatrix, interaction, blind, journal, current };
  await writeFile(join(PROOF_DIR, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  const issues = (runs) => runs.flatMap((run) => [...run.diagnostics.console, ...run.diagnostics.pageErrors, ...run.diagnostics.requestFailures, ...run.diagnostics.httpErrors]);
  process.stdout.write(JSON.stringify({
    canonicalRuns: matrix.length,
    rawRuns: rawMatrix.length,
    canonicalIssues: issues(matrix),
    rawIssues: issues(rawMatrix),
    interaction: { httpStatus: interaction.httpStatus, state0: interaction.state0, state1: interaction.state1, state2: interaction.state2, state3: interaction.state3, state4: interaction.state4, changedOnPointer: interaction.changedOnPointer, changedOnKeyboard: interaction.changedOnKeyboard, liftRestoredPointer: interaction.liftRestoredPointer, controls: interaction.controls, outer: interaction.outer, issues: [...interaction.diagnostics.console, ...interaction.diagnostics.pageErrors, ...interaction.diagnostics.requestFailures, ...interaction.diagnostics.httpErrors] },
    blind: { httpStatus: blind.httpStatus, evidence: blind.evidence, issues: [...blind.diagnostics.console, ...blind.diagnostics.pageErrors, ...blind.diagnostics.requestFailures, ...blind.diagnostics.httpErrors] },
    journal: { httpStatus: journal.httpStatus, evidence: journal.evidence, issues: [...journal.diagnostics.console, ...journal.diagnostics.pageErrors, ...journal.diagnostics.requestFailures, ...journal.diagnostics.httpErrors] },
    current: { httpStatus: current.httpStatus, evidence: current.evidence, issues: [...current.diagnostics.console, ...current.diagnostics.pageErrors, ...current.diagnostics.requestFailures, ...current.diagnostics.httpErrors] },
    resultsPath: join(PROOF_DIR, 'results.json')
  }, null, 2));
} finally {
  await browser.close();
}
