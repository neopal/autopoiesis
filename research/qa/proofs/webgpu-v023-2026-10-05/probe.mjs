import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'C:/Users/ASUS/autopoiesis';
const BASE = 'http://127.0.0.1:4237';
const proofDir = `${ROOT}/research/qa/proofs/webgpu-v023-2026-10-05`;
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/webgpu/v023/';
const workPath = '/works/webgpu-2026-10-05/';
const routes = { raw: `${rawPath}?preview=1&interaction=1`, canonical: workPath };

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

const diagnosticsFor = (page) => {
  const diagnostics = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
};

const waitRawReady = async (page) => {
  await page.waitForFunction(() => Boolean(window.__mutineWebGPUV023), null, { timeout: 15000 });
  await page.waitForTimeout(120);
};

const readRaw = async (page) => page.evaluate(() => {
  const canvas = document.querySelector('#membrane-field');
  const rect = canvas?.getBoundingClientRect();
  const state = window.__mutineWebGPUV023?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    ready: Boolean(window.__mutineWebGPUV023),
    canvasVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
    canvas: rect ? { width: rect.width, height: rect.height } : null,
    state
  };
});

const parentMetrics = async (page) => page.evaluate(() => {
  const iframe = document.querySelector('iframe');
  const title = document.querySelector('h1');
  const frame = iframe?.getBoundingClientRect();
  const heading = title?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeTop: frame?.top ?? null,
    titleTop: heading?.top ?? null,
    tableauFirst: Boolean(frame && heading && frame.top <= heading.top),
    title: title?.textContent?.trim() || ''
  };

});

for (const reducedMotion of [false, true]) {
  for (const [width, height] of viewports) {
    for (const kind of ['raw', 'canonical']) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      const diagnostics = diagnosticsFor(page);
      await page.goto(`${BASE}${routes[kind]}`, { waitUntil: 'domcontentloaded' });
      let metrics;
      if (kind === 'raw') {
        await waitRawReady(page);
        metrics = await readRaw(page);
        assert.equal(metrics.innerWidth, width, `raw innerWidth must equal target ${width}`);
        assert.ok(metrics.scrollWidth <= metrics.innerWidth, `raw overflow at ${width}x${height}`);
        assert.ok(metrics.canvasVisible, `raw canvas must be visible at ${width}x${height}`);
      } else {
        await page.locator('iframe').first().waitFor({ state: 'visible', timeout: 15000 });
        const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v023/'));
        assert.ok(frame, `canonical v023 iframe must load at ${width}x${height}`);
        await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV023), null, { timeout: 15000 });
        metrics = await parentMetrics(page);
        assert.equal(metrics.innerWidth, width, `canonical innerWidth must equal target ${width}`);
        assert.ok(metrics.scrollWidth <= metrics.innerWidth, `canonical overflow at ${width}x${height}`);
        assert.ok(metrics.tableauFirst, `canonical tableau must be first at ${width}x${height}`);
      }
      const imagePath = `${proofDir}/${kind}-${reducedMotion ? 'reduced' : 'normal'}-${width}x${height}.png`;
      await page.screenshot({ path: imagePath, fullPage: true });
      const image = await stat(imagePath);
      results.push({ kind, reducedMotion, width, height, metrics, diagnostics, screenshot: imagePath, screenshotBytes: image.size });
      await page.close();
    }
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await interactionPage.emulateMedia({ reducedMotion: 'no-preference' });
const interactionDiagnostics = diagnosticsFor(interactionPage);
await interactionPage.goto(`${BASE}${rawPath}?preview=1&interaction=1`, { waitUntil: 'domcontentloaded' });
await waitRawReady(interactionPage);
const canvas = interactionPage.locator('#membrane-field');
await canvas.focus();
const baseline = await readRaw(interactionPage);
await interactionPage.keyboard.press('A');
const afterA = await readRaw(interactionPage);
assert.equal(afterA.state.memory, baseline.state.memory, 'draft token must not write memory');
assert.notEqual(afterA.state.draft.join(''), baseline.state.draft.join(''), 'draft token must be visible in state');
await interactionPage.keyboard.press('Enter');
const afterIncomplete = await readRaw(interactionPage);
assert.equal(afterIncomplete.state.memory, 0, 'incomplete witness must not commit');
assert.equal(afterIncomplete.state.action, 'incomplete-witness');
await interactionPage.keyboard.press('C');
await interactionPage.keyboard.press('B');
await interactionPage.keyboard.press('Enter');
const afterSeal = await readRaw(interactionPage);
assert.equal(afterSeal.state.memory, 1, 'complete witness must commit one event');
assert.ok(afterSeal.state.openTriangles > 0, 'complete witness must omit real triangles');
assert.notEqual(afterSeal.state.signature, baseline.state.signature, 'seal must change membrane geometry');
await interactionPage.keyboard.press('Delete');
const afterDelete = await readRaw(interactionPage);
assert.equal(afterDelete.state.memory, 0, 'Delete must lift the latest witness');
assert.equal(afterDelete.state.signature, baseline.state.signature, 'Delete must restore the exact preceding membrane');
await interactionPage.getByRole('button', { name: 'Add token A' }).click();
await interactionPage.getByRole('button', { name: 'Add token C' }).click();
await interactionPage.getByRole('button', { name: 'Add token B' }).click();
await interactionPage.getByRole('button', { name: 'seal witness' }).click();
const afterButtons = await readRaw(interactionPage);
assert.equal(afterButtons.state.memory, 1, 'token buttons and seal must provide an equivalent path');
await interactionPage.getByRole('button', { name: 'release membrane' }).click();
const afterRelease = await readRaw(interactionPage);
assert.equal(afterRelease.state.memory, 0, 'release must clear memory');
const touchTargets = await interactionPage.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: rect.width, height: rect.height };
}));
assert.ok(touchTargets.every((target) => target.height >= 44), 'all interaction buttons must be at least 44px high');
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
results.push({ kind: 'interaction', reducedMotion: false, width: 390, height: 844, baseline, afterA, afterIncomplete, afterSeal, afterDelete, afterButtons, afterRelease, touchTargets, diagnostics: interactionDiagnostics });
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
await waitRawReady(blindPage);
const blind = await blindPage.evaluate(() => {
  const canvas = document.querySelector('#membrane-field');
  const rect = canvas.getBoundingClientRect();
  const hidden = ['.membrane-readout', '.membrane-status', '.membrane-controls'].every((selector) => getComputedStyle(document.querySelector(selector)).display === 'none');
  return { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, canvasVisible: rect.width > 0 && rect.height > 0, furnitureHidden: hidden, state: window.__mutineWebGPUV023.getState() };
});
assert.equal(blind.furnitureHidden, true, 'blind preview must hide editorial furniture');
assert.ok(blind.canvasVisible, 'blind preview must keep the artwork visible');
assert.ok(blind.state.openTriangles > 0, 'blind settled preview must show actual apertures');
assert.ok(blind.scrollWidth <= blind.innerWidth, 'blind preview must not overflow');
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: true });
results.push({ kind: 'blind', reducedMotion: true, width: 390, height: 844, blind, diagnostics: blindDiagnostics });
await blindPage.close();

