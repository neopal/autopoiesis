import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = Number(process.env.MUTINE_PROBE_PORT ?? 57180);
const base = process.env.MUTINE_PROBE_BASE ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(root, process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/portrait-v031-2026-10-23');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v031/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-23/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const matrix = [];

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
  });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForRoute(page, routeName) {
  if (routeName === 'raw') {
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV031));
    return null;
  }
  await page.waitForSelector('[data-catalog-work-detail] iframe');
  const iframe = page.locator('[data-catalog-work-detail] iframe').first();
  await iframe.waitFor({ state: 'visible' });
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV031));
  return frame;
}

async function evidenceFor(page, frame, routeName, viewport, reducedMotion) {
  return page.evaluate(({ routeName: name, target, reduced }) => {
    const root = document.documentElement;
    const iframe = document.querySelector('[data-catalog-work-detail] iframe');
    const stage = name === 'raw' ? document.querySelector('[data-checksum-membrane]') : iframe?.contentDocument?.querySelector('[data-checksum-membrane]');
    const canvas = stage?.querySelector('canvas');
    const rect = stage?.getBoundingClientRect();
    const heading = document.querySelector('h1, h2');
    const headingRect = heading?.getBoundingClientRect();
    const state = name === 'raw' ? window.__mutinePortraitV031?.getState() : iframe?.contentWindow?.__mutinePortraitV031?.getState();
    return {
      routeName: name,
      targetViewport: target,
      reducedMotion: reduced,
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      tableauVisible: Boolean(stage && rect && rect.width > 0 && rect.height > 0 && canvas && canvas.width > 0),
      tableauTop: rect ? Number(rect.top.toFixed(2)) : null,
      headingTop: headingRect ? Number(headingRect.top.toFixed(2)) : null,
      tableauFirst: name === 'raw' || (rect && headingRect && rect.top < headingRect.top),
      bandCount: state?.frame?.bands?.length ?? 0,
      memory: state?.frame?.memory?.length ?? -1,
      frameUrl: iframe?.src ?? null
    };
  }, { routeName, target: viewport.join('x'), reduced: reducedMotion });
}

for (const reducedMotion of [false, true]) {
  for (const [routeName, route] of Object.entries(routes)) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
      const diag = diagnostics(page);
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      const frame = await waitForRoute(page, routeName);
      const evidence = await evidenceFor(page, frame, routeName, viewport, reducedMotion);
      await page.screenshot({ path: resolve(proofDir, `matrix-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
      matrix.push({ evidence, diagnostics: diag });
      await page.close();
    }
  }
}

async function runInteraction() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV031));
  const stage = page.locator('[data-checksum-membrane]');
  await page.evaluate(() => window.__mutinePortraitV031.release());
  const initial = await page.evaluate(() => window.__mutinePortraitV031.getState());
  const canvas = page.locator('#checksum-canvas canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.27, box.y + box.height * 0.47);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  const weak = await page.evaluate(() => window.__mutinePortraitV031.getState());
  await page.mouse.down();
  await page.waitForTimeout(260);
  await page.mouse.up();
  const committed = await page.evaluate(() => window.__mutinePortraitV031.getState());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutinePortraitV031.getState());
  await stage.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutinePortraitV031.getState());
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => window.__mutinePortraitV031.getState());
  const buttons = await page.locator('.membrane-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, weak, committed, lifted, keyboard, released, buttons, diagnostics: diag };
}

async function runBlind() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/studies/self-portrait/v031/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV031));
  const evidence = await page.evaluate(() => {
    const stage = document.querySelector('[data-checksum-membrane]');
    const canvas = stage.querySelector('canvas');
    const state = window.__mutinePortraitV031.getState();
    const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: canvas.width > 0 && canvas.height > 0,
      bandCount: state.frame.bands.length,
      memory: state.frame.memory.length,
      headerDisplay: display('.stage-index'),
      readoutDisplay: display('.membrane-readout'),
      controlsDisplay: display('.membrane-controls'),
      hintDisplay: display('.membrane-hint')
    };
  });
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(path, marker, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(({ markerText }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    marker: Boolean(document.querySelector(markerText))
  }), { markerText: marker });
  if (!path.endsWith('.json') && path !== '/favicon.ico') await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

const interaction = await runInteraction();
const blind = await runBlind();
const journal = await runReadback('/journal/', '#journal-portrait-2026-10-23', 'readback-journal-390x844.png');
const current = await runReadback('/currents/self-portrait/', '[data-catalog-current="portrait"]', 'readback-current-390x844.png');
const work = await runReadback('/works/portrait-2026-10-23/', '[data-catalog-work-detail="portrait-2026-10-23"]', 'readback-work-390x844.png');
const registry = await runReadback('/studio/data/works.json', 'body', 'readback-registry-390x844.png');
const favicon = await runReadback('/favicon.ico', 'body', 'readback-favicon-390x844.png');

const diagnosticsOk = (diag) => diag.consoleMessages.length === 0 && diag.pageErrors.length === 0 && diag.failedRequests.length === 0 && diag.badResponses.length === 0;
const widthOk = (e) => e.innerWidth === e.clientWidth && e.scrollWidth <= e.innerWidth;
const matrixFailures = matrix.filter(({ evidence, diagnostics: diag }) => !widthOk(evidence) || !evidence.tableauVisible || evidence.bandCount !== 13 || (evidence.routeName === 'canonical' && !evidence.tableauFirst) || !diagnosticsOk(diag));
const sameGeometry = (a, b) => a.geometry === b.geometry;
const interactionOk = initialState(interaction).frame.memory.length === 0
  && interaction.weak.frame.memory.length === 0
  && sameGeometry(interaction.weak, interaction.initial)
  && interaction.committed.frame.memory.length === 1
  && interaction.committed.frame.bands.some((band) => band.state === 'opened')
  && interaction.committed.frame.bands.some((band) => band.state === 'inherited')
  && interaction.committed.frame.bands.some((band) => band.state === 'shed')
  && sameGeometry(interaction.lifted, interaction.initial)
  && interaction.keyboard.frame.memory.length === 1
  && interaction.released.frame.memory.length === 0
  && interaction.buttons.every((button) => button.height >= 44)
  && diagnosticsOk(interaction.diagnostics);
function initialState(value) { return value.initial; }
const blindOk = blind.evidence.fieldVisible && blind.evidence.bandCount === 13 && blind.evidence.memory === 4
  && blind.evidence.headerDisplay === 'none' && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none'
  && widthOk(blind.evidence) && diagnosticsOk(blind.diagnostics);
const readbacksOk = [journal, current, work].every(({ evidence, diagnostics: diag }) => evidence.marker && widthOk(evidence) && diagnosticsOk(diag));
const allDiagnosticsOk = matrix.every(({ diagnostics: diag }) => diagnosticsOk(diag)) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(blind.diagnostics) && diagnosticsOk(journal.diagnostics) && diagnosticsOk(current.diagnostics) && diagnosticsOk(work.diagnostics) && diagnosticsOk(registry.diagnostics) && diagnosticsOk(favicon.diagnostics);
const summary = { matrixRuns: matrix.length, matrixFailures, interaction, blind, journal, current, work, registry, favicon, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir };
await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ matrixRuns: matrix.length, matrixFailures: matrixFailures.length, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir }, null, 2));
await browser.close();
if (matrixFailures.length || !interactionOk || !blindOk || !readbacksOk || !allDiagnosticsOk) process.exitCode = 1;
