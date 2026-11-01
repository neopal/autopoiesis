import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:49143';
const proofDir = process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/brush-v044-2026-11-01';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/p5-brush/v044/?preview=1&interaction=1';
const canonicalPath = '/works/brush-2026-11-01/';
const blindPath = '/studies/p5-brush/v044/?preview=1&static=1&blind=1';
const TRAVERSE = [
  { x: 0.08, y: 0.34 },
  { x: 0.28, y: 0.38 },
  { x: 0.51, y: 0.43 },
  { x: 0.75, y: 0.48 },
  { x: 0.92, y: 0.51 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-dev-shm-usage']
});
const matrix = [];
const diagnostics = [];

function attachDiagnostics(page) {
  const local = { consoleMessages: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  page.on('console', (message) => local.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => local.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => local.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) local.httpErrors.push({ url: response.url(), status: response.status() }); });
  return local;
}

function addDiagnostics(local, label) {
  diagnostics.push(...local.consoleMessages.map((entry) => ({ label, kind: 'console', ...entry })));
  diagnostics.push(...local.pageErrors.map((error) => ({ label, kind: 'pageerror', error })));
  diagnostics.push(...local.failedRequests.map((entry) => ({ label, kind: 'requestfailed', ...entry })));
  diagnostics.push(...local.httpErrors.map((entry) => ({ label, kind: 'http', ...entry })));
}

async function artworkFor(page, canonical) {
  if (!canonical) return page;
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ timeout: 20000 });
  return (await iframe.elementHandle()).contentFrame();
}

async function probe(path, width, height, reduced, label, screenshot) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const local = attachDiagnostics(page);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  const canonical = path === canonicalPath;
  const artwork = await artworkFor(page, canonical);
  await artwork.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
  const measurements = await page.evaluate(() => {
    const element = document.querySelector('.work-inspect__stage, #counterfield-field');
    const rect = element?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeCount: document.querySelectorAll('iframe').length,
      stage: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null
    };
  });
  const artworkMeasurements = await artwork.evaluate(() => {
    const current = window.__mutineBrushV044?.getFrame();
    const rect = document.querySelector('#counterfield-field')?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasCount: document.querySelectorAll('#counterfield-canvas canvas').length,
      bandCount: current?.body.strata.length ?? 0,
      cutCount: current?.body.cuts.length ?? 0,
      depositCount: current?.body.deposits.length ?? 0,
      memory: current?.memory.length ?? 0,
      field: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      ready: window._p5Ready === true
    };
  });
  await page.screenshot({ path: `${proofDir}/${screenshot}`, fullPage: false });
  const result = { label, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, diagnostics: local };
  addDiagnostics(local, label);
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

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1, hasTouch: true });
const interactionPage = await interactionContext.newPage();
const interactionDiagnostics = attachDiagnostics(interactionPage);
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await interactionPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const interaction = await interactionPage.evaluate((path) => {
  const api = window.__mutineBrushV044;
  const baseline = api.geometrySignature();
  api.begin(path[0]);
  api.continue(path[2]);
  const preview = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length, threshold: api.getState().pending.thresholdCrossed };
  api.commit(path[4]);
  const committed = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length, cuts: api.getFrame().body.cuts.length, deposits: api.getFrame().body.deposits.length };
  api.liftLatest();
  const lifted = { signature: api.geometrySignature(), interaction: api.getFrame().interaction, memory: api.getFrame().memory.length };
  const touchTargets = [...document.querySelectorAll('.counterfield-controls button')].map((button) => Math.round(button.getBoundingClientRect().height));
  return { baseline, preview, committed, lifted, touchTargets };
}, TRAVERSE);

