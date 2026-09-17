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
const canonicalPath = '/works/webgpu-2026-09-17/';
const rawPath = '/studies/webgpu/v012/?preview=1&interaction=1&blind=1';
const blindPath = '/studies/webgpu/v012/?preview=1&interaction=1&blind=1&static=1';

const waitForFrame = async (page) => {
  const iframe = page.locator('iframe').first();
  if (await iframe.count() === 0) {
    await page.locator('#field').waitFor({ state: 'visible' });
    return { iframe: null, frame: page };
  }
  await iframe.waitFor({ state: 'visible' });
  const frame = iframe.contentFrame();
  await frame.locator('#field').waitFor({ state: 'visible' });
  return { iframe, frame };
};

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

const viewportEvidence = async (browser, viewport, reduced) => {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference'
  });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${canonicalPath}`, { waitUntil: 'networkidle' });
  const { iframe, frame } = await waitForFrame(page);
  await page.waitForTimeout(reduced ? 80 : 35);
  const evidence = await page.evaluate(() => {
    const doc = document.documentElement;
    const iframeElement = document.querySelector('iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const stage = document.querySelector('.work-inspect__stage');
    const rect = (element) => {
      const value = element?.getBoundingClientRect();
      return value ? { top: value.top, left: value.left, width: value.width, height: value.height, bottom: value.bottom } : null;
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      iframeRect: rect(iframeElement),
      headingRect: rect(heading),
      stageRect: rect(stage),
      tableauBeforeHeading: Boolean(iframeElement && heading && iframeElement.getBoundingClientRect().top < heading.getBoundingClientRect().top),
      title: heading?.textContent?.trim() ?? null
    };
  });
  const state = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const canvasRect = await frame.locator('#field').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
  });
  await page.screenshot({ path: join(PROOF_DIR, `canonical-${viewport.name}-${reduced ? 'reduced' : 'normal'}.png`), fullPage: false });
  await context.close();
  return { viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, evidence, state, canvasRect, diagnostics };
};

const rawInteractionEvidence = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${rawPath}`, { waitUntil: 'networkidle' });
  const { frame } = await waitForFrame(page);
  const canvas = frame.locator('#field');
  const state0 = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const before = await canvas.evaluate((element) => element.toDataURL('image/png'));
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('raw canvas has no bounding box');
  await canvas.click({ position: { x: Math.round(bounds.width * 0.52), y: Math.round(bounds.height * 0.38) } });
  const state1 = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const pointerImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.press('Enter');
  const state2 = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const keyboardImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.press('Delete');
  const state3 = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const liftedImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await frame.locator('[data-gesture="release"]').click();
  const state4 = await frame.locator('body').evaluate(() => globalThis.__MUTINE_STATE ?? null);
  const controls = await frame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height })));
  const outer = await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  await page.screenshot({ path: join(PROOF_DIR, 'raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return {
    httpStatus: response?.status() ?? null,
    state0, state1, state2, state3, state4,
    changedOnPointer: before !== pointerImage,
    changedOnKeyboard: pointerImage !== keyboardImage,
    liftRestoredPointer: liftedImage === pointerImage,
    controls,
    outer,
    diagnostics
  };
};

const blindEvidence = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${blindPath}`, { waitUntil: 'networkidle' });
  const { frame } = await waitForFrame(page);
  const evidence = await frame.locator('body').evaluate(() => {
    const styleOf = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const canvas = document.querySelector('#field');
    const rect = canvas.getBoundingClientRect();
    return {
      canvasVisible: rect.width > 0 && rect.height > 0,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      readoutDisplay: styleOf('.field-readout'),
      captionDisplay: styleOf('figcaption'),
      controlsDisplay: styleOf('.field-controls'),
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      state: globalThis.__MUTINE_STATE ?? null
    };
  });
  await page.screenshot({ path: join(PROOF_DIR, 'static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, evidence, diagnostics };
};

const routeEvidence = async (browser, path, selector, screenshotName) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.locator(selector).waitFor({ state: 'visible' });
  const evidence = await page.evaluate((target) => ({
    targetCount: document.querySelectorAll(target).length,
    entryTitle: document.querySelector(`${target} h3`)?.textContent?.trim() ?? null,
    entryHref: document.querySelector(`${target} h3 a`)?.getAttribute('href') ?? null,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector(target)?.textContent?.trim() ?? null
  }), selector);
  await page.screenshot({ path: join(PROOF_DIR, screenshotName), fullPage: false });
  await context.close();
  return { path, httpStatus: response?.status() ?? null, evidence, diagnostics };
};

await mkdir(PROOF_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = [];
  for (const viewport of viewports) {
    matrix.push(await viewportEvidence(browser, viewport, false));
    matrix.push(await viewportEvidence(browser, viewport, true));
  }
  const raw = await rawInteractionEvidence(browser);
  const blind = await blindEvidence(browser);
  const journal = await routeEvidence(browser, '/journal/', '#journal-webgpu-2026-09-17', 'journal-390x844.png');
  const current = await routeEvidence(browser, '/currents/webgpu/', '[data-catalog-current-header="webgpu"]', 'current-webgpu-390x844.png');
  const results = { generatedAt: new Date().toISOString(), matrix, raw, blind, journal, current };
  await writeFile(join(PROOF_DIR, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    matrixRuns: matrix.length,
    matrixIssues: matrix.flatMap((run) => [...run.diagnostics.console, ...run.diagnostics.pageErrors, ...run.diagnostics.requestFailures, ...run.diagnostics.httpErrors]),
    raw: { httpStatus: raw.httpStatus, state0: raw.state0, state1: raw.state1, state2: raw.state2, state3: raw.state3, state4: raw.state4, changedOnPointer: raw.changedOnPointer, changedOnKeyboard: raw.changedOnKeyboard, liftRestoredPointer: raw.liftRestoredPointer, controls: raw.controls, outer: raw.outer, issues: [...raw.diagnostics.console, ...raw.diagnostics.pageErrors, ...raw.diagnostics.requestFailures, ...raw.diagnostics.httpErrors] },
    blind: { httpStatus: blind.httpStatus, evidence: blind.evidence, issues: [...blind.diagnostics.console, ...blind.diagnostics.pageErrors, ...blind.diagnostics.requestFailures, ...blind.diagnostics.httpErrors] },
    journal: { httpStatus: journal.httpStatus, evidence: journal.evidence, issues: [...journal.diagnostics.console, ...journal.diagnostics.pageErrors, ...journal.diagnostics.requestFailures, ...journal.diagnostics.httpErrors] },
    current: { httpStatus: current.httpStatus, evidence: current.evidence, issues: [...current.diagnostics.console, ...current.diagnostics.pageErrors, ...current.diagnostics.requestFailures, ...current.diagnostics.httpErrors] },
    resultsPath: join(PROOF_DIR, 'results.json')
  }, null, 2));
} finally {
  await browser.close();
}
