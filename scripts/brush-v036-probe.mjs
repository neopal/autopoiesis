import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:57190';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v036-2026-10-23';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v036/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-10-23/';
const blindPath = '/studies/p5-brush/v036/?preview=1&static=1&blind=1';

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-dev-shm-usage', '--enable-webgl', '--use-angle=swiftshader'] });
const matrix = [];
const diagnostics = [];

async function probe(path, width, height, reduced, label, screenshotName) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  let artworkFrame = page;
  if (label.startsWith('canonical')) {
    const iframe = page.locator('.work-inspect__stage iframe');
    await iframe.waitFor();
    const iframeHandle = await iframe.elementHandle();
    artworkFrame = await iframeHandle.contentFrame();
  }
  await artworkFrame.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
  const measurements = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWorkId: document.body.dataset.workId || null,
    iframeCount: document.querySelectorAll('iframe').length,
    stageRect: (() => { const element = document.querySelector('.work-inspect__stage, #eclipse-field'); if (!element) return null; const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })()
  }));
  const artworkMeasurements = await artworkFrame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: (() => { const rect = document.querySelector('#eclipse-canvas canvas')?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; })(),
    ready: window._p5Ready === true
  }));
  await page.screenshot({ path: `${proofDir}/${screenshotName}`, fullPage: false });
  const result = { label, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, consoleMessages, pageErrors, failedRequests, httpErrors };
  diagnostics.push(...consoleMessages.map((entry) => ({ label, kind: 'console', ...entry })), ...pageErrors.map((error) => ({ label, kind: 'pageerror', error })), ...failedRequests.map((entry) => ({ label, kind: 'requestfailed', ...entry })), ...httpErrors.map((entry) => ({ label, kind: 'http', ...entry })));
  await context.close();
  return result;
}

