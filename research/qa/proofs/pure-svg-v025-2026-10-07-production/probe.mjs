import assert from 'node:assert/strict';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const BASE = 'https://autopoiesis-nine.vercel.app';
const ROOT = 'C:/Users/ASUS/autopoiesis';
const PROOF = `${ROOT}/research/qa/proofs/pure-svg-v025-2026-10-07-production`;
const VIEWPORTS = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v025/';
const routes = { raw: `${rawPath}?preview=1&interaction=1`, canonical: '/works/svg-2026-10-07/' };

await mkdir(PROOF, { recursive: true });
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

async function waitRaw(page) {
  await page.waitForSelector('#field path.boundary', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(100);
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

async function readCanonical(page) {
  await page.waitForSelector('iframe', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => Boolean(document.querySelector('iframe')?.contentDocument?.querySelector('#field path.boundary')), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/pure-svg/v025/'));
  assert.ok(frame, 'production canonical v025 iframe must load');
  await frame.waitForSelector('#field path.boundary', { state: 'attached', timeout: 15000 });
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
      assert.equal(metrics.innerWidth, width);
      assert.equal(metrics.innerWidth, metrics.clientWidth);
      assert.ok(metrics.scrollWidth <= metrics.innerWidth);
      if (kind === 'raw') {
        assert.equal(metrics.svgVisible, true);
        assert.equal(metrics.boundaryVisible, true);
        assert.equal(metrics.pathCount, 1);
      } else {
        assert.equal(metrics.tableauFirst, true);
        assert.match(metrics.title, /boundary/i);
      }
      const screenshot = `${PROOF}/${kind}-${reducedMotion ? 'reduced' : 'normal'}-${width}x${height}.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      results.push({ kind, reducedMotion, viewport: `${width}x${height}`, metrics, diagnostics, screenshot, screenshotBytes: (await stat(screenshot)).size });
      await page.close();
    }
  }
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.emulateMedia({ reducedMotion: 'no-preference' });
const interactionDiagnostics = diagnosticsFor(page);
await page.goto(`${BASE}${routes.raw}`, { waitUntil: 'domcontentloaded' });
await waitRaw(page);
const field = page.locator('#field');
await field.focus();
await page.keyboard.press('r');
const baseline = await readRaw(page);
await page.keyboard.press('2');
const armed = await readRaw(page);
assert.equal(armed.memory, 0);
assert.equal(armed.signature, baseline.signature);
await page.keyboard.press('Enter');
const committed = await readRaw(page);
assert.equal(committed.memory, 1);
assert.notEqual(committed.signature, baseline.signature);
assert.notEqual(committed.gapAt, baseline.gapAt);
await page.keyboard.press('Delete');
const lifted = await readRaw(page);
assert.equal(lifted.memory, 0);
assert.equal(lifted.signature, baseline.signature);
await page.keyboard.press('r');
const released = await readRaw(page);
assert.equal(released.memory, 0);
const stationRects = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-station]')].map((node) => [node.dataset.station, node.getBoundingClientRect().toJSON()])));
const station1 = stationRects['1'];
const station4 = stationRects['4'];
assert.ok(station1 && station4);
await page.mouse.move(station1.x + station1.width / 2, station1.y + station1.height / 2);
await page.mouse.down();
await page.mouse.move(station4.x + station4.width / 2, station4.y + station4.height / 2);
await page.mouse.up();
const pointerCommitted = await readRaw(page);
assert.equal(pointerCommitted.memory, 1);
assert.equal(pointerCommitted.interaction, 'rupture-transfer');
await page.keyboard.press('r');
await page.mouse.click(station1.x + station1.width / 2, station1.y + station1.height / 2);
const refused = await readRaw(page);
assert.equal(refused.memory, 0);
assert.equal(refused.interaction, 'same-station-refused');
await page.keyboard.press('r');
await page.getByRole('button', { name: 'draw a span' }).click();
const buttonCommitted = await readRaw(page);
assert.equal(buttonCommitted.memory, 1);
const touchTargets = await page.locator('button').evaluateAll((buttons) => buttons.map((button) => {
  const rect = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: rect.width, height: rect.height };
}));
assert.ok(touchTargets.every((target) => target.height >= 44));
const interactionScreenshot = `${PROOF}/interaction-390x844.png`;
await page.screenshot({ path: interactionScreenshot, fullPage: true });
results.push({ kind: 'interaction', viewport: '390x844', baseline, armed, committed, lifted, released, pointerCommitted, refused, buttonCommitted, touchTargets, diagnostics: interactionDiagnostics, screenshot: interactionScreenshot, screenshotBytes: (await stat(interactionScreenshot)).size });
await page.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await blindPage.emulateMedia({ reducedMotion: 'reduce' });
const blindDiagnostics = diagnosticsFor(blindPage);
await blindPage.goto(`${BASE}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
await waitRaw(blindPage);
const blind = await readRaw(blindPage);
assert.equal(blind.hiddenFurniture, true);
assert.equal(blind.svgVisible, true);
assert.equal(blind.boundaryVisible, true);
assert.equal(blind.memory, 3);
const blindScreenshot = `${PROOF}/blind-390x844.png`;
await blindPage.screenshot({ path: blindScreenshot, fullPage: true });
results.push({ kind: 'blind', viewport: '390x844', blind, diagnostics: blindDiagnostics, screenshot: blindScreenshot, screenshotBytes: (await stat(blindScreenshot)).size });
await blindPage.close();

for (const [kind, path, expected] of [['journal', '/journal/', 'The boundary keeps its gap.'], ['current', '/currents/pure-svg/', 'The boundary keeps its gap.'], ['work', '/works/svg-2026-10-07/', 'The boundary keeps its gap.']]) {
  const readPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = diagnosticsFor(readPage);
  await readPage.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await readPage.waitForFunction((title) => document.body.innerText.includes(title), expected, { timeout: 15000 });
  const evidence = await readPage.evaluate((title) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    containsTitle: document.body.innerText.includes(title),
    title: document.title,
    tableauFirst: Boolean(document.querySelector('iframe')) ? document.querySelector('iframe').getBoundingClientRect().top <= (document.querySelector('h1')?.getBoundingClientRect().top ?? Infinity) : null
  }), expected);
  assert.equal(evidence.containsTitle, true);
  assert.ok(evidence.scrollWidth <= evidence.innerWidth);
  if (kind === 'work') assert.equal(evidence.tableauFirst, true);
  const screenshot = `${PROOF}/${kind}-390x844.png`;
  await readPage.screenshot({ path: screenshot, fullPage: true });
  results.push({ kind, viewport: '390x844', evidence, diagnostics, screenshot, screenshotBytes: (await stat(screenshot)).size });
  await readPage.close();
}

const publicResponse = await fetch(`${BASE}/studio/data/works.json`);
assert.equal(publicResponse.status, 200);
const sourceRegister = await publicResponse.json();
const matches = sourceRegister.works.filter((work) => work.id === 'svg-2026-10-07');
assert.equal(matches.length, 1);
const publicResponse2 = await fetch(`${BASE}/studio/data/catalog-public.json`);
assert.equal(publicResponse2.status, 200);
const publicCatalog = await publicResponse2.json();
const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'svg-2026-10-07');
assert.equal(publicMatches.length, 1);
assert.equal(publicMatches[0].source, undefined);

await browser.close();
const allRuns = results.filter((result) => result.kind === 'raw' || result.kind === 'canonical');
const diagnosticsCount = results.reduce((sum, result) => sum + Object.values(result.diagnostics ?? {}).reduce((inner, values) => inner + values.length, 0), 0);
const overflowCount = results.filter((result) => result.metrics?.scrollWidth > result.metrics?.innerWidth || result.evidence?.scrollWidth > result.evidence?.innerWidth || result.blind?.scrollWidth > result.blind?.innerWidth).length;
const summary = {
  target: 'svg-v025-production',
  viewportRuns: `${allRuns.length}/${allRuns.length}`,
  requiredViewports: VIEWPORTS.map(([width, height]) => `${width}x${height}`),
  normalAndReducedMotion: true,
  diagnosticsCount,
  overflowCount,
  interaction: 'arming 0→0; Enter 0→1 and gap moved; Delete exact restore; R →0; pointer span 0→1; same station refused; button 0→1',
  blindPreview: blind,
  touchTargets,
  productionRoutes: ['works/svg-2026-10-07', 'studies/pure-svg/v025', 'journal', 'currents/pure-svg', 'studio/data/works.json', 'studio/data/catalog-public.json'],
  screenshots: results.length,
  unresolved: ['independent caption-free perceptual comparison', 'provider revision linkage']
};
await writeFile(`${PROOF}/results.json`, JSON.stringify(results, null, 2));
await writeFile(`${PROOF}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
