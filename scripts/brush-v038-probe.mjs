import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:4290';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v038-2026-10-26';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v038/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-10-26/';
const blindPath = '/studies/p5-brush/v038/?preview=1&static=1&blind=1';

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
      const element = document.querySelector('.work-inspect__stage, #lamina-field');
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()
  }));
  const artworkMeasurements = await artwork.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    layerCount: document.querySelectorAll('.lamina').length,
    canvasCount: document.querySelectorAll('canvas').length,
    stack: (() => {
      const rect = document.querySelector('#lamina-stack')?.getBoundingClientRect();
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
  const api = window.__mutineBrushV038;
  return {
    baseline: api.geometrySignature(),
    memory: api.getFrame().memory.length,
    seamHeights: [...document.querySelectorAll('.seam-node')].map((node) => Math.round(node.getBoundingClientRect().height)),
    controlHeights: [...document.querySelectorAll('.lamina-controls button')].map((button) => Math.round(button.getBoundingClientRect().height))
  };
});
await interactionPage.locator('[data-seam="1"]').click();
const afterFirst = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV038.geometrySignature(), pending: window.__mutineBrushV038.getFrame().pending.seams, memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction }));
await interactionPage.locator('[data-seam="5"]').click();
const afterCommit = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV038.geometrySignature(), memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction, event: window.__mutineBrushV038.getFrame().event }));
await interactionPage.locator('#lamina-field').focus();
await interactionPage.keyboard.press('Delete');
const afterLift = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV038.geometrySignature(), memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction }));
await interactionPage.locator('[data-seam="2"]').click();
await interactionPage.locator('[data-seam="3"]').click();
const adjacent = await interactionPage.evaluate((baseline) => ({ signature: window.__mutineBrushV038.geometrySignature(), baseline, memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction }), interaction.baseline);
await interactionPage.locator('#lamina-field').focus();
await interactionPage.keyboard.press('Enter');
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV038.getFrame().memory.length, interaction: window.__mutineBrushV038.getFrame().interaction }));
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/brush-2026-10-26/', '/studies/p5-brush/v038/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
  const result = {};
  for (const path of paths) {
    const response = await fetch(path);
    const text = await response.text();
    result[path] = { status: response.status, hasWork: text.includes('brush-2026-10-26'), hasJournal: text.includes('journal-brush-2026-10-26'), hasTitle: text.includes('The paint opens between layers.') };
  }
  return result;
});
await interactionContext.close();
const interactionResult = {
  baseline: interaction.baseline,
  baselineMemory: interaction.memory,
  afterFirst,
  afterCommit,
  afterLift,
  adjacent,
  afterControl,
  afterRelease,
  firstSelectionGeometryUnchanged: afterFirst.signature === interaction.baseline,
  committedChanged: afterCommit.signature !== interaction.baseline,
  liftExact: afterLift.signature === interaction.baseline,
  adjacentRefused: adjacent.interaction === 'pinch-refused-adjacent',
  touchTargets: [...interaction.seamHeights, ...interaction.controlHeights],
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
  const current = window.__mutineBrushV038.getFrame();
  return {
    layerCount: document.querySelectorAll('.lamina').length,
    stackVisible: Boolean(document.querySelector('#lamina-stack .lamina')),
    seamNodesHidden: hidden('.seam-nodes'),
    readoutHidden: hidden('.lamina-readout'),
    controlsHidden: hidden('.lamina-controls'),
    hintHidden: hidden('.lamina-hint'),
    memory: current.memory.length,
    peelCount: current.peelCount,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalAnchor = journalPage.locator('#journal-brush-2026-10-26');
await journalAnchor.waitFor({ timeout: 20000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalAnchor.count() === 1, hasTitle: journalText.includes('The paint opens between layers.') };
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-10-26',
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
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.layerCount === 9 && entry.artworkMeasurements.canvasCount === 0)
    && interactionResult.firstSelectionGeometryUnchanged
    && interactionResult.committedChanged
    && interactionResult.afterCommit.memory === 1
    && interactionResult.afterCommit.event.peelSkin !== interactionResult.afterCommit.event.sealSkin
    && interactionResult.afterCommit.event.sealSkin !== interactionResult.afterCommit.event.shedSkin
    && interactionResult.liftExact
    && interactionResult.adjacentRefused
    && interactionResult.afterControl.memory === 1
    && interactionResult.afterRelease.memory === 0
    && interactionResult.touchTargets.every((height) => height >= 44)
    && Object.values(interactionResult.readback).every((entry) => entry.status === 200)
    && interactionResult.readback['/studio/data/works.json'].hasWork
    && interactionResult.readback['/studio/data/catalog-public.json'].hasWork
    && interactionResult.readback['/works/brush-2026-10-26/'].hasWork
    && blind.stackVisible && blind.layerCount === 9 && blind.seamNodesHidden && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.memory === 4 && blind.peelCount > 0 && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
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
    firstSelectionGeometryUnchanged: interactionResult.firstSelectionGeometryUnchanged,
    committedMemory: interactionResult.afterCommit.memory,
    liftExact: interactionResult.liftExact,
    adjacentRefused: interactionResult.adjacentRefused,
    controlMemory: interactionResult.afterControl.memory,
    releasedMemory: interactionResult.afterRelease.memory,
    touchTargets: interactionResult.touchTargets
  },
  blind,
  journal,
  readback: interactionResult.readback
}, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
