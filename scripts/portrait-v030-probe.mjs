import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = 4280;
const base = `http://127.0.0.1:${port}`;
const proofDir = resolve(root, 'research/qa/proofs/portrait-v030-2026-10-22');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/self-portrait/v030/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-10-22/'
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
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV030));
    return null;
  }
  await page.waitForSelector('[data-catalog-work-detail] iframe');
  const iframe = page.locator('[data-catalog-work-detail] iframe').first();
  await iframe.waitFor({ state: 'visible' });
  const handle = await iframe.elementHandle();
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV030));
  return frame;
}

async function evidenceFor(page, frame, routeName, viewport, reducedMotion) {
  return page.evaluate(({ routeName: name, viewport: target, reduced }) => {
    const root = document.documentElement;
    const iframe = document.querySelector('[data-catalog-work-detail] iframe');
    const heading = document.querySelector('h1, h2');
    const tableau = iframe?.contentDocument?.querySelector('[data-decision-population]');
    const stage = name === 'raw' ? document.querySelector('[data-decision-population]') : tableau;
    const rect = stage?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    return {
      routeName: name,
      targetViewport: target,
      reducedMotion: reduced,
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      tableauVisible: Boolean(stage && rect && rect.width > 0 && rect.height > 0),
      tableauTop: rect ? Number(rect.top.toFixed(2)) : null,
      headingTop: headingRect ? Number(headingRect.top.toFixed(2)) : null,
      tableauFirst: name === 'raw' || (rect && headingRect && rect.top < headingRect.top),
      rowCount: stage?.querySelectorAll('[data-agent-index]').length ?? 0,
      controlsDisplay: stage ? getComputedStyle(stage.querySelector('.population-controls')).display : null,
      readoutDisplay: stage ? getComputedStyle(stage.querySelector('.stage-readout')).display : null,
      hintDisplay: stage ? getComputedStyle(stage.querySelector('.stage-hint')).display : null,
      frameUrl: iframe?.src ?? null
    };
  }, { routeName, viewport: viewport.join('x'), reduced: reducedMotion });
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
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV030));
  const stage = page.locator('[data-decision-population]');
  await page.evaluate(() => window.__mutinePortraitV030.release());
  const initial = await page.evaluate(() => ({ state: window.__mutinePortraitV030.getState(), order: [...document.querySelectorAll('[data-agent-index]')].map((node) => Number(node.dataset.agentIndex)) }));
  await stage.click({ position: { x: 188, y: 380 } });
  const clicked = await page.evaluate(() => ({ state: window.__mutinePortraitV030.getState(), order: [...document.querySelectorAll('[data-agent-index]')].map((node) => Number(node.dataset.agentIndex)) }));
  await stage.focus();
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ state: window.__mutinePortraitV030.getState(), order: [...document.querySelectorAll('[data-agent-index]')].map((node) => Number(node.dataset.agentIndex)) }));
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ state: window.__mutinePortraitV030.getState(), order: [...document.querySelectorAll('[data-agent-index]')].map((node) => Number(node.dataset.agentIndex)) }));
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => window.__mutinePortraitV030.getState());
  const buttons = await page.locator('.population-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, clicked, lifted, keyboard, released, buttons, diagnostics: diag };
}

async function runBlind() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/studies/self-portrait/v030/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV030));
  const evidence = await page.evaluate(() => {
    const stage = document.querySelector('[data-decision-population]');
    const rect = stage.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: rect.width > 0 && rect.height > 0,
      rowCount: document.querySelectorAll('[data-agent-index]').length,
      memory: window.__mutinePortraitV030.getState().frame.memory.length,
      headerDisplay: getComputedStyle(document.querySelector('.studio-header')).display,
      readoutDisplay: getComputedStyle(document.querySelector('.stage-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.population-controls')).display,
      hintDisplay: getComputedStyle(document.querySelector('.stage-hint')).display
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
const journal = await runReadback('/journal/', '#journal-portrait-2026-10-22', 'readback-journal-390x844.png');
const current = await runReadback('/currents/self-portrait/', '[data-catalog-current="portrait"]', 'readback-current-390x844.png');
const work = await runReadback('/works/portrait-2026-10-22/', '[data-catalog-work-detail="portrait-2026-10-22"]', 'readback-work-390x844.png');
const registry = await runReadback('/studio/data/works.json', 'body', 'readback-registry-390x844.png');
const favicon = await runReadback('/favicon.ico', 'body', 'readback-favicon-390x844.png');

const diagnosticsOk = (diag) => diag.consoleMessages.length === 0 && diag.pageErrors.length === 0 && diag.failedRequests.length === 0 && diag.badResponses.length === 0;
const widthOk = (e) => e.innerWidth === e.clientWidth && e.scrollWidth <= e.innerWidth;
const matrixFailures = matrix.filter(({ evidence, diagnostics: diag }) => !widthOk(evidence) || !evidence.tableauVisible || evidence.rowCount !== 15 || (evidence.routeName === 'canonical' && !evidence.tableauFirst) || !diagnosticsOk(diag));
const interactionOk = interaction.initial.state.frame.memory.length === 0
  && interaction.clicked.state.frame.memory.length === 1
  && interaction.clicked.initial?.state === undefined
  && JSON.stringify(interaction.clicked.order) !== JSON.stringify(interaction.initial.order)
  && interaction.lifted.state.geometry === interaction.initial.state.geometry
  && interaction.keyboard.state.frame.memory.length === 1
  && interaction.released.frame.memory.length === 0
  && interaction.buttons.every((button) => button.height >= 44)
  && diagnosticsOk(interaction.diagnostics);
const blindOk = blind.evidence.fieldVisible && blind.evidence.rowCount === 15 && blind.evidence.memory === 4
  && blind.evidence.headerDisplay === 'none' && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none'
  && widthOk(blind.evidence) && diagnosticsOk(blind.diagnostics);
const readbacksOk = [journal, current, work].every(({ evidence, diagnostics: diag }) => evidence.marker && widthOk(evidence) && diagnosticsOk(diag));
const allDiagnosticsOk = matrix.every(({ diagnostics: diag }) => diagnosticsOk(diag)) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(blind.diagnostics) && diagnosticsOk(journal.diagnostics) && diagnosticsOk(current.diagnostics) && diagnosticsOk(work.diagnostics) && diagnosticsOk(registry.diagnostics) && diagnosticsOk(favicon.diagnostics);
const summary = { matrixRuns: matrix.length, matrixFailures, interaction, blind, journal, current, work, registry, favicon, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir };
await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ matrixRuns: matrix.length, matrixFailures: matrixFailures.length, interactionOk, blindOk, readbacksOk, allDiagnosticsOk, proofDir }, null, 2));
await browser.close();
if (matrixFailures.length || !interactionOk || !blindOk || !readbacksOk || !allDiagnosticsOk) process.exitCode = 1;