for (const [kind, path, marker] of [['journal', '/journal/', 'The crowd keeps the unspoken.'], ['current', '/currents/webgpu/', 'WebGPU']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((expected) => document.body.innerText.includes(expected), marker, { timeout: 15000 });
  const evidence = await page.evaluate(({ marker: expected }) => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    marker: document.body.innerText.includes(expected),
    title: document.title
  }), { marker });
  assert.equal(evidence.marker, true, `${kind} must contain ${marker}`);
  assert.ok(evidence.scrollWidth <= evidence.innerWidth, `${kind} must not overflow 390px`);
  await page.screenshot({ path: `${proofDir}/${kind}-390x844.png`, fullPage: true });
  results.push({ kind, reducedMotion: false, width: 390, height: 844, evidence, diagnostics });
  await page.close();
}

await browser.close();
await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
const allRuns = results.filter((result) => result.kind === 'raw' || result.kind === 'canonical');
const diagnosticsCount = results.reduce((sum, result) => sum + Object.values(result.diagnostics || {}).reduce((inner, values) => inner + values.length, 0), 0);
const overflowCount = allRuns.filter((result) => result.metrics && result.metrics.scrollWidth > result.metrics.innerWidth).length;
const summary = {
  target: 'webgpu-v023',
  viewportRuns: `${allRuns.length}/${allRuns.length}`,
  requiredViewports: viewports.map(([width, height]) => `${width}x${height}`),
  normalAndReducedMotion: true,
  diagnosticsCount,
  overflowCount,
  interaction: 'partial A draft remained memory-neutral; incomplete seal remained at 0; A-C-B plus Enter committed 0→1 with omitted triangles; Delete restored exact baseline; equivalent token-button path committed; release →0',
  blindPreview: blind,
  touchTargets,
  screenshots: results.filter((result) => result.screenshot || ['interaction', 'blind', 'journal', 'current'].includes(result.kind)).length,
  unresolved: ['independent caption-free perceptual comparison', 'production readback', 'provider revision linkage']
};
await writeFile(`${proofDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
