import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:41750';
const proofDir = new URL('./', import.meta.url);
const proofPath = fileURLToPath(proofDir);
await mkdir(proofDir, { recursive: true });

const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

function routePath(kind) {
  return kind === 'raw'
    ? '/studies/p5-brush/v050/?preview=1&interaction=1'
    : '/works/brush-2026-11-07/';
}

async function inspect(page, frame, kind, viewport, reduced, label) {
  const outer = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    heading: document.querySelector('h1, h2, h3')?.textContent?.trim() || null,
    fieldRect: document.querySelector('#relief-field')?.getBoundingClientRect().toJSON() || null,
    tableauRect: document.querySelector('.work-inspect__stage iframe')?.getBoundingClientRect().toJSON() || null,
    headingRect: document.querySelector('h1, h2, h3')?.getBoundingClientRect().toJSON() || null
  }));
  const tableau = await frame.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-gesture]')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: rect.width, height: rect.height };
    });
    return {
      ready: Boolean(window._p5Ready && window.__mutineBrushV050?.ready),
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      memory: window.__mutineBrushV050?.getState?.().memory ?? null,
      interaction: window.__mutineBrushV050?.getState?.().interaction ?? null,
      fieldRect: document.querySelector('#relief-field')?.getBoundingClientRect().toJSON() || null,
      buttons,
      h1Rect: document.querySelector('h1')?.getBoundingClientRect().toJSON() || null
    };
  });
  const screenshot = `matrix-${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: path.join(proofPath, screenshot) });
  return { kind, viewport: `${viewport[0]}x${viewport[1]}`, reduced, outer, tableau, screenshot };
}

async function runCase(browser, kind, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  const firstPartyFailures = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) firstPartyFailures.push(`${response.status()} ${response.url()}`);
  });
  const url = `${base}${routePath(kind)}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  let frame = page;
  if (kind === 'canonical') {
    await page.waitForSelector('[data-catalog-work-detail="brush-2026-11-07"][data-ready="true"]', { timeout: 30000 });
    await page.waitForFunction(() => window.frames.length > 0 && Array.from(window.frames).some((candidate) => candidate.location.href.includes('/studies/p5-brush/v050/')), { timeout: 30000 });
    frame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v050/'));
  }
  await frame.waitForFunction(() => Boolean(window._p5Ready && window.__mutineBrushV050?.ready), { timeout: 30000 });
  const result = await inspect(page, frame, kind, viewport, reduced, `${kind}-${index}`);
  result.diagnostics = diagnostics;
  result.firstPartyFailures = firstPartyFailures;
  await context.close();
  return result;
}

async function runBlind(browser, reduced) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  const firstPartyFailures = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) firstPartyFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${base}/studies/p5-brush/v050/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineBrushV050?.ready), { timeout: 30000 });
  const state = await page.evaluate(() => ({
    memory: window.__mutineBrushV050.getState().memory,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    readout: getComputedStyle(document.querySelector('.relief-readout')).display,
    controls: getComputedStyle(document.querySelector('.relief-controls')).display,
    hint: getComputedStyle(document.querySelector('.relief-hint')).display,
    fieldRect: document.querySelector('#relief-field').getBoundingClientRect().toJSON(),
    canvasRect: document.querySelector('#relief-canvas canvas').getBoundingClientRect().toJSON()
  }));
  const screenshot = `blind-390x844-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: path.join(proofPath, screenshot) });
  await context.close();
  return { reduced, state, screenshot, diagnostics, firstPartyFailures };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  await page.goto(`${base}${routePath('raw')}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineBrushV050?.ready), { timeout: 30000 });
  const frame = page;
  const canvas = page.locator('#relief-canvas canvas');
  const rect = await canvas.boundingBox();
  const point = (x, y) => ({ x: rect.x + rect.width * x, y: rect.y + rect.height * y });
  const quietSignature = await page.evaluate(() => window.__mutineBrushV050.geometrySignature());
  const start = point(0.26, 0.16);
  const middle = point(0.52, 0.5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(middle.x, middle.y, { steps: 8 });
  await page.mouse.move(start.x, start.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(40);
  const pointerState = await page.evaluate(() => ({ ...window.__mutineBrushV050.getState(), signature: window.__mutineBrushV050.geometrySignature() }));

  await page.locator('#relief-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(30);
  const keyboardState = await page.evaluate(() => window.__mutineBrushV050.getState());
  await page.keyboard.press('Delete');
  const liftedState = await page.evaluate(() => window.__mutineBrushV050.getState());
  await page.keyboard.press('Escape');
  const releasedState = await page.evaluate(() => ({ ...window.__mutineBrushV050.getState(), signature: window.__mutineBrushV050.geometrySignature() }));

  const button = page.locator('[data-gesture="erase"]');
  for (let index = 0; index < 4; index += 1) {
    await button.click();
    await page.waitForTimeout(10);
  }
  const fourCutState = await page.evaluate(() => window.__mutineBrushV050.getState());
  const geometryChanged = pointerState.signature !== quietSignature;
  await page.screenshot({ path: path.join(proofPath, 'interaction-four-cuts.png') });
  await context.close();
  return {
    diagnostics,
    pointer: { memory: pointerState.memory, interaction: pointerState.interaction, geometryChanged },
    keyboard: { memory: keyboardState.memory, interaction: keyboardState.interaction },
    lifted: { memory: liftedState.memory, interaction: liftedState.interaction },
    released: { memory: releasedState.memory, interaction: releasedState.interaction, signatureMatchesQuiet: releasedState.signature === quietSignature },
    fourCuts: { memory: fourCutState.memory, interaction: fourCutState.interaction }
  };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
let caseIndex = 0;
for (const kind of ['raw', 'canonical']) {
  for (const reduced of [false, true]) {
    for (const viewport of viewports) {
      results.push(await runCase(browser, kind, viewport, reduced, caseIndex++));
    }
  }
}
const interaction = await runInteraction(browser);
const blind = [await runBlind(browser, false), await runBlind(browser, true)];
await browser.close();

const summary = {
  base,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrixRuns: results.length,
  diagnostics: results.reduce((sum, result) => sum + result.diagnostics.length, 0) + interaction.diagnostics.length,
  firstPartyFailures: results.flatMap((result) => result.firstPartyFailures),
  overflows: results.filter((result) => result.outer.scrollWidth > result.outer.innerWidth || result.tableau.scrollWidth > result.tableau.innerWidth).length,
  targetWidthsValid: results.every((result) => {
    const target = Number(result.viewport.split('x')[0]);
    return result.outer.innerWidth === target && result.outer.clientWidth === target && result.tableau.innerWidth === result.tableau.clientWidth;
  }),
  blind,
  interaction,
  results
};
await writeFile(new URL('matrix.json', proofDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  matrixRuns: summary.matrixRuns,
  diagnostics: summary.diagnostics,
  firstPartyFailures: summary.firstPartyFailures,
  overflows: summary.overflows,
  targetWidthsValid: summary.targetWidthsValid,
  blind: summary.blind.map((entry) => ({ reduced: entry.reduced, memory: entry.state.memory, innerWidth: entry.state.innerWidth, clientWidth: entry.state.clientWidth, scrollWidth: entry.state.scrollWidth, readout: entry.state.readout, controls: entry.state.controls, hint: entry.state.hint, diagnostics: entry.diagnostics.length })),
  interaction: summary.interaction
}, null, 2));
