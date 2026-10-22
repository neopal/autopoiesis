import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = path.join(root, 'research', 'qa', 'proofs', 'naive-v032-2026-10-22-production');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const routes = {
  raw: '/studies/naive-art/v032/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-22/'
};

function diagnosticsPage(page) {
  const diagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => diagnostics.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function probe(page, name, route, viewport, reducedMotion) {
  const diagnostics = diagnosticsPage(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  if (name === 'raw') await page.waitForFunction(() => Boolean(window.__mutineNaiveV032), null, { timeout: 15000 });
  else {
    await page.waitForSelector('[data-catalog-work-detail="naive-2026-10-22"]');
    await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 15000 });
  }
  const measurement = await page.evaluate(() => {
    const field = document.querySelector('#family-tree') || document.querySelector('.work-tableau');
    const tableau = document.querySelector('iframe') || field;
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      tableau: tableau ? { width: Number(tableau.getBoundingClientRect().width.toFixed(2)), height: Number(tableau.getBoundingClientRect().height.toFixed(2)) } : null,
      nodeCount: document.querySelectorAll('.family-node').length,
      edgeCount: document.querySelectorAll('.family-edge').length,
      buttons: [...document.querySelectorAll('button')].map((button) => ({ label: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      title: document.title,
      hasWorkTitle: document.body.textContent.includes('The branch learned the wrong family.')
    };
  });
  const screenshot = path.join(proofDir, `${name}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { name, viewport: `${viewport.width}x${viewport.height}`, reducedMotion, measurement, diagnostics, screenshot };
}

async function interaction(page) {
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV032));
  const state = () => page.evaluate(() => ({ signature: window.__mutineNaiveV032.geometrySignature(), frame: window.__mutineNaiveV032.getState() }));
  const baseline = await state();
  await page.locator('[data-node-id="1"]').click();
  const first = await state();
  await page.locator('[data-node-id="3"]').click();
  const second = await state();
  await page.locator('[data-node-id="8"]').click();
  const committed = await state();
  await page.locator('#family-tree').focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboard = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await page.screenshot({ path: path.join(proofDir, 'interaction-390x844.png'), fullPage: false });
  return {
    baseline: { memory: baseline.frame.memory.length, signature: baseline.signature },
    first: { memory: first.frame.memory.length, pending: first.frame.pendingPath, signatureUnchanged: first.signature === baseline.signature },
    second: { memory: second.frame.memory.length, pending: second.frame.pendingPath, signatureUnchanged: second.signature === baseline.signature },
    committed: { memory: committed.frame.memory.length, interaction: committed.frame.interaction, changedNodes: committed.frame.nodes.filter((node, index) => node.state !== baseline.frame.nodes[index].state || node.parent !== baseline.frame.nodes[index].parent).length, signatureChanged: committed.signature !== baseline.signature },
    lifted: { memory: lifted.frame.memory.length, exactLift: lifted.signature === baseline.signature },
    keyboard: { memory: keyboard.frame.memory.length, interaction: keyboard.frame.interaction },
    released: { memory: released.frame.memory.length, interaction: released.frame.interaction }
  };
}

async function blindPreview(page) {
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV032));
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#family-tree')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.family-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.family-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.family-hint')).display,
    nodeCount: document.querySelectorAll('.family-node').length,
    frame: window.__mutineNaiveV032.getState(),
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: path.join(proofDir, 'blind-390x844.png'), fullPage: false });
  return evidence;
}

async function readbacks(page) {
  const paths = ['/journal/', '/currents/naive-art/', '/works/naive-2026-10-22/', '/studies/naive-art/v032/?preview=1&interaction=1', '/studio/data/works.json', '/studio/data/catalog-public.json', '/studio/favicon.svg'];
  const result = {};
  for (const route of paths) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    const body = route.endsWith('favicon.svg') ? '' : await page.locator('body').innerText().catch(() => '');
    result[route] = { status: response.status(), hasTarget: body.includes('The branch learned the wrong family.') || body.includes('naive-2026-10-22') || route.endsWith('favicon.svg') };
  }
  const source = await page.evaluate(async () => (await fetch('/studio/data/works.json')).json());
  const publicCatalog = await page.evaluate(async () => (await fetch('/studio/data/catalog-public.json')).json());
  result.registry = {
    sourceMatches: source.works.filter((work) => work.id === 'naive-2026-10-22').length,
    publicMatches: publicCatalog.works.works.filter((work) => work.id === 'naive-2026-10-22').length,
    sourceCount: source.works.length,
    publicCount: publicCatalog.works.works.length
  };
  return result;
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const matrix = [];
try {
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      for (const [name, route] of Object.entries(routes)) {
        const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        matrix.push(await probe(page, name, route, viewport, reducedMotion));
        await context.close();
      }
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const interactionResult = await interaction(page);
  const blindResult = await blindPreview(page);
  const readbackResult = await readbacks(page);
  await context.close();
  const result = {
    routeMatrix: matrix,
    interaction: interactionResult,
    blindPreview: blindResult,
    readbacks: readbackResult,
    totals: {
      matrixRuns: matrix.length,
      overflowFailures: matrix.filter((entry) => entry.measurement.scrollWidth > entry.measurement.innerWidth).length,
      diagnostics: matrix.reduce((sum, entry) => sum + Object.values(entry.diagnostics).reduce((inner, values) => inner + values.length, 0), 0),
      minTouchTarget: Math.min(...matrix.flatMap((entry) => entry.measurement.buttons.map((button) => button.height)), Infinity)
    }
  };
  await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ totals: result.totals, interaction: result.interaction, blindPreview: { memory: result.blindPreview.frame.memory.length, widths: [result.blindPreview.innerWidth, result.blindPreview.clientWidth, result.blindPreview.scrollWidth] }, readbacks: result.readbacks.registry }, null, 2));
} finally {
  await browser.close();
}