for (const reduced of [false, true]) {
  for (const [width, height] of viewports) {
    const suffix = `${width}x${height}-${reduced ? 'reduced' : 'normal'}`;
    matrix.push(await probe(rawPath, width, height, reduced, `raw-${suffix}`, `raw-${suffix}.png`));
    matrix.push(await probe(canonicalPath, width, height, reduced, `canonical-${suffix}`, `canonical-${suffix}.png`));
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const interactionPage = await interactionContext.newPage();
const interactionConsole = [];
const interactionErrors = [];
interactionPage.on('console', (message) => interactionConsole.push({ type: message.type(), text: message.text() }));
interactionPage.on('pageerror', (error) => interactionErrors.push(String(error)));
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle' });
await interactionPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const interaction = await interactionPage.evaluate(() => {
  const api = window.__mutineBrushV036;
  const before = api.getFrame();
  const baseline = api.geometrySignature();
  const fault = before.faults[0];
  const vent = before.vents[1];
  const canvas = document.querySelector('#eclipse-canvas canvas');
  const rect = canvas.getBoundingClientRect();
  const point = (value) => ({ x: rect.left + value.x * rect.width, y: rect.top + value.y * rect.height });
  window.__probePoints = { fault: point(fault), vent: point(vent), exit: { x: rect.right - 12, y: rect.bottom - 18 } };
  return { baseline, memory: before.memory.length, fault, vent, controlHeights: [...document.querySelectorAll('.eclipse-controls button')].map((button) => Math.round(button.getBoundingClientRect().height)) };
});
const points = await interactionPage.evaluate(() => window.__probePoints);
await interactionPage.mouse.move(points.fault.x, points.fault.y);
await interactionPage.mouse.down();
await interactionPage.mouse.move(points.vent.x, points.vent.y, { steps: 4 });
const afterCross = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV036.geometrySignature(), phase: window.__mutineBrushV036.getFrame().pending.phase, memory: window.__mutineBrushV036.getFrame().memory.length }));
await interactionPage.mouse.move(points.exit.x, points.exit.y);
await interactionPage.mouse.up();
const afterCommit = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV036.geometrySignature(), phase: window.__mutineBrushV036.getFrame().pending.phase, memory: window.__mutineBrushV036.getFrame().memory.length, interaction: window.__mutineBrushV036.getFrame().interaction }));
await interactionPage.locator('#eclipse-field').focus();
await interactionPage.keyboard.press('Delete');
const afterLift = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV036.geometrySignature(), memory: window.__mutineBrushV036.getFrame().memory.length, interaction: window.__mutineBrushV036.getFrame().interaction }));
await interactionPage.keyboard.press('Enter');
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV036.getFrame().memory.length, interaction: window.__mutineBrushV036.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV036.getFrame().memory.length, interaction: window.__mutineBrushV036.getFrame().interaction }));
const interactionResult = {
  baselineSignatureLength: interaction.baseline.length,
  baselineMemory: interaction.memory,
  afterCross,
  afterCommit,
  afterLift,
  afterControl,
  afterRelease,
  crossGeometryUnchanged: afterCross.signature === interaction.baseline,
  liftExact: afterLift.signature === interaction.baseline,
  touchTargets: interaction.controlHeights,
  consoleMessages: interactionConsole,
  pageErrors: interactionErrors
};
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle' });
await blindPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const frame = window.__mutineBrushV036.getFrame();
  return {
    canvasVisible: Boolean(document.querySelector('#eclipse-canvas canvas')),
    readoutHidden: hidden('.eclipse-readout'),
    controlsHidden: hidden('.eclipse-controls'),
    hintHidden: hidden('.eclipse-hint'),
    memory: frame.memory.length,
    apertureCount: frame.apertures.length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindContext.close();

const readback = {};
for (const path of ['/studio/data/works.json', '/studio/data/catalog-public.json', canonicalPath, '/studio/favicon.svg']) {
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  readback[path] = { status: response.status, hasWork: text.includes('brush-2026-10-23'), hasJournal: text.includes('journal-brush-2026-10-23'), hasTitle: text.includes('The paint opens where you leave it.') };
}
const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalConsole = [];
const journalErrors = [];
journalPage.on('console', (message) => journalConsole.push({ type: message.type(), text: message.text() }));
journalPage.on('pageerror', (error) => journalErrors.push(String(error)));
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
const journalAnchor = journalPage.locator('#journal-brush-2026-10-23');
await journalAnchor.waitFor();
const journalText = await journalPage.locator('body').textContent();
const renderedJournalCount = await journalAnchor.count();
readback['/journal/'] = { status: journalResponse?.status() ?? null, hasWork: renderedJournalCount === 1, hasJournal: renderedJournalCount === 1, hasTitle: journalText.includes('The paint opens where you leave it.') };
diagnostics.push(...journalConsole.map((entry) => ({ label: 'journal', kind: 'console', ...entry })), ...journalErrors.map((error) => ({ label: 'journal', kind: 'pageerror', error })));
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-10-23',
  rawPath,
  canonicalPath,
  blindPath,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interaction: interactionResult,
  blind,
  readback,
  diagnostics,
  pass: matrix.length === 20
    && matrix.every((entry) => entry.status === 200 && entry.measurements.innerWidth === entry.measurements.clientWidth && entry.measurements.scrollWidth <= entry.width)
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth)
    && interactionResult.crossGeometryUnchanged
    && interactionResult.afterCommit.memory === 1
    && interactionResult.liftExact
    && interactionResult.afterControl.memory === 1
    && interactionResult.afterRelease.memory === 0
    && blind.canvasVisible && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.memory === 4 && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
    && interactionResult.touchTargets.every((height) => height >= 44)
    && Object.values(readback).every((entry) => entry.status === 200)
    && readback['/studio/data/works.json'].hasWork
    && readback['/studio/data/catalog-public.json'].hasWork
    && readback['/journal/'].hasJournal && readback['/journal/'].hasTitle
    && readback[canonicalPath].hasWork
    && diagnostics.length === 0
};
await writeFile(`${proofDir}/report.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await browser.close();
process.stdout.write(`${JSON.stringify({
  pass: summary.pass,
  matrix: matrix.length,
  diagnostics: diagnostics.length,
  viewportFailures: matrix.filter((entry) => entry.status !== 200 || entry.measurements.scrollWidth > entry.width || entry.artworkMeasurements.scrollWidth > entry.artworkMeasurements.innerWidth).map((entry) => entry.label),
  interaction: {
    crossGeometryUnchanged: interactionResult.crossGeometryUnchanged,
    committedMemory: interactionResult.afterCommit.memory,
    liftExact: interactionResult.liftExact,
    controlMemory: interactionResult.afterControl.memory,
    releasedMemory: interactionResult.afterRelease.memory,
    touchTargets: interactionResult.touchTargets
  },
  blind,
  readback
}, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
