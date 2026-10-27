import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:49339';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v039-2026-10-27';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v039/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-10-27/';
const blindPath = '/studies/p5-brush/v039/?preview=1&static=1&blind=1';
const closedLoop = [
  { x: 0.48, y: 0.25 }, { x: 0.58, y: 0.22 }, { x: 0.65, y: 0.30 },
  { x: 0.63, y: 0.39 }, { x: 0.54, y: 0.43 }, { x: 0.45, y: 0.37 }, { x: 0.48, y: 0.25 }
];
const openLoop = closedLoop.slice(0, -1);

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
  page.on('close', () => {
    diagnostics.push(...local.consoleMessages.map((entry) => ({ label, kind: 'console', ...entry })));
    diagnostics.push(...local.pageErrors.map((error) => ({ label, kind: 'pageerror', error })));
    diagnostics.push(...local.failedRequests.map((entry) => ({ label, kind: 'requestfailed', ...entry })));
    diagnostics.push(...local.httpErrors.map((entry) => ({ label, kind: 'http', ...entry })));
  });
  return local;
}

async function artworkFrameFor(page, label) {
  if (!label.startsWith('canonical')) return page;
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ timeout: 20000 });
  return (await iframe.elementHandle()).contentFrame();
}

async function probe(path, width, height, reduced, label, screenshotName) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const localDiagnostics = attachDiagnostics(page, label);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  const artwork = await artworkFrameFor(page, label);
  await artwork.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
  const measurements = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeCount: document.querySelectorAll('iframe').length,
    stage: (() => {
      const element = document.querySelector('.work-inspect__stage, #wound-field');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  }));
  const artworkMeasurements = await artwork.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    svgCount: document.querySelectorAll('#wound-svg').length,
    contourCount: document.querySelectorAll('.contour-line').length,
    field: (() => {
      const rect = document.querySelector('#wound-field')?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    })(),
    ready: window._p5Ready === true
  }));
  await page.screenshot({ path: `${proofDir}/${screenshotName}`, fullPage: false });
  const result = { label, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, diagnostics: localDiagnostics };
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
const interactionDiagnostics = attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await interactionPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const interaction = await interactionPage.evaluate(({ loop, open }) => {
  const api = window.__mutineBrushV039;
  const baseline = api.geometrySignature();
  api.preview(open);
  const preview = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  api.commit(loop);
  const committed = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length, holes: api.getFrame().holeCount };
  api.commit(open);
  const refused = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  api.lift();
  const lifted = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  const touchTargets = [...document.querySelectorAll('.wound-controls button')].map((button) => Math.round(button.getBoundingClientRect().height));
  return { baseline, preview, committed, refused, lifted, touchTargets };
}, { loop: closedLoop, open: openLoop });
await interactionPage.locator('[data-gesture="remove"]').click();
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV039.getFrame().memory.length, interaction: window.__mutineBrushV039.getFrame().interaction }));
await interactionPage.locator('#wound-field').focus();
await interactionPage.keyboard.press('Delete');
const afterDelete = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV039.geometrySignature(), memory: window.__mutineBrushV039.getFrame().memory.length }));
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV039.getFrame().memory.length, interaction: window.__mutineBrushV039.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV039.getFrame().memory.length, interaction: window.__mutineBrushV039.getFrame().interaction }));
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/brush-2026-10-27/', '/studies/p5-brush/v039/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
  const result = {};
  for (const path of paths) {
    const response = await fetch(path);
    const text = await response.text();
    result[path] = { status: response.status, hasWork: text.includes('brush-2026-10-27'), hasJournal: text.includes('journal-brush-2026-10-27'), hasTitle: text.includes('The stain keeps its holes.') };
  }
  return result;
});
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });
await interactionContext.close();
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
  previewGeometryUnchanged: interaction.preview.signature === interaction.baseline,
  committedChanged: interaction.committed.signature !== interaction.baseline,
  openRefused: interaction.refused.interaction === 'loop-refused-open' && interaction.refused.signature === interaction.committed.signature,
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
  const current = window.__mutineBrushV039.getFrame();
  return {
    svgVisible: getComputedStyle(document.querySelector('#wound-svg')).display !== 'none',
    contourCount: document.querySelectorAll('.contour-line').length,
    holeCount: current.holeCount,
    woundCount: document.querySelectorAll('.wound-hole').length,
    readoutHidden: hidden('.wound-readout'),
    controlsHidden: hidden('.wound-controls'),
    hintHidden: hidden('.wound-hint'),
    traceHidden: document.querySelectorAll('.pressure-trace').length === 0,
    memory: current.memory.length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalAnchor = journalPage.locator('#journal-brush-2026-10-27');
await journalAnchor.waitFor({ timeout: 20000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalAnchor.count() === 1, hasTitle: journalText.includes('The stain keeps its holes.') };
await journalPage.screenshot({ path: `${proofDir}/journal-1280x800.png`, fullPage: false });
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-10-27',
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
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.svgCount === 1 && entry.artworkMeasurements.contourCount === 16)
    && interactionResult.previewGeometryUnchanged
    && interactionResult.committedChanged
    && interactionResult.openRefused
    && interactionResult.liftExact
    && interactionResult.afterControl.memory === 1
    && interactionResult.afterDelete.memory === 0
    && interactionResult.afterKeyboard.memory === 1
    && interactionResult.afterRelease.memory === 0
    && interactionResult.touchTargets.every((height) => height >= 44)
    && Object.values(interactionResult.readback).every((entry) => entry.status === 200)
    && interactionResult.readback['/studio/data/works.json'].hasWork
    && interactionResult.readback['/studio/data/catalog-public.json'].hasWork
    && interactionResult.readback['/works/brush-2026-10-27/'].hasWork
    && blind.svgVisible && blind.contourCount === 16 && blind.holeCount === 4 && blind.woundCount === 4 && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.traceHidden && blind.memory === 4 && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
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
    openRefused: interactionResult.openRefused,
    liftExact: interactionResult.liftExact,
    afterControl: interactionResult.afterControl.memory,
    afterKeyboard: interactionResult.afterKeyboard.memory,
    afterRelease: interactionResult.afterRelease.memory,
    touchTargets: interactionResult.touchTargets
  },
  blind,
  journal,
  readback: interactionResult.readback
}, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
