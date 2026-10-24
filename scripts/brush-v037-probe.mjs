import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:4290';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v037-2026-10-24';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v037/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-10-24/';
const blindPath = '/studies/p5-brush/v037/?preview=1&static=1&blind=1';

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
  const handle = await iframe.elementHandle();
  return handle.contentFrame();
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
      const element = document.querySelector('.work-inspect__stage, #crease-field');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  }));
  const artworkMeasurements = await artwork.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: (() => {
      const rect = document.querySelector('#crease-canvas canvas')?.getBoundingClientRect();
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
const interaction = await interactionPage.evaluate(() => {
  const api = window.__mutineBrushV037;
  const before = api.getFrame();
  const canvas = document.querySelector('#crease-canvas canvas');
  const rect = canvas.getBoundingClientRect();
  const point = (value) => ({ x: rect.left + value.x * rect.width, y: rect.top + value.y * rect.height });
  return {
    baseline: api.geometrySignature(),
    memory: before.memory.length,
    start: point({ x: 0.22, y: 0.38 }),
    points: [point({ x: 0.34, y: 0.44 }), point({ x: 0.47, y: 0.50 }), point({ x: 0.61, y: 0.57 })],
    controlHeights: [...document.querySelectorAll('.crease-controls button')].map((button) => Math.round(button.getBoundingClientRect().height))
  };
});
await interactionPage.mouse.move(interaction.start.x, interaction.start.y);
await interactionPage.mouse.down();
for (const point of interaction.points) await interactionPage.mouse.move(point.x, point.y, { steps: 3 });
const afterPreview = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV037.geometrySignature(), memory: window.__mutineBrushV037.getFrame().memory.length, interaction: window.__mutineBrushV037.getFrame().interaction }));
await interactionPage.mouse.up();
const afterCommit = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV037.geometrySignature(), memory: window.__mutineBrushV037.getFrame().memory.length, interaction: window.__mutineBrushV037.getFrame().interaction, local: window.__mutineBrushV037.getFrame().event?.local === true }));
await interactionPage.locator('#crease-field').focus();
await interactionPage.keyboard.press('Delete');
const afterLift = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV037.geometrySignature(), memory: window.__mutineBrushV037.getFrame().memory.length, interaction: window.__mutineBrushV037.getFrame().interaction }));
await interactionPage.keyboard.press('Enter');
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV037.getFrame().memory.length, interaction: window.__mutineBrushV037.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV037.getFrame().memory.length, interaction: window.__mutineBrushV037.getFrame().interaction }));
await interactionContext.close();
const interactionResult = {
  baseline: interaction.baseline,
  baselineMemory: interaction.memory,
  afterPreview,
  afterCommit,
  afterLift,
  afterControl,
  afterRelease,
  previewGeometryUnchanged: afterPreview.signature === interaction.baseline,
  liftExact: afterLift.signature === interaction.baseline,
  committedChanged: afterCommit.signature !== interaction.baseline,
  localEvent: afterCommit.local,
  touchTargets: interaction.controlHeights,
  diagnostics: interactionDiagnostics
};

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage, 'blind');
await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await blindPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const current = window.__mutineBrushV037.getFrame();
  return {
    canvasVisible: Boolean(document.querySelector('#crease-canvas canvas')),
    readoutHidden: hidden('.crease-readout'),
    controlsHidden: hidden('.crease-controls'),
    hintHidden: hidden('.crease-hint'),
    memory: current.memory.length,
    openingCount: current.openingCount,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindContext.close();

const readback = {};
for (const path of ['/studio/data/works.json', '/studio/data/catalog-public.json', canonicalPath, '/studies/p5-brush/v037/?preview=1&static=1&blind=1', '/studio/favicon.svg']) {
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  readback[path] = {
    status: response.status,
    hasWork: text.includes('brush-2026-10-24'),
    hasJournal: text.includes('journal-brush-2026-10-24'),
    hasTitle: text.includes('The paint hardens at the touch.')
  };
}
const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalAnchor = journalPage.locator('#journal-brush-2026-10-24');
await journalAnchor.waitFor({ timeout: 20000 });
const journalText = await journalPage.locator('body').textContent();
readback['/journal/'] = {
  status: journalResponse?.status() ?? null,
  hasWork: await journalAnchor.count() === 1,
  hasJournal: await journalAnchor.count() === 1,
  hasTitle: journalText.includes('The paint hardens at the touch.')
};
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-10-24',
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
    && interactionResult.previewGeometryUnchanged
    && interactionResult.committedChanged
    && interactionResult.afterCommit.memory === 1
    && interactionResult.localEvent
    && interactionResult.liftExact
    && interactionResult.afterControl.memory === 1
    && interactionResult.afterRelease.memory === 0
    && blind.canvasVisible && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.memory === 4 && blind.openingCount > 0 && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
    && interactionResult.touchTargets.every((height) => height >= 44)
    && Object.values(readback).every((entry) => entry.status === 200)
    && readback['/studio/data/works.json'].hasWork
    && readback['/studio/data/catalog-public.json'].hasWork
    && readback['/journal/'].hasJournal && readback['/journal/'].hasTitle
    && readback[canonicalPath].hasWork
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
