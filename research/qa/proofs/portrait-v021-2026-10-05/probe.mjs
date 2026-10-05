import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'C:/Users/ASUS/autopoiesis';
const BASE = 'http://127.0.0.1:4231';
const proofDir = `${ROOT}/research/qa/proofs/portrait-v021-2026-10-05`;
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/self-portrait/v021/';
const routes = { raw: `${rawPath}?preview=1&interaction=1`, canonical: '/works/portrait-2026-10-05/' };

const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const rootPath = resolve(ROOT);
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
    const candidate = resolve(rootPath, `.${pathname}`);
    if (!candidate.startsWith(rootPath)) throw new Error('path outside root');
    const info = await stat(candidate);
    const filePath = info.isDirectory() ? join(candidate, 'index.html') : candidate;
    const body = await readFile(normalize(filePath));
    response.writeHead(200, { 'content-type': `${mimeTypes[extname(filePath)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((resolveListen) => server.listen(4231, '127.0.0.1', resolveListen));

await mkdir(proofDir, { recursive: true });
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

async function waitRawReady(page) {
  await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function readRaw(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#blind-field');
    const canvas = field?.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      ready: window._p5Ready === true,
      canvasVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      canvas: rect ? { width: rect.width, height: rect.height } : null,
      state: window.__mutinePortraitV021?.getState?.() ?? null,
      hiddenFurniture: ['.field-readout', '.field-controls', '.field-hint'].every((selector) => getComputedStyle(document.querySelector(selector)).display === 'none')
    };
  });
}

async function readCanonical(page) {
  return page.evaluate(() => {
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
}

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
        const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/self-portrait/v021/'));
        assert.ok(frame, `canonical v021 iframe must load at ${width}x${height}`);
        await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
        metrics = await readCanonical(page);
      }
      assert.equal(metrics.innerWidth, metrics.clientWidth, `${kind} ${width}px must have a valid viewport`);
      assert.ok(metrics.scrollWidth <= metrics.innerWidth, `${kind} ${width}px must not overflow`);
      if (kind === 'raw') assert.equal(metrics.canvasVisible, true, 'raw artwork must remain visible');
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
const field = interactionPage.locator('#blind-field');
await field.focus();
const baseline = await readRaw(interactionPage);
await interactionPage.mouse.click(195, 420);
const afterTap = await readRaw(interactionPage);
assert.equal(afterTap.state.memory, baseline.state.memory, 'pointer tap must be refused');
await interactionPage.getByRole('button', { name: 'leave a blind side' }).click();
const afterControl = await readRaw(interactionPage);
assert.equal(afterControl.state.memory, 1, 'blind-side control must commit one departure');
await field.focus();
await interactionPage.keyboard.press('Enter');
const afterEnter = await readRaw(interactionPage);
assert.equal(afterEnter.state.memory, 2, 'Enter must commit a second departure');
await interactionPage.keyboard.press('Delete');
const afterDelete = await readRaw(interactionPage);
assert.equal(afterDelete.state.memory, 1, 'Delete must lift the latest departure');
assert.equal(afterDelete.state.signature, afterControl.state.signature, 'Delete must restore the exact preceding mobile');
await interactionPage.keyboard.press('R');
const afterRelease = await readRaw(interactionPage);
assert.equal(afterRelease.state.memory, 0, 'R must release attention');
await interactionPage.mouse.move(195, 420);
await interactionPage.mouse.move(395, 420);
const afterDepart = await readRaw(interactionPage);
assert.equal(afterDepart.state.memory, 1, 'approach then leaving the field must commit one departure');
const touchTargets = await interactionPage.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: rect.width, height: rect.height };
}));
assert.ok(touchTargets.every((target) => target.height >= 44), 'all interaction buttons must be at least 44px high');
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
results.push({ kind: 'interaction', reducedMotion: false, width: 390, height: 844, baseline, afterTap, afterControl, afterEnter, afterDelete, afterRelease, afterDepart, touchTargets, diagnostics: interactionDiagnostics });
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitRawReady(blindPage);
const blind = await readRaw(blindPage);
assert.equal(blind.hiddenFurniture, true, 'blind preview must hide editorial furniture');
assert.equal(blind.canvasVisible, true, 'blind preview must keep the WebGL field visible');
assert.equal(blind.state.memory, 4, 'reduced blind preview must settle at four bounded turns');
await blindPage.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: true });
results.push({ kind: 'blind', reducedMotion: true, width: 390, height: 844, blind, diagnostics: blindDiagnostics });
await blindPage.close();

for (const [kind, path, marker] of [['journal', '/journal/', 'The portrait keeps a blind side.'], ['current', '/currents/self-portrait/', 'The portrait keeps a blind side.']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate((expected) => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    marker: document.body.innerText.includes(expected),
    title: document.title
  }), marker);
  assert.equal(evidence.marker, true, `${kind} must contain the v021 title`);
  assert.ok(evidence.scrollWidth <= evidence.innerWidth, `${kind} must not overflow 390px`);
  await page.screenshot({ path: `${proofDir}/${kind}-390x844.png`, fullPage: true });
  results.push({ kind, width: 390, height: 844, evidence, diagnostics });
  await page.close();
}

const publicRecord = await fetch(`${BASE}/studio/data/catalog-public.json`).then((response) => response.json());
const publicMatches = publicRecord.works.works.filter((work) => work.id === 'portrait-2026-10-05');
assert.equal(publicMatches.length, 1, 'local public register must contain one v021 record');
assert.equal(publicMatches[0].source, undefined, 'public catalog must omit private source evidence');

await browser.close();
await new Promise((resolveClose) => server.close(resolveClose));
await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
const allRuns = results.filter((result) => result.kind === 'raw' || result.kind === 'canonical');
const diagnosticsCount = results.reduce((sum, result) => sum + Object.values(result.diagnostics || {}).reduce((inner, values) => inner + values.length, 0), 0);
const overflowCount = results.filter((result) => result.metrics?.scrollWidth > result.metrics?.innerWidth || result.evidence?.scrollWidth > result.evidence?.innerWidth || result.blind?.scrollWidth > result.blind?.innerWidth).length;
const summary = {
  target: 'portrait-v021',
  viewportRuns: `${allRuns.length}/${allRuns.length}`,
  requiredViewports: viewports.map(([width, height]) => `${width}x${height}`),
  normalAndReducedMotion: true,
  diagnosticsCount,
  overflowCount,
  interaction: 'pointer tap remained memory-neutral; control 0→1; Enter 1→2; Delete 2→1 exact restoration; R →0; approach/departure 0→1',
  blindPreview: blind,
  touchTargets,
  screenshots: results.filter((result) => result.screenshot || ['interaction', 'blind', 'journal', 'current'].includes(result.kind)).length,
  unresolved: ['independent caption-free perceptual comparison', 'production readback', 'provider revision linkage']
};
await writeFile(`${proofDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
