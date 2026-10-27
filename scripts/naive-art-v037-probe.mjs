import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.MUTINE_PROBE_BASE_URL || 'http://127.0.0.1:49370';
const output = path.resolve(root, process.env.MUTINE_PROBE_OUTPUT || 'research/qa/proofs/naive-art-v037-2026-10-27');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/naive-art/v037/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v037/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-10-27/';

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--disable-dev-shm-usage']
});
const diagnostics = [];

function attachDiagnostics(page, label) {
  const local = [];
  page.on('pageerror', (error) => local.push({ label, kind: 'pageerror', error: String(error) }));
  page.on('requestfailed', (request) => local.push({ label, kind: 'requestfailed', url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) local.push({ label, kind: 'http', url: response.url(), status: response.status() });
  });
  return local;
}

async function resolveArtwork(page, canonical) {
  if (!canonical) return page;
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ timeout: 20000 });
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  await frame.locator('#print-field').waitFor({ timeout: 20000 });
  return frame;
}

async function probeRoute(route, width, height, reduced, label) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const local = attachDiagnostics(page, label);
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  const artwork = await resolveArtwork(page, route === canonicalPath);
  const measurements = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeCount: document.querySelectorAll('iframe').length,
    title: document.title
  }));
  const artworkMeasurements = await artwork.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasCount: document.querySelectorAll('canvas').length,
    svgCount: document.querySelectorAll('svg').length,
    stampCount: window.__mutineNaiveV037?.getState().scene.stamps.length ?? null,
    memory: window.__mutineNaiveV037?.getState().memory.length ?? null,
    ready: Boolean(window.__mutineNaiveV037),
    p5Ready: Boolean(window._p5Ready)
  }));
  await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: false });
  diagnostics.push(...local);
  const result = { label, route, width, height, reduced, status: response?.status() ?? null, measurements, artworkMeasurements, diagnostics: local };
  await context.close();
  return result;
}

