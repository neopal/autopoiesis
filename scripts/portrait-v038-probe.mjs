import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = Number(process.env.MUTINE_PROBE_PORT ?? 4368);
const base = process.env.MUTINE_PROBE_BASE ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(root, process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/portrait-v038-2026-10-31');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v038/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-31/'
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
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() }); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForRoute(page, routeName) {
  if (routeName === 'raw') {
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV038));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail] iframe');
  const handle = await page.locator('[data-catalog-work-detail] iframe').first().elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV038));
  return frame;
}

async function measure(page, frame, routeName, viewport, reducedMotion) {
  const shell = await page.evaluate(({ name, target, reduced }) => {
    const iframe = document.querySelector('[data-catalog-work-detail] iframe');
    const heading = document.querySelector('h1, h2');
    const stage = name === 'raw' ? document.querySelector('[data-syntax-stage]') : iframe?.getBoundingClientRect();
    const rect = stage?.getBoundingClientRect?.() ?? stage;
    const headingRect = heading?.getBoundingClientRect();
    return {
      routeName: name,
      targetViewport: target,
      reducedMotion: reduced,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      shellVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
      tableauFirst: name === 'raw' || Boolean(rect && headingRect && rect.top < headingRect.top)
    };
  }, { name: routeName, target: viewport.join('x'), reduced: reducedMotion });
  const tableau = await frame.evaluate(() => {
    const stage = document.querySelector('[data-syntax-stage]');
    const svg = document.querySelector('[data-syntax-svg]');
    const state = window.__mutinePortraitV038?.getState();
    const rect = stage?.getBoundingClientRect();
    const svgRect = svg?.getBoundingClientRect();
    return {
      tableauVisible: Boolean(rect && rect.width > 0 && rect.height > 0 && svgRect && svgRect.width > 0 && svgRect.height > 0),
      agentCount: document.querySelectorAll('.syntax-agent').length,
      revision: state?.revision ?? -1,
      memory: state?.memory?.length ?? -1,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  return { shell, tableau };
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
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV038));
  const initial = await page.evaluate(() => ({ state: window.__mutinePortraitV038.getState(), structure: window.__mutinePortraitV038.structureSignature(), pose: window.__mutinePortraitV038.poseSignature() }));
  await page.locator('.syntax-agent').nth(4).hover();
  const offered = await page.evaluate(() => ({ state: window.__mutinePortraitV038.getState(), structure: window.__mutinePortraitV038.structureSignature(), pose: window.__mutinePortraitV038.poseSignature() }));
  await page.locator('[data-action="depart"]').click();
  const departed = await page.evaluate(() => ({ state: window.__mutinePortraitV038.getState(), structure: window.__mutinePortraitV038.structureSignature() }));
  await page.locator('[data-action="lift"]').click();
  const lifted = await page.evaluate(() => ({ state: window.__mutinePortraitV038.getState(), structure: window.__mutinePortraitV038.structureSignature() }));
  await page.locator('[data-action="release"]').click();
  await page.locator('[data-syntax-stage]').focus();
  await page.keyboard.press('ArrowRight');
  const keyboardGazing = await page.evaluate(() => window.__mutinePortraitV038.getState());
  await page.keyboard.press('Enter');
  const keyboardDeparted = await page.evaluate(() => window.__mutinePortraitV038.getState());
  await page.keyboard.press('Delete');
  const keyboardLifted = await page.evaluate(() => window.__mutinePortraitV038.getState());
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => window.__mutinePortraitV038.getState());
  const buttons = await page.locator('.syntax-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, offered, departed, lifted, keyboardGazing, keyboardDeparted, keyboardLifted, released, buttons, diagnostics: diag };
}

async function runBlind() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/studies/self-portrait/v038/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV038));
  const evidence = await page.evaluate(() => {
    const state = window.__mutinePortraitV038.getState();
    const visibility = (selector) => getComputedStyle(document.querySelector(selector)).visibility;
    const stage = document.querySelector('[data-syntax-stage]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stageVisible: stage.getBoundingClientRect().width > 0 && stage.getBoundingClientRect().height > 0,
      agentCount: document.querySelectorAll('.syntax-agent').length,
      revision: state.revision,
      memory: state.memory.length,
      readoutVisibility: visibility('.syntax-readout'),
      controlsVisibility: visibility('.syntax-controls'),
      hintVisibility: visibility('.syntax-hint')
    };
  });
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(path, selector, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(({ targetSelector }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    marker: Boolean(document.querySelector(targetSelector)),
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null
  }), { targetSelector: selector });
  if (path === '/journal/' || path.startsWith('/currents/') || path.startsWith('/works/')) await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

