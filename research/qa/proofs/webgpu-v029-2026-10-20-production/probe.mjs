import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'C:/Users/ASUS/autopoiesis';
const BASE = 'https://autopoiesis-nine.vercel.app';
const PROOF = resolve(ROOT, 'research/qa/proofs/webgpu-v029-2026-10-20-production');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const raw = '/studies/webgpu/v029/?preview=1&static=1';
const canonical = '/works/webgpu-2026-10-20/';

await mkdir(PROOF, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function openPage(path, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const diagnostics = diagnosticsFor(page);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'commit', timeout: 15000 });
  await page.waitForTimeout(350);
  if (path.startsWith('/studies/')) {
    await page.waitForSelector('#pressure-field');
    await page.waitForFunction(() => window.__mutineReady === true, null, { timeout: 10000 });
  }
  else {
    await page.waitForSelector('.work-inspect__stage iframe');
    const tableau = page.frames().find((candidate) => candidate.url().includes('/studies/webgpu/v029/'));
    if (!tableau) throw new Error('canonical tableau frame did not attach');
    await tableau.waitForSelector('#pressure-field');
    await tableau.waitForFunction(() => window.__mutineReady === true, null, { timeout: 10000 });
  }
  return { page, response, diagnostics };
}

async function evidence(page, path, response, diagnostics) {
  const frame = path.startsWith('/studies/') ? page : page.frames().find((candidate) => candidate.url().includes('/studies/webgpu/v029/'));
  const data = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hasTitle: Boolean(document.querySelector('h1')),
    iframeLoaded: Boolean(document.querySelector('.work-inspect__stage iframe'))
  }));
  const artwork = await frame.evaluate(() => {
    const canvas = document.querySelector('#pressure-field');
    const readout = document.querySelector('.pressure-readout');
    const status = document.querySelector('.pressure-status');
    const controls = document.querySelector('.pressure-controls');
    return {
      ready: Boolean(window.__mutineReady),
      canvasVisible: Boolean(canvas && getComputedStyle(canvas).display !== 'none'),
      canvasWidth: canvas?.width ?? 0,
      canvasHeight: canvas?.height ?? 0,
      readoutDisplay: readout ? getComputedStyle(readout).display : null,
      statusDisplay: status ? getComputedStyle(status).display : null,
      controlsDisplay: controls ? getComputedStyle(controls).display : null,
      stage: document.querySelector('[data-stage]')?.textContent,
      memory: document.querySelector('[data-memory]')?.textContent,
      renderer: document.querySelector('[data-renderer]')?.textContent
    };
  });
  return { status: response?.status() ?? null, ...data, artwork, diagnostics };
}

for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    for (const [kind, path] of [['raw', raw], ['canonical', canonical]]) {
      const { page, response, diagnostics } = await openPage(path, viewport, reducedMotion);
      const item = await evidence(page, path, response, diagnostics);
      const filename = `${kind}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`;
      await page.screenshot({ path: resolve(PROOF, filename), fullPage: true });
      item.screenshot = filename;
      item.kind = kind;
      item.reducedMotion = reducedMotion;
      item.viewport = viewport.join('x');
      results.push(item);
      await page.close();
    }
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await interactionPage.emulateMedia({ reducedMotion: 'no-preference' });
const interactionDiagnostics = diagnosticsFor(interactionPage);
await interactionPage.goto(`${BASE}/studies/webgpu/v029/?preview=1&interaction=1`, { waitUntil: 'commit', timeout: 15000 });
  await interactionPage.waitForTimeout(350);