const matrix = [];
for (const reduced of [false, true]) {
  for (const [width, height] of viewports) {
    const suffix = `${width}x${height}-${reduced ? 'reduced' : 'normal'}`;
    matrix.push(await probeRoute(rawPath, width, height, reduced, `raw-${suffix}`));
    matrix.push(await probeRoute(canonicalPath, width, height, reduced, `canonical-${suffix}`));
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const interactionPage = await interactionContext.newPage();
const interactionDiagnostics = attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
const field = interactionPage.locator('#print-field');
await field.waitFor();
const initial = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV037.geometrySignature(window.__mutineNaiveV037.getState()),
  memory: window.__mutineNaiveV037.getState().memory.length,
  pending: window.__mutineNaiveV037.getState().pending,
  stampCount: window.__mutineNaiveV037.getState().scene.stamps.length,
  buttonHeights: [...document.querySelectorAll('.print-controls button')].map((button) => Math.round(button.getBoundingClientRect().height)),
  rect: document.querySelector('#print-field').getBoundingClientRect().toJSON(),
  stamps: window.__mutineNaiveV037.getState().scene.stamps.map(({ x, y }) => ({ x, y }))
}));
const tapPoint = (stamp) => ({ x: initial.rect.x + initial.rect.width * stamp.x, y: initial.rect.y + initial.rect.height * stamp.y });
for (const index of [1, 4]) {
  const point = tapPoint(initial.stamps[index]);
  await interactionPage.mouse.click(point.x, point.y);
}
const afterTwoTaps = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV037.geometrySignature(window.__mutineNaiveV037.getState()),
  memory: window.__mutineNaiveV037.getState().memory.length,
  pendingCount: Number(document.querySelector('#print-field').dataset.pendingCount)
}));
const third = tapPoint(initial.stamps[8]);
await interactionPage.mouse.click(third.x, third.y);
const afterThreeTaps = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV037.geometrySignature(window.__mutineNaiveV037.getState()),
  memory: window.__mutineNaiveV037.getState().memory.length,
  event: window.__mutineNaiveV037.getState().memory.at(-1),
  roles: window.__mutineNaiveV037.getState().scene.stamps.filter((stamp) => stamp.role !== 'quiet').map(({ id, role }) => ({ id, role }))
}));
await field.focus();
await interactionPage.keyboard.press('Delete');
const afterLift = await interactionPage.evaluate(() => ({
  signature: window.__mutineNaiveV037.geometrySignature(window.__mutineNaiveV037.getState()),
  memory: window.__mutineNaiveV037.getState().memory.length,
  interaction: window.__mutineNaiveV037.getState().interaction
}));
await interactionPage.keyboard.press('Enter');
const afterKeyboardCommit = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV037.getState().memory.length, interaction: window.__mutineNaiveV037.getState().interaction }));
await interactionPage.keyboard.press('Escape');
const afterRelease = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV037.getState().memory.length, interaction: window.__mutineNaiveV037.getState().interaction }));
await interactionPage.locator('[data-action="misread"]').click();
const afterControl = await interactionPage.evaluate(() => ({ memory: window.__mutineNaiveV037.getState().memory.length, interaction: window.__mutineNaiveV037.getState().interaction }));
await interactionPage.locator('[data-action="release"]').click();
const localReadback = await interactionPage.evaluate(async () => {
  const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/naive-2026-10-27/', '/journal/', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await fetch(route);
    const text = await response.text();
    result[route] = { status: response.status, hasWork: text.includes('naive-2026-10-27'), hasJournal: text.includes('journal-naive-2026-10-27'), hasTitle: text.includes('The mistake cures the wrong edge.') };
  }
  return result;
});
const interaction = {
  initial,
  afterTwoTaps,
  afterThreeTaps,
  afterLift,
  afterKeyboardCommit,
  afterRelease,
  afterControl,
  touchTargets: initial.buttonHeights,
  twoTapsGeometryNeutral: afterTwoTaps.signature === initial.signature && afterTwoTaps.memory === 0,
  threeTapsCommitted: afterThreeTaps.memory === 1 && afterThreeTaps.signature !== initial.signature,
  baselineRestored: afterLift.signature === initial.signature && afterLift.memory === 0,
  keyboardCommitted: afterKeyboardCommit.memory === 1,
  releaseCleared: afterRelease.memory === 0,
  controlCommitted: afterControl.memory === 1,
  readback: localReadback,
  diagnostics: interactionDiagnostics
};
diagnostics.push(...interactionDiagnostics);
await interactionPage.screenshot({ path: path.join(output, 'interaction-390x844.png'), fullPage: false });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage, 'blind');
const blindResponse = await blindPage.goto(`${base}${blindPath}`, { waitUntil: 'networkidle', timeout: 30000 });
const blind = await blindPage.evaluate(() => {
  const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
  const frame = window.__mutineNaiveV037.getState();
  return {
    memory: frame.memory.length,
    stampCount: frame.scene.stamps.length,
    roles: frame.scene.stamps.filter((stamp) => stamp.role !== 'quiet').map((stamp) => stamp.role),
    canvasVisible: document.querySelector('canvas')?.getBoundingClientRect().width > 0,
    readoutHidden: hidden('.print-readout'),
    controlsHidden: hidden('.print-controls'),
    hintHidden: hidden('.print-hint'),
    pendingHidden: hidden('.print-pending'),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
await blindPage.screenshot({ path: path.join(output, 'blind-390x844-reduced.png'), fullPage: false });
diagnostics.push(...blindDiagnostics);
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
const journalDiagnostics = attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
const journalText = await journalPage.locator('body').textContent();
const journal = { status: journalResponse?.status() ?? null, hasAnchor: await journalPage.locator('#journal-naive-2026-10-27').count() === 1, hasTitle: journalText.includes('The mistake cures the wrong edge.') };
diagnostics.push(...journalDiagnostics);
await journalContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  base,
  target: 'naive-2026-10-27',
  rawPath,
  canonicalPath,
  blindPath,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interaction,
  blind: { ...blind, statusCode: blindResponse?.status() ?? null },
  journal,
  diagnostics,
  pass: matrix.length === 20
    && matrix.every((entry) => entry.status === 200 && entry.measurements.innerWidth === entry.width && entry.measurements.clientWidth === entry.width && entry.measurements.scrollWidth <= entry.width)
    && matrix.every((entry) => entry.artworkMeasurements.ready && entry.artworkMeasurements.p5Ready && entry.artworkMeasurements.innerWidth === entry.artworkMeasurements.clientWidth && entry.artworkMeasurements.scrollWidth <= entry.artworkMeasurements.innerWidth && entry.artworkMeasurements.canvasCount === 1 && entry.artworkMeasurements.svgCount === 0 && entry.artworkMeasurements.stampCount === 13)
    && interaction.twoTapsGeometryNeutral
    && interaction.threeTapsCommitted
    && interaction.baselineRestored
    && interaction.keyboardCommitted
    && interaction.releaseCleared
    && interaction.controlCommitted
    && interaction.touchTargets.every((height) => height >= 44)
    && Object.values(localReadback).every((entry) => entry.status === 200)
    && localReadback['/studio/data/works.json'].hasWork
    && localReadback['/studio/data/catalog-public.json'].hasWork
    && localReadback['/works/naive-2026-10-27/'].hasTitle
    && blindResponse?.status() === 200
    && blind.memory === 4
    && blind.stampCount === 13
    && blind.roles.length >= 3
    && blind.canvasVisible
    && blind.readoutHidden && blind.controlsHidden && blind.hintHidden && blind.pendingHidden
    && blind.innerWidth === blind.clientWidth && blind.scrollWidth <= blind.innerWidth
    && journal.status === 200 && journal.hasAnchor && journal.hasTitle
    && diagnostics.length === 0
};
await writeFile(path.join(output, 'qa-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await browser.close();
process.stdout.write(`${JSON.stringify({ pass: summary.pass, matrix: matrix.length, diagnostics: diagnostics.length, interaction: { twoTapsGeometryNeutral: interaction.twoTapsGeometryNeutral, threeTapsCommitted: interaction.threeTapsCommitted, baselineRestored: interaction.baselineRestored, keyboardCommitted: interaction.keyboardCommitted, releaseCleared: interaction.releaseCleared, controlCommitted: interaction.controlCommitted, touchTargets: interaction.touchTargets }, blind, journal, readback: localReadback }, null, 2)}\n`);
if (!summary.pass) process.exitCode = 1;