const interaction = await runInteraction();
const blind = await runBlind();
const journal = await runReadback('/journal/', '#journal-portrait-2026-10-31', 'readback-journal-390x844.png');
const current = await runReadback('/currents/self-portrait/', '[data-catalog-current="portrait"]', 'readback-current-390x844.png');
const work = await runReadback('/works/portrait-2026-10-31/', '[data-catalog-work-detail="portrait-2026-10-31"]', 'readback-work-390x844.png');
const registry = await runReadback('/studio/data/works.json', 'body', 'readback-registry-390x844.png');
const catalog = await runReadback('/studio/data/catalog-public.json', 'body', 'readback-public-catalog-390x844.png');
const favicon = await runReadback('/studio/favicon.svg', 'svg', 'readback-favicon-390x844.png');

const diagnosticsOk = (diag) => diag.consoleMessages.length === 0 && diag.pageErrors.length === 0 && diag.failedRequests.length === 0 && diag.badResponses.length === 0;
const widthOk = (e) => e.innerWidth === e.clientWidth && e.scrollWidth <= e.innerWidth;
const matrixFailures = matrix.filter(({ evidence, diagnostics: diag }) => !widthOk(evidence.shell) || !widthOk(evidence.tableau) || !evidence.shell.shellVisible || !evidence.tableau.tableauVisible || evidence.tableau.agentCount !== 13 || !evidence.shell.tableauFirst || !diagnosticsOk(diag));
const interactionOk = interaction.initial.state.memory.length === 0
  && interaction.offered.state.memory.length === 0
  && interaction.offered.structure === interaction.initial.structure
  && interaction.offered.pose !== interaction.initial.pose
  && interaction.departed.state.memory.length === 1
  && interaction.departed.structure !== interaction.initial.structure
  && interaction.lifted.structure === interaction.initial.structure
  && interaction.keyboardGazing.memory.length === 0
  && interaction.keyboardGazing.lastGaze?.index === 7
  && interaction.keyboardDeparted.memory.length === 1
  && interaction.keyboardLifted.memory.length === 0
  && interaction.released.memory.length === 0
  && interaction.buttons.every((button) => button.height >= 44)
  && diagnosticsOk(interaction.diagnostics);
const blindOk = blind.evidence.stageVisible && blind.evidence.agentCount === 13 && blind.evidence.memory === 4
  && blind.evidence.readoutVisibility === 'hidden' && blind.evidence.controlsVisibility === 'hidden' && blind.evidence.hintVisibility === 'hidden'
  && widthOk(blind.evidence) && diagnosticsOk(blind.diagnostics);
const readbacksOk = [journal, current, work].every(({ evidence, diagnostics: diag }) => evidence.marker && widthOk(evidence) && diagnosticsOk(diag));
const allDiagnosticsOk = matrix.every(({ diagnostics: diag }) => diagnosticsOk(diag)) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(blind.diagnostics) && diagnosticsOk(journal.diagnostics) && diagnosticsOk(current.diagnostics) && diagnosticsOk(work.diagnostics) && diagnosticsOk(registry.diagnostics) && diagnosticsOk(catalog.diagnostics) && diagnosticsOk(favicon.diagnostics);
const summary = { matrixRuns: matrix.length, matrixFailures, interaction, blind, journal, current, work, registry, catalog, favicon, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir };
await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ matrixRuns: matrix.length, matrixFailures: matrixFailures.length, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir }, null, 2));
await browser.close();
if (matrixFailures.length || !interactionOk || !blindOk || !readbacksOk || !allDiagnosticsOk) process.exitCode = 1;
