import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const PORT = 4247;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = 'C:/Users/ASUS/autopoiesis';
const PROOF = `${ROOT}/research/qa/proofs/pure-svg-v025-2026-10-07`;
const VIEWPORTS = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v025/';
const routes = {
  raw: `${rawPath}?preview=1&interaction=1`,
  canonical: '/works/svg-2026-10-07/'
};

await mkdir(PROOF, { recursive: true });
const rootPath = resolve(ROOT);
const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
    const candidate = resolve(rootPath, `.${normalize(pathname)}`);
    if (!candidate.startsWith(rootPath)) throw new Error('path outside root');
    const info = await stat(candidate);
    const filePath = info.isDirectory() ? join(candidate, 'index.html') : candidate;
    const body = await import('node:fs/promises').then(({ readFile }) => readFile(filePath));
    response.writeHead(200, { 'content-type': `${mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((resolveListen) => server.listen(PORT, '127.0.0.1', resolveListen));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function readRaw(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#field');
    const boundary = field?.querySelector('path.boundary');
    const rect = field?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svgVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      boundaryVisible: Boolean(boundary && getComputedStyle(boundary).display !== 'none' && boundary.getAttribute('d')),
      pathCount: field?.querySelectorAll('path.boundary').length ?? 0,
      memory: Number(field?.dataset.memory ?? -1),
      gapAt: Number(field?.dataset.gapAt ?? -1),
      signature: field?.dataset.signature ?? '',
      interaction: field?.dataset.interaction ?? '',
      hiddenFurniture: ['.field-readout', '.field-controls', '.svg-labels', '.centre-label', '.station-mark'].every((selector) => {
        const node = document.querySelector(selector);
        return !node || getComputedStyle(node).display === 'none';
      })
    };
  });
}

async function waitRaw(page) {
  await page.waitForSelector('#field path.boundary', { state: 'attached', timeout: 10000 });
  await page.waitForTimeout(80);
}

async function readCanonical(page) {
  await page.waitForSelector('iframe', { state: 'visible', timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/pure-svg/v025/'));
  assert.ok(frame, 'canonical v025 iframe must load');
  await frame.waitForSelector('#field path.boundary', { state: 'attached', timeout: 10000 });
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const heading = document.querySelector('h1');
    const frameRect = iframe?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: frameRect?.top ?? null,
      headingTop: headingRect?.top ?? null,
      tableauFirst: Boolean(frameRect && headingRect && frameRect.top <= headingRect.top),
      title: heading?.textContent?.trim() ?? '',
      mountReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    };
  });
}

for (const reducedMotion of [false, true]) {
  for (const [width, height] of VIEWPORTS) {
    for (const kind of ['raw', 'canonical']) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      const diagnostics = diagnosticsFor(page);
      await page.goto(`${BASE}${routes[kind]}`, { waitUntil: 'domcontentloaded' });
      const metrics = kind === 'raw' ? (await waitRaw(page), await readRaw(page)) : await readCanonical(page);
      assert.equal(metrics.innerWidth, width, `${kind} ${width}px probe must be true emulation`);
      assert.equal(metrics.innerWidth, metrics.clientWidth, `${kind} ${width}px must have no scrollbar`);
      assert.ok(metrics.scrollWidth <= metrics.innerWidth, `${kind} ${width}px must not overflow`);
      if (kind === 'raw') {
        assert.equal(metrics.svgVisible, true, 'raw SVG must be visible');
        assert.equal(metrics.boundaryVisible, true, 'raw contour must be visible');
        assert.equal(metrics.pathCount, 1, 'raw tableau must keep one boundary path');
      } else {
        assert.equal(metrics.tableauFirst, true, 'canonical tableau must precede prose');
        assert.match(metrics.title, /boundary/i);
      }
      const screenshot = `${PROOF}/${kind}-${reducedMotion ? 'reduced' : 'normal'}-${width}x${height}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ kind, reducedMotion, viewport: `${width}x${height}`, metrics, diagnostics, screenshot, screenshotBytes: (await stat(screenshot)).size });
      await page.close();
    }
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await interactionPage.emulateMedia({ reducedMotion: 'no-preference' });
const interactionDiagnostics = diagnosticsFor(interactionPage);
await interactionPage.goto(`${BASE}${routes.raw}`, { waitUntil: 'domcontentloaded' });
await waitRaw(interactionPage);
const field = interactionPage.locator('#field');
await field.focus();
await interactionPage.keyboard.press('r');
const baseline = await readRaw(interactionPage);
await interactionPage.keyboard.press('2');
const armed = await readRaw(interactionPage);
assert.equal(armed.memory, 0, 'arming must not write memory');
assert.equal(armed.signature, baseline.signature, 'arming must preserve geometry');
await interactionPage.keyboard.press('Enter');
const committed = await readRaw(interactionPage);
assert.equal(committed.memory, 1, 'Enter must commit one transfer');
assert.notEqual(committed.signature, baseline.signature, 'commit must change contour geometry');
assert.notEqual(committed.gapAt, baseline.gapAt, 'commit must move the rupture');
await interactionPage.keyboard.press('Delete');
const lifted = await readRaw(interactionPage);
assert.equal(lifted.memory, 0, 'Delete must lift latest transfer');
assert.equal(lifted.signature, baseline.signature, 'Delete must restore exact baseline');
await interactionPage.keyboard.press('r');
const released = await readRaw(interactionPage);
assert.equal(released.memory, 0, 'R must release memory');

