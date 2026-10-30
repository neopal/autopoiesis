import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:49142';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v042-2026-10-30';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v042/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-10-30/';
const blindPath = '/studies/p5-brush/v042/?preview=1&static=1&blind=1';
const WELL = { x: 0.18, y: 0.28 };
const ACCEPTED = 1040;

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-dev-shm-usage']
});
const matrix = [];
const diagnostics = [];

function attachDiagnostics(page, label) {
  const local = { consoleMessages: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  page.on('console', (message) => local.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => local.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => local.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) local.httpErrors.push({ url: response.url(), status: response.status() }); });
  return local;
}

async function artworkFor(page, label) {
  if (!label.startsWith('canonical')) return page;
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ timeout: 20000 });
  return (await iframe.elementHandle()).contentFrame();
}

async function probe(path, width, height, reduced, label, screenshot) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const localDiagnostics = attachDiagnostics(page, label);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  const artwork = await artworkFor(page, label);
  await artwork.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
  const measurements = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeCount: document.querySelectorAll('iframe').length,
    stage: (() => {
      const element = document.querySelector('.work-inspect__stage, #cure-field');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  }));
  const artworkMeasurements = await artwork.evaluate(() => {
    const current = window.__mutineBrushV042?.getFrame();
    const rect = document.querySelector('#cure-field')?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasCount: document.querySelectorAll('#cure-canvas canvas').length,
      cellCount: current?.cells.length ?? 0,
      memory: current?.memory.length ?? 0,
      field: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      ready: window._p5Ready === true
    };
  });
  await page.screenshot({ path: `${proofDir}/${screenshot}`, fullPage: false });
  const result = { label, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, diagnostics: localDiagnostics };
  await context.close();
  diagnostics.push(...localDiagnostics.consoleMessages.map((entry) => ({ label, kind: 'console', ...entry })));
  diagnostics.push(...localDiagnostics.pageErrors.map((error) => ({ label, kind: 'pageerror', error })));
  diagnostics.push(...localDiagnostics.failedRequests.map((entry) => ({ label, kind: 'requestfailed', ...entry })));
  diagnostics.push(...localDiagnostics.httpErrors.map((entry) => ({ label, kind: 'http', ...entry })));
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
const interactionDiagnostics = attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await interactionPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const interaction = await interactionPage.evaluate(({ well, accepted }) => {
  const api = window.__mutineBrushV042;
  const baseline = api.geometrySignature();
  api.preview(well, accepted);
  const preview = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  api.commit(well, accepted);
  const committed = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length, event: api.getFrame().event };
  api.commit(well, 300);
  const refused = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  api.liftLatest();
  const lifted = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  const touchTargets = [...document.querySelectorAll('.cure-controls button')].map((button) => Math.round(button.getBoundingClientRect().height));
  return { baseline, preview, committed, refused, lifted, touchTargets };
}, { well: WELL, accepted: ACCEPTED });

await interactionPage.locator('[data-gesture="cure"]').click();
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV042.getFrame().memory.length, interaction: window.__mutineBrushV042.getFrame().interaction }));
await interactionPage.locator('#cure-field').focus();
await interactionPage.keyboard.press('Delete');
const afterDelete = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV042.geometrySignature(), memory: window.__mutineBrushV042.getFrame().memory.length }));
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV042.getFrame().memory.length, interaction: window.__mutineBrushV042.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV042.getFrame().memory.length, interaction: window.__mutineBrushV042.getFrame().interaction }));
const canvasRect = await interactionPage.locator('#cure-canvas canvas').boundingBox();
await interactionPage.mouse.move(canvasRect.x + canvasRect.width * WELL.x, canvasRect.y + canvasRect.height * WELL.y);
await interactionPage.mouse.down();
await interactionPage.waitForTimeout(1000);
await interactionPage.mouse.up();
const afterPointer = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV042.getFrame().memory.length, interaction: window.__mutineBrushV042.getFrame().interaction }));
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/journal/', '/currents/brush/', '/works/brush-2026-10-30/', '/studies/p5-brush/v042/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
  const result = {};
  for (const path of paths) {
    const response = await fetch(path);
    const text = await response.text();
    result[path] = { status: response.status, hasWork: text.includes('brush-2026-10-30'), hasJournal: text.includes('journal-brush-2026-10-30'), hasTitle: text.includes('The paint cures around the held breath.') };
  }
  return result;
});
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });
await interactionContext.close();
diagnostics.push(...interactionDiagnostics.consoleMessages.map((entry) => ({ label: 'interaction', kind: 'console', ...entry })));
diagnostics.push(...interactionDiagnostics.pageErrors.map((error) => ({ label: 'interaction', kind: 'pageerror', error })));
diagnostics.push(...interactionDiagnostics.failedRequests.map((entry) => ({ label: 'interaction', kind: 'requestfailed', ...entry })));
diagnostics.push(...interactionDiagnostics.httpErrors.map((entry) => ({ label: 'interaction', kind: 'http', ...entry })));
const interactionResult = {
  baseline: interaction.baseline,
  preview: interaction.preview,
  committed: interaction.committed,
  refused: interaction.refused,
  lifted: interaction.lifted,
  afterControl,
  afterDelete,
  afterKeyboard,
  afterRelease,
  afterPointer,
  previewGeometryUnchanged: interaction.preview.signature === interaction.baseline,
  committedChanged: interaction.committed.signature !== interaction.baseline,
  shortRefused: interaction.refused.interaction === 'dwell-refused-short' && interaction.refused.signature === interaction.committed.signature,
  liftExact: interaction.lifted.signature === interaction.baseline,
  touchTargets: interaction.touchTargets,
  diagnostics: interactionDiagnostics,
  readback: localReadback
};

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage, 'blind');
await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await blindPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const current = window.__mutineBrushV042.getFrame();
  return {
    canvasVisible: getComputedStyle(document.querySelector('#cure-canvas')).display !== 'none',
    canvasCount: document.querySelectorAll('#cure-canvas canvas').length,
    cellCount: current.cells.length,
    crackSamples: current.cells.filter((cell) => cell.crack > 0.25).length,
    readoutHidden: hidden('.cure-readout'),
    controlsHidden: hidden('.cure-controls'),
    hintHidden: hidden('.cure-hint'),
    memory: current.memory.length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });
