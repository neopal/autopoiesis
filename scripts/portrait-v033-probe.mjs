import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = Number(process.env.MUTINE_PROBE_PORT ?? 57233);
const base = process.env.MUTINE_PROBE_BASE ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(root, process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/portrait-v033-2026-10-25');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/self-portrait/v033/?preview=1&interaction=1', canonical: '/works/portrait-2026-10-25/' };

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
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() }); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForRoute(page, routeName) {
  if (routeName === 'raw') {
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV033));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail] iframe');
  const handle = await page.locator('[data-catalog-work-detail] iframe').first().elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV033));
  return frame;
}

async function measure(page, frame, routeName, viewport, reducedMotion) {
  return page.evaluate(({ name, target, reduced }) => {
    const iframe = document.querySelector('[data-catalog-work-detail] iframe');
    const doc = name === 'raw' ? document : iframe?.contentDocument;
    const stage = doc?.querySelector('[data-reciprocal-absence]');
    const field = doc?.querySelector('#reciprocal-field');
    const heading = document.querySelector('h1, h2');
    const stageRect = stage?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    const state = name === 'raw' ? window.__mutinePortraitV033?.getState() : iframe?.contentWindow?.__mutinePortraitV033?.getState();
    return {
      routeName: name,
      targetViewport: target,
      reducedMotion: reduced,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauVisible: Boolean(stageRect && stageRect.width > 0 && stageRect.height > 0 && field?.getBoundingClientRect().width > 0),
      tableauTop: stageRect ? Number(stageRect.top.toFixed(2)) : null,
      headingTop: headingRect ? Number(headingRect.top.toFixed(2)) : null,
      tableauFirst: name === 'raw' || Boolean(stageRect && headingRect && stageRect.top < headingRect.top),
      zoneCount: state?.zones?.length ?? 0,
      memory: state?.memory?.length ?? -1
    };
  }, { name: routeName, target: viewport.join('x'), reduced: reducedMotion });
}

for (const reducedMotion of [false, true]) {
  for (const [routeName, route] of Object.entries(routes)) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
      const diag = diagnostics(page);
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      const frame = await waitForRoute(page, routeName);
      const evidence = await measure(page, frame, routeName, viewport, reducedMotion);
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
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV033));
  await page.evaluate(() => window.__mutinePortraitV033.release());
  const initial = await page.evaluate(() => window.__mutinePortraitV033.getState());
  const zone = page.locator('[data-zone="2"]');
  await zone.hover();
  const held = await page.evaluate(() => window.__mutinePortraitV033.getState());
  await page.mouse.move(5, 5);
  const withdrawn = await page.evaluate(() => window.__mutinePortraitV033.getState());
  await page.locator('[data-reciprocal-absence]').focus();
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutinePortraitV033.getState());
  await page.locator('[data-reciprocal-absence]').focus();
  await page.keyboard.press('ArrowRight');
  const keyboardHeld = await page.evaluate(() => window.__mutinePortraitV033.getState());
  await page.keyboard.press('Space');
  const keyboardWithdrawn = await page.evaluate(() => window.__mutinePortraitV033.getState());
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => window.__mutinePortraitV033.getState());
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, held, withdrawn, lifted, keyboardHeld, keyboardWithdrawn, released, buttons, diagnostics: diag };
}

async function runBlind() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/studies/self-portrait/v033/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV033));
  const evidence = await page.evaluate(() => {
    const state = window.__mutinePortraitV033.getState();
    const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const field = document.querySelector('#reciprocal-field');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0,
      zoneCount: state.zones.length,
      memory: state.memory.length,
      stampDisplay: display('.stage-stamp'),
      readoutDisplay: display('.field-readout'),
      controlsDisplay: display('.field-controls'),
      hintDisplay: display('.field-hint')
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
  if (path === '/journal/' || path.startsWith('/currents/') || path.startsWith('/works/')) await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

const interaction = await runInteraction();
const blind = await runBlind();
const journal = await runReadback('/journal/', '#journal-portrait-2026-10-25', 'readback-journal-390x844.png');
const current = await runReadback('/currents/self-portrait/', '[data-catalog-current="portrait"]', 'readback-current-390x844.png');
const work = await runReadback('/works/portrait-2026-10-25/', '[data-catalog-work-detail="portrait-2026-10-25"]', 'readback-work-390x844.png');
const registry = await runReadback('/studio/data/works.json', 'body', 'readback-registry-390x844.png');
const catalog = await runReadback('/studio/data/catalog-public.json', 'body', 'readback-public-catalog-390x844.png');
const favicon = await runReadback('/studio/favicon.svg', 'svg', 'readback-favicon-390x844.png');

const diagnosticsOk = (diag) => diag.consoleMessages.length === 0 && diag.pageErrors.length === 0 && diag.failedRequests.length === 0 && diag.badResponses.length === 0;
const widthOk = (e) => e.innerWidth === e.clientWidth && e.scrollWidth <= e.innerWidth;
const geometry = (state) => JSON.stringify({ mirror: state.mirror, zones: state.zones.map((zone) => [zone.y, zone.width, zone.height, zone.slant, zone.gap, zone.aperture, zone.drift, zone.rotation, zone.state]) });
const matrixFailures = matrix.filter(({ evidence, diagnostics: diag }) => !widthOk(evidence) || !evidence.tableauVisible || evidence.zoneCount !== 8 || (evidence.routeName === 'canonical' && !evidence.tableauFirst) || !diagnosticsOk(diag));
const interactionOk = interaction.initial.memory.length === 0
  && interaction.held.memory.length === 0
  && geometry(interaction.held) === geometry(interaction.initial)
  && interaction.withdrawn.memory.length === 1
  && interaction.withdrawn.memory[0].receiverIndex !== interaction.withdrawn.memory[0].seenIndex
  && interaction.withdrawn.zones.some((zone) => zone.state === 'answer')
  && interaction.withdrawn.zones.some((zone) => zone.state === 'echo')
  && geometry(interaction.lifted) === geometry(interaction.initial)
  && interaction.keyboardHeld.memory.length === 0
  && interaction.keyboardWithdrawn.memory.length === 1
  && interaction.released.memory.length === 0
  && interaction.buttons.every((button) => button.height >= 44)
  && diagnosticsOk(interaction.diagnostics);
const blindOk = blind.evidence.fieldVisible && blind.evidence.zoneCount === 8 && blind.evidence.memory === 4
  && blind.evidence.stampDisplay === 'none' && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none'
  && widthOk(blind.evidence) && diagnosticsOk(blind.diagnostics);
const readbacksOk = [journal, current, work].every(({ evidence, diagnostics: diag }) => evidence.marker && widthOk(evidence) && diagnosticsOk(diag));
const allDiagnosticsOk = matrix.every(({ diagnostics: diag }) => diagnosticsOk(diag)) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(blind.diagnostics) && diagnosticsOk(journal.diagnostics) && diagnosticsOk(current.diagnostics) && diagnosticsOk(work.diagnostics) && diagnosticsOk(registry.diagnostics) && diagnosticsOk(catalog.diagnostics) && diagnosticsOk(favicon.diagnostics);
const summary = { matrixRuns: matrix.length, matrixFailures, interaction, blind, journal, current, work, registry, catalog, favicon, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir };
await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ matrixRuns: matrix.length, matrixFailures: matrixFailures.length, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir }, null, 2));
await browser.close();
if (matrixFailures.length || !interactionOk || !blindOk || !readbacksOk || !allDiagnosticsOk) process.exitCode = 1;