await interactionPage.waitForSelector('#pressure-field');
await interactionPage.waitForFunction(() => window.__mutineReady === true, null, { timeout: 10000 });
const interactionFrame = interactionPage;
const initial = await interactionFrame.evaluate(() => ({ ...window.__mutineProbe(), memoryText: document.querySelector('[data-memory]').textContent, status: document.querySelector('[data-status]').textContent }));
const box = await interactionFrame.locator('#pressure-field').boundingBox();
assert.ok(box);
await interactionPage.mouse.move(box.x + box.width * .18, box.y + box.height * .5);
await interactionPage.mouse.down();
await interactionPage.waitForTimeout(24);
await interactionPage.mouse.up();
const short = await interactionFrame.evaluate(() => ({ ...window.__mutineProbe(), memoryText: document.querySelector('[data-memory]').textContent, status: document.querySelector('[data-status]').textContent }));
assert.equal(short.memory, initial.memory);
assert.equal(short.signature, initial.signature);
await interactionPage.mouse.move(box.x + box.width * .14, box.y + box.height * .55);
await interactionPage.mouse.down();
await interactionPage.waitForTimeout(180);
await interactionPage.mouse.move(box.x + box.width * .84, box.y + box.height * .45, { steps: 4 });
await interactionPage.mouse.up();
await interactionPage.waitForTimeout(80);
const committed = await interactionFrame.evaluate(() => ({ ...window.__mutineProbe(), memoryText: document.querySelector('[data-memory]').textContent, status: document.querySelector('[data-status]').textContent }));
assert.notEqual(committed.signature, initial.signature);
assert.match(committed.memoryText, /1 compression/);
await interactionFrame.locator('[data-gesture="lift"]').click();
const lifted = await interactionFrame.evaluate(() => ({ ...window.__mutineProbe(), memoryText: document.querySelector('[data-memory]').textContent }));
assert.equal(lifted.signature, initial.signature);
assert.match(lifted.memoryText, /0 compressions/);
await interactionFrame.locator('#pressure-field').focus();
await interactionPage.keyboard.press('Enter');
const keyboardCommitted = await interactionFrame.evaluate(() => document.querySelector('[data-memory]').textContent);
await interactionPage.keyboard.press('Delete');
const keyboardLifted = await interactionFrame.evaluate(() => document.querySelector('[data-memory]').textContent);
assert.match(keyboardCommitted, /1 compression/);
assert.match(keyboardLifted, /0 compressions/);
await interactionPage.keyboard.press('Escape');
await interactionPage.screenshot({ path: resolve(PROOF, 'interaction-390x844-normal.png'), fullPage: true });
const touchTargets = await interactionFrame.evaluate(() => [...document.querySelectorAll('.pressure-controls button')].map((button) => ({ text: button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}/studies/webgpu/v029/?preview=1&static=1&blind=1`, { waitUntil: 'commit', timeout: 15000 });
  await blindPage.waitForTimeout(350);
await blindPage.waitForSelector('#pressure-field');
await blindPage.waitForFunction(() => window.__mutineReady === true, null, { timeout: 10000 });
const blind = await blindPage.evaluate(() => ({
  canvasVisible: getComputedStyle(document.querySelector('#pressure-field')).display !== 'none',
  readoutDisplay: getComputedStyle(document.querySelector('.pressure-readout')).display,
  statusDisplay: getComputedStyle(document.querySelector('.pressure-status')).display,
  controlsDisplay: getComputedStyle(document.querySelector('.pressure-controls')).display,
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  memory: document.querySelector('[data-memory]').textContent
}));
assert.equal(blind.canvasVisible, true);
assert.equal(blind.readoutDisplay, 'none');
assert.equal(blind.controlsDisplay, 'none');
assert.ok(blind.scrollWidth <= blind.innerWidth);
await blindPage.screenshot({ path: resolve(PROOF, 'blind-390x844-reduced.png'), fullPage: true });
await blindPage.close();

const readback = [];
for (const check of [
  ['journal', '/journal/', '#journal-webgpu-2026-10-20'],
  ['current', '/currents/webgpu/', '[data-catalog-current="webgpu"]'],
  ['canonical', canonical, '.work-inspect__stage iframe'],
  ['works-json', '/studio/data/works.json', null],
  ['public-json', '/studio/data/catalog-public.json', null],
  ['favicon', '/studio/favicon.svg', null]
]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = diagnosticsFor(page);
  const response = await page.goto(`${BASE}${check[1]}`, { waitUntil: 'commit', timeout: 15000 });
  await page.waitForTimeout(350);
  if (check[2]) await page.waitForSelector(check[2]);
  const body = await page.locator('body').textContent().catch(() => '');
  const json = (check[1].endsWith('.json')) ? JSON.parse(body || '{}') : null;
  const text = body || '';
  const item = {
    name: check[0],
    status: response?.status() ?? null,
    hasTarget: check[0] === 'works-json' ? json.works.some((work) => work.id === 'webgpu-2026-10-20') : check[0] === 'public-json' ? json.works.works.some((work) => work.id === 'webgpu-2026-10-20') : text.includes('The archive contracts around a missed signal.'),
    sourceOmitted: check[0] === 'public-json' ? !json.works.works.find((work) => work.id === 'webgpu-2026-10-20')?.source : null,
    diagnostics,
    innerWidth: await page.evaluate(() => window.innerWidth),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth)
  };
  if (check[0] !== 'works-json' && check[0] !== 'public-json' && check[0] !== 'favicon') await page.screenshot({ path: resolve(PROOF, `${check[0]}-390x844-reduced.png`), fullPage: true });
  readback.push(item);
  await page.close();
}

const allDiagnostics = [...results.map((item) => item.diagnostics), interactionDiagnostics, blindDiagnostics, ...readback.map((item) => item.diagnostics)];
const diagnosticCount = allDiagnostics.reduce((sum, item) => sum + item.console.length + item.pageErrors.length + item.requestFailures.length + item.badResponses.length, 0);
const matrixFailures = results.filter((item) => item.status !== 200 || item.innerWidth !== Number(item.viewport.split('x')[0]) || item.scrollWidth > item.innerWidth || !item.artwork.ready || !item.artwork.canvasVisible || item.diagnostics.console.length || item.diagnostics.pageErrors.length || item.diagnostics.requestFailures.length || item.diagnostics.badResponses.length);
const screenshotCount = [...results, interactionPage, blindPage].length;
const result = {
  target: 'webgpu v029 / 2026-10-20',
  base: BASE,
  matrixRuns: results.length,
  matrixFailures,
  diagnosticCount,
  screenshotCount,
  interaction: { initial, short, committed, lifted, keyboardCommitted, keyboardLifted, touchTargets, diagnostics: interactionDiagnostics },
  blind: { evidence: blind, diagnostics: blindDiagnostics },
  readback,
  status: matrixFailures.length === 0 && diagnosticCount === 0 ? 'passed' : 'failed'
};
await writeFile(resolve(PROOF, 'results.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, matrixRuns: result.matrixRuns, matrixFailures: result.matrixFailures.length, diagnosticCount: result.diagnosticCount, screenshotCount: result.screenshotCount, interaction: result.interaction, blind: result.blind.evidence, readback: result.readback }, null, 2));
await browser.close();
if (result.status !== 'passed') process.exitCode = 1;