await blindContext.close();
diagnostics.push(...blindDiagnostics.consoleMessages.map((entry) => ({ label: 'blind', kind: 'console', ...entry })));
diagnostics.push(...blindDiagnostics.pageErrors.map((error) => ({ label: 'blind', kind: 'pageerror', error })));
diagnostics.push(...blindDiagnostics.failedRequests.map((entry) => ({ label: 'blind', kind: 'requestfailed', ...entry })));
diagnostics.push(...blindDiagnostics.httpErrors.map((entry) => ({ label: 'blind', kind: 'http', ...entry })));

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalAnchor = journalPage.locator('#journal-brush-2026-10-30');
await journalAnchor.waitFor({ timeout: 20000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalAnchor.count() === 1, hasTitle: journalText.includes('The paint cures around the held breath.') };
await journalPage.screenshot({ path: `${proofDir}/journal-1280x800.png`, fullPage: false });
await journalContext.close();
diagnostics.push(...journalDiagnostics.consoleMessages.map((entry) => ({ label: 'journal', kind: 'console', ...entry })));
diagnostics.push(...journalDiagnostics.pageErrors.map((error) => ({ label: 'journal', kind: 'pageerror', error })));
diagnostics.push(...journalDiagnostics.failedRequests.map((entry) => ({ label: 'journal', kind: 'requestfailed', ...entry })));
diagnostics.push(...journalDiagnostics.httpErrors.map((entry) => ({ label: 'journal', kind: 'http', ...entry })));

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-10-30',
  rawPath,
  canonicalPath,
  blindPath,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interaction: interactionResult,
  blind,
  journal,
  diagnostics,
  pass: matrix.length === 20
    && matrix.every((entry) => entry.status === 200 && entry.measurements.innerWidth === entry.measurements.clientWidth && entry.measurements.scrollWidth <= entry.width)
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.canvasCount === 1 && entry.artworkMeasurements.cellCount === 3456)
    && interactionResult.previewGeometryUnchanged
    && interactionResult.committedChanged
    && interactionResult.shortRefused
    && interactionResult.liftExact
    && interactionResult.afterControl.memory === 1
    && interactionResult.afterDelete.memory === 0
    && interactionResult.afterKeyboard.memory === 1
    && interactionResult.afterRelease.memory === 0
    && interactionResult.afterPointer.memory === 1
    && interactionResult.touchTargets.every((height) => height >= 44)
    && Object.values(interactionResult.readback).every((entry) => entry.status === 200)
    && interactionResult.readback['/studio/data/works.json'].hasWork
    && interactionResult.readback['/studio/data/catalog-public.json'].hasWork
    && interactionResult.readback['/works/brush-2026-10-30/'].hasWork
    && blind.canvasVisible && blind.canvasCount === 1 && blind.cellCount === 3456 && blind.crackSamples > 0 && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.memory === 4 && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
    && journal.hasAnchor && journal.hasTitle
    && diagnostics.length === 0
};
await writeFile(`${proofDir}/qa-summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await browser.close();
process.stdout.write(`${JSON.stringify({
  pass: summary.pass,
  matrix: matrix.length,
  diagnostics: diagnostics.length,
  viewportFailures: matrix.filter((entry) => entry.status !== 200 || entry.measurements.scrollWidth > entry.width || entry.artworkMeasurements.scrollWidth > entry.artworkMeasurements.innerWidth).map((entry) => entry.label),
  interaction: {
    previewGeometryUnchanged: interactionResult.previewGeometryUnchanged,
    committedChanged: interactionResult.committedChanged,
    shortRefused: interactionResult.shortRefused,
    liftExact: interactionResult.liftExact,
    afterControl: interactionResult.afterControl.memory,
    afterKeyboard: interactionResult.afterKeyboard.memory,
    afterRelease: interactionResult.afterRelease.memory,
    afterPointer: interactionResult.afterPointer.memory,
    touchTargets: interactionResult.touchTargets
  },
  blind,
  journal,
  readback: interactionResult.readback
}, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