const station1 = await interactionPage.locator('[data-station="1"]').boundingBox();
const station4 = await interactionPage.locator('[data-station="4"]').boundingBox();
assert.ok(station1 && station4, 'interactive station markers must be measurable');
await interactionPage.mouse.move(station1.x + station1.width / 2, station1.y + station1.height / 2);
await interactionPage.mouse.down();
await interactionPage.mouse.move(station4.x + station4.width / 2, station4.y + station4.height / 2);
await interactionPage.mouse.up();
const pointerCommitted = await readRaw(interactionPage);
assert.equal(pointerCommitted.memory, 1, 'continuous pointer span must commit');
assert.equal(pointerCommitted.interaction, 'rupture-transfer', 'pointer span must expose the causal interaction');
await interactionPage.keyboard.press('r');
await interactionPage.mouse.click(station1.x + station1.width / 2, station1.y + station1.height / 2);
const refused = await readRaw(interactionPage);
assert.equal(refused.memory, 0, 'same-station span must be refused');
assert.equal(refused.interaction, 'same-station-refused', 'same-station refusal must be explicit');
await interactionPage.keyboard.press('r');
await interactionPage.getByRole('button', { name: 'draw a span' }).click();
const buttonCommitted = await readRaw(interactionPage);
assert.equal(buttonCommitted.memory, 1, 'button must commit one transfer');
const touchTargets = await interactionPage.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: rect.width, height: rect.height };
}));
assert.ok(touchTargets.every((target) => target.height >= 44), 'all interaction buttons must be at least 44px high');
const interactionScreenshot = `${PROOF}/interaction-390x844.png`;
await interactionPage.screenshot({ path: interactionScreenshot, fullPage: true });
results.push({ kind: 'interaction', viewport: '390x844', baseline, armed, committed, lifted, released, pointerCommitted, refused, buttonCommitted, touchTargets, diagnostics: interactionDiagnostics, screenshot: interactionScreenshot, screenshotBytes: (await stat(interactionScreenshot)).size });
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
await waitRaw(blindPage);
const blind = await readRaw(blindPage);
assert.equal(blind.hiddenFurniture, true, 'blind preview must hide stations and editorial furniture');
assert.equal(blind.svgVisible, true, 'blind preview must keep SVG visible');
assert.equal(blind.boundaryVisible, true, 'blind preview must keep the contour visible');
assert.equal(blind.memory, 3, 'reduced blind preview must settle at three bounded transfers');
const blindScreenshot = `${PROOF}/blind-390x844.png`;
await blindPage.screenshot({ path: blindScreenshot, fullPage: true });
results.push({ kind: 'blind', viewport: '390x844', blind, diagnostics: blindDiagnostics, screenshot: blindScreenshot, screenshotBytes: (await stat(blindScreenshot)).size });
await blindPage.close();

for (const [kind, path, expected] of [['journal', '/journal/', 'The boundary keeps its gap.'], ['current', '/currents/pure-svg/', 'The boundary keeps its gap.']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = diagnosticsFor(page);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  const evidence = await page.evaluate((title) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    containsTitle: document.body.innerText.includes(title),
    title: document.title
  }), expected);
  assert.equal(evidence.containsTitle, true, `${kind} must contain the v025 title`);
  assert.ok(evidence.scrollWidth <= evidence.innerWidth, `${kind} must not overflow`);
  const screenshot = `${PROOF}/${kind}-390x844.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ kind, viewport: '390x844', evidence, diagnostics, screenshot, screenshotBytes: (await stat(screenshot)).size });
  await page.close();
}

const publicResponse = await fetch(`${BASE}/studio/data/catalog-public.json`);
assert.equal(publicResponse.status, 200);
const publicCatalog = await publicResponse.json();
const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'svg-2026-10-07');
assert.equal(publicMatches.length, 1, 'public catalog must contain one v025 record');
assert.equal(publicMatches[0].source, undefined, 'public catalog must omit private source evidence');

await browser.close();
await new Promise((resolveClose) => server.close(resolveClose));
const allRuns = results.filter((result) => result.kind === 'raw' || result.kind === 'canonical');
const diagnosticsCount = results.reduce((sum, result) => sum + Object.values(result.diagnostics ?? {}).reduce((inner, values) => inner + values.length, 0), 0);
const overflowCount = results.filter((result) => result.metrics?.scrollWidth > result.metrics?.innerWidth || result.evidence?.scrollWidth > result.evidence?.innerWidth || result.blind?.scrollWidth > result.blind?.innerWidth).length;
const summary = {
  target: 'svg-v025',
  viewportRuns: `${allRuns.length}/${allRuns.length}`,
  requiredViewports: VIEWPORTS.map(([width, height]) => `${width}x${height}`),
  normalAndReducedMotion: true,
  diagnosticsCount,
  overflowCount,
  interaction: 'arming 0→0; Enter 0→1 and gap moved; Delete exact restore; R →0; pointer span 0→1; same station refused; button 0→1',
  blindPreview: blind,
  touchTargets,
  screenshots: results.length,
  unresolved: ['independent caption-free perceptual comparison', 'production readback', 'provider revision linkage']
};
await writeFile(`${PROOF}/results.json`, JSON.stringify(results, null, 2));
await writeFile(`${PROOF}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
