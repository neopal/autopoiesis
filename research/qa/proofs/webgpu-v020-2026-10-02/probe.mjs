import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'C:/Users/ASUS/autopoiesis';
const BASE = 'http://127.0.0.1:4198';
const proofDir = `${ROOT}/research/qa/proofs/webgpu-v020-2026-10-02`;
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/webgpu/v020/';
const workPath = '/works/webgpu-2026-10-02/';
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
  await page.waitForFunction(() => window.__MUTINE_READY__ === true, null, { timeout: 15000 });
  await page.waitForTimeout(120);
};

const readRaw = async (page) => page.evaluate(() => {
  const canvas = document.querySelector('#field');
  const rect = canvas?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    ready: window.__MUTINE_READY__ === true,
    gpuReady: window.__MUTINE_GPU_READY__ === true,
    canvasVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
    canvas: rect ? { width: rect.width, height: rect.height } : null,
    memory: window.__MUTINE_STATE__?.frame.memory.length ?? -1,
    signature: window.__MUTINE_STATE__?.signature ?? null,
    stage: window.__MUTINE_STATE__?.frame.stage ?? -1,
    binder: window.__MUTINE_STATE__?.frame.sheet.binder ?? -1
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
      await page.goto(`${BASE}${routes[kind]}`, { waitUntil: 'networkidle' });
      let metrics;
      if (kind === 'raw') {
        await waitRawReady(page);
        metrics = await readRaw(page);
      } else {
        await page.locator('iframe').first().waitFor({ state: 'visible', timeout: 15000 });
        const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v020/'));
        assert.ok(frame, `canonical v020 iframe must load at ${width}x${height}`);
        await frame.waitForFunction(() => window.__MUTINE_READY__ === true, null, { timeout: 15000 });
        metrics = await parentMetrics(page);
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
await interactionPage.goto(`${BASE}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
await waitRawReady(interactionPage);
const canvas = interactionPage.locator('#field');
await canvas.focus();
const baseline = await readRaw(interactionPage);
await interactionPage.mouse.move(195, 420);
await interactionPage.mouse.wheel(0, 140);
const afterWheel = await readRaw(interactionPage);
assert.equal(afterWheel.memory, baseline.memory, 'wheel selection must not write memory');
await interactionPage.mouse.click(195, 420);
const afterTap = await readRaw(interactionPage);
assert.equal(afterTap.memory, baseline.memory, 'pointer tap must be refused');
await interactionPage.getByRole('button', { name: 'pulse the sheet' }).click();
const afterPulse = await readRaw(interactionPage);
assert.equal(afterPulse.memory, 1, 'pulse control must commit one event');
await canvas.focus();
await interactionPage.keyboard.press('Enter');
const afterEnter = await readRaw(interactionPage);
assert.equal(afterEnter.memory, 2, 'Enter must commit a second event');
await interactionPage.keyboard.press('Delete');
const afterDelete = await readRaw(interactionPage);
assert.equal(afterDelete.memory, 1, 'Delete must lift the latest event');
assert.equal(afterDelete.signature, afterPulse.signature, 'Delete must restore the exact preceding sheet');
await interactionPage.keyboard.press('Escape');
const afterRelease = await readRaw(interactionPage);
assert.equal(afterRelease.memory, 0, 'Escape must release the sheet');
const touchTargets = await interactionPage.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: rect.width, height: rect.height };
}));
assert.ok(touchTargets.every((target) => target.height >= 44), 'all interaction buttons must be at least 44px high');
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
results.push({ kind: 'interaction', reducedMotion: true, width: 390, height: 844, baseline, afterWheel, afterTap, afterPulse, afterEnter, afterDelete, afterRelease, touchTargets, diagnostics: interactionDiagnostics });
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitRawReady(blindPage);
const blind = await blindPage.evaluate(() => {
  const canvas = document.querySelector('#field');
  const rect = canvas.getBoundingClientRect();
  const hidden = [...document.querySelectorAll('.crease-readout, .crease-status, .crease-controls')].every((node) => getComputedStyle(node).display === 'none');
  return { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, canvasVisible: rect.width > 0 && rect.height > 0, furnitureHidden: hidden, memory: window.__MUTINE_STATE__.frame.memory.length };
});
assert.equal(blind.furnitureHidden, true, 'blind preview must hide editorial furniture');
assert.ok(blind.canvasVisible, 'blind preview must keep the artwork visible');
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: true });
results.push({ kind: 'blind', reducedMotion: true, width: 390, height: 844, blind, diagnostics: blindDiagnostics });
await blindPage.close();

for (const [kind, path, marker] of [['journal', '/journal/', 'The mass stores a crease.'], ['current', '/currents/webgpu/', 'WebGPU']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(({ marker: expected }) => ({
    innerWidth: innerWidth,
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
const overflowCount = allRuns.filter((result) => {
  const metrics = result.metrics;
  return metrics && metrics.scrollWidth > metrics.innerWidth;
}).length;
const summary = {
  target: 'webgpu-v020',
  viewportRuns: `${allRuns.length}/${allRuns.length}`,
  requiredViewports: viewports.map(([width, height]) => `${width}x${height}`),
  normalAndReducedMotion: true,
  diagnosticsCount,
  overflowCount,
  interaction: 'wheel selection remained memory-neutral; pointer tap remained memory-neutral; pulse 0→1; Enter 1→2; Delete 2→1 exact restoration; Escape →0',
  blindPreview: blind,
  touchTargets,
  screenshots: results.filter((result) => result.screenshot || ['interaction', 'blind', 'journal', 'current'].includes(result.kind)).length,
  unresolved: ['independent caption-free perceptual comparison', 'production readback', 'provider revision linkage']
};
await writeFile(`${proofDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