await interactionPage.locator('[data-gesture="traverse"]').click();
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV044.getFrame().memory.length, interaction: window.__mutineBrushV044.getFrame().interaction }));
await interactionPage.locator('#counterfield-field').focus();
await interactionPage.keyboard.press('Delete');
const afterDelete = await interactionPage.evaluate(() => ({ signature: window.__mutineBrushV044.geometrySignature(), memory: window.__mutineBrushV044.getFrame().memory.length }));
await interactionPage.keyboard.press('Enter');
const afterKeyboard = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV044.getFrame().memory.length, interaction: window.__mutineBrushV044.getFrame().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV044.getFrame().memory.length, interaction: window.__mutineBrushV044.getFrame().interaction }));
const canvasRect = await interactionPage.locator('#counterfield-canvas canvas').boundingBox();
await interactionPage.mouse.move(canvasRect.x + canvasRect.width * TRAVERSE[0].x, canvasRect.y + canvasRect.height * TRAVERSE[0].y);
await interactionPage.mouse.down();
for (const point of TRAVERSE.slice(1)) await interactionPage.mouse.move(canvasRect.x + canvasRect.width * point.x, canvasRect.y + canvasRect.height * point.y);
await interactionPage.mouse.up();
const afterPointer = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV044.getFrame().memory.length, interaction: window.__mutineBrushV044.getFrame().interaction }));
await interactionPage.evaluate(() => window.__mutineBrushV044.release());
await interactionPage.evaluate((path) => {
  const canvas = document.querySelector('#counterfield-canvas canvas');
  const rect = canvas.getBoundingClientRect();
  const point = (value) => ({ clientX: rect.left + rect.width * value.x, clientY: rect.top + rect.height * value.y });
  const dispatch = (type, value) => canvas.dispatchEvent(new PointerEvent(type, { ...point(value), pointerId: 7, pointerType: 'touch', isPrimary: true, button: type === 'pointerup' ? 0 : 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
  dispatch('pointerdown', path[0]);
  for (const value of path.slice(1)) dispatch('pointermove', value);
  dispatch('pointerup', path.at(-1));
}, TRAVERSE);
const afterTouch = await interactionPage.evaluate(() => ({ memory: window.__mutineBrushV044.getFrame().memory.length, interaction: window.__mutineBrushV044.getFrame().interaction }));
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/journal/', '/currents/brush/', '/works/brush-2026-11-01/', '/studies/p5-brush/v044/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
  const result = {};
  for (const path of paths) {
    const response = await fetch(path);
    const text = await response.text();
    result[path] = { status: response.status, hasWork: text.includes('brush-2026-11-01'), hasJournal: text.includes('journal-brush-2026-11-01'), hasTitle: text.includes('The brush keeps what the field cannot carry.') };
  }
  return result;
});
await interactionContext.close();
addDiagnostics(interactionDiagnostics, 'interaction');

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage);
await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await blindPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const current = window.__mutineBrushV044.getFrame();
  return {
    canvasVisible: getComputedStyle(document.querySelector('#counterfield-canvas')).display !== 'none',
    canvasCount: document.querySelectorAll('#counterfield-canvas canvas').length,
    bandCount: current.body.strata.length,
    cutCount: current.body.cuts.length,
    depositCount: current.body.deposits.length,
    memory: current.memory.length,
    readoutHidden: hidden('.counterfield-readout'),
    controlsHidden: hidden('.counterfield-controls'),
    hintHidden: hidden('.counterfield-hint'),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });
await blindContext.close();
addDiagnostics(blindDiagnostics, 'blind');

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage);
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalAnchor = journalPage.locator('#journal-brush-2026-11-01');
await journalAnchor.waitFor({ timeout: 20000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalAnchor.count() === 1, hasTitle: journalText.includes('The brush keeps what the field cannot carry.') };
await journalPage.screenshot({ path: `${proofDir}/journal-1280x800.png`, fullPage: false });
await journalContext.close();
addDiagnostics(journalDiagnostics, 'journal');

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'brush-2026-11-01',
  rawPath,
  canonicalPath,
  blindPath,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interaction: {
    ...interaction,
    afterControl,
    afterDelete,
    afterKeyboard,
    afterRelease,
    afterPointer,
    afterTouch,
    previewGeometryUnchanged: interaction.preview.signature === interaction.baseline,
    committedChanged: interaction.committed.signature !== interaction.baseline,
    liftExact: interaction.lifted.signature === interaction.baseline,
    touchTargets: interaction.touchTargets,
    readback: localReadback
  },
  blind,
  journal,
  diagnostics,
  pass: matrix.length === 20
    && matrix.every((entry) => entry.status === 200 && entry.measurements.innerWidth === entry.measurements.clientWidth && entry.measurements.scrollWidth <= entry.width)
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.canvasCount === 1 && entry.artworkMeasurements.bandCount === 7)
    && interaction.preview.signature === interaction.baseline
    && interaction.preview.threshold
    && interaction.committed.signature !== interaction.baseline
    && interaction.lifted.signature === interaction.baseline
    && afterControl.memory === 1
    && afterDelete.memory === 0
    && afterKeyboard.memory === 1
    && afterRelease.memory === 0
    && afterPointer.memory === 1
    && afterTouch.memory === 1
    && interaction.touchTargets.every((height) => height >= 44)
    && Object.values(localReadback).every((entry) => entry.status === 200)
    && localReadback['/studio/data/works.json'].hasWork
    && localReadback['/studio/data/catalog-public.json'].hasWork
    && localReadback['/works/brush-2026-11-01/'].hasWork
    && blind.canvasVisible && blind.canvasCount === 1 && blind.bandCount === 7 && blind.cutCount === 4 && blind.depositCount === 4 && blind.memory === 4 && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
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
    previewGeometryUnchanged: interaction.preview.signature === interaction.baseline,
    committedChanged: interaction.committed.signature !== interaction.baseline,
    liftExact: interaction.lifted.signature === interaction.baseline,
    afterControl: afterControl.memory,
    afterKeyboard: afterKeyboard.memory,
    afterRelease: afterRelease.memory,
    afterPointer: afterPointer.memory,
    afterTouch: afterTouch.memory,
    touchTargets: interaction.touchTargets
  },
  blind,
  journal,
  readback: localReadback
}, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
