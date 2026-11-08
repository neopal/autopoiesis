import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const proofDir = path.resolve(root, 'research/qa/proofs/brush-v051-2026-11-08-local');
await mkdir(proofDir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    const filePath = path.resolve(root, `.${relative}`);
    if (!filePath.startsWith(root)) throw new Error('path traversal');
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': mime[path.extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/p5-brush/v051/?preview=1&interaction=1',
  canonical: '/works/brush-2026-11-08/'
};

async function waitReady(page, kind) {
  if (kind === 'canonical') {
    await page.waitForSelector('[data-catalog-work-detail="brush-2026-11-08"][data-ready="true"]', { timeout: 30000 });
    await page.waitForFunction(() => Array.from(window.frames).some((candidate) => candidate.location.href.includes('/studies/p5-brush/v051/')), { timeout: 30000 });
  }
  const frame = kind === 'canonical' ? page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v051/')) : page;
  try {
    await frame.waitForFunction(() => Boolean(window._p5Ready && window.__mutineBrushV051?.ready), { timeout: 30000 });
  } catch (error) {
    const detail = await frame.evaluate(() => ({
      href: location.href,
      title: document.title,
      p5: typeof window.p5,
      canvasCount: document.querySelectorAll('canvas').length,
      bodyText: document.body.textContent.trim().slice(0, 240)
    })).catch(() => ({ href: frame.url(), evaluation: 'failed' }));
    console.error(JSON.stringify({ waitReady: detail, error: error.message }));
    throw error;
  }
  return frame;
}

async function inspect(page, frame, kind, viewport, reduced, index) {
  const outer = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, heading: document.querySelector('h1, h2, h3')?.textContent?.trim() || null }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineBrushV051.getState().memory.length,
    interaction: window.__mutineBrushV051.getState().interaction,
    fieldRect: document.querySelector('#phase-field')?.getBoundingClientRect().toJSON() || null,
    canvasRect: document.querySelector('#phase-canvas canvas')?.getBoundingClientRect().toJSON() || null,
    buttons: [...document.querySelectorAll('button')].map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height }))
  }));
  const screenshot = `matrix-${kind}-${index}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: path.join(proofDir, screenshot), fullPage: kind === 'canonical' });
  return { kind, viewport: `${viewport[0]}x${viewport[1]}`, reduced, outer, tableau, screenshot };
}

async function runCase(browser, kind, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  const firstPartyFailures = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  page.on('response', (response) => { if (response.url().startsWith(base) && response.status() >= 400) firstPartyFailures.push(`${response.status()} ${response.url()}`); });
  await page.goto(`${base}${routes[kind]}`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitReady(page, kind);
  const result = await inspect(page, frame, kind, viewport, reduced, index);
  result.diagnostics = diagnostics;
  result.firstPartyFailures = firstPartyFailures;
  await context.close();
  return result;
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitReady(page, 'raw');
  const quietSignature = await page.evaluate(() => window.__mutineBrushV051.geometrySignature());
  const canvas = page.locator('#phase-canvas canvas');
  const rect = await canvas.boundingBox();
  const topSite = { x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.1 };
  await page.mouse.move(topSite.x, topSite.y);
  await page.mouse.down();
  await page.waitForTimeout(420);
  await page.mouse.up();
  await page.waitForTimeout(50);
  const pointer = await page.evaluate(() => ({ ...window.__mutineBrushV051.getState(), signature: window.__mutineBrushV051.geometrySignature() }));
  await page.locator('#phase-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineBrushV051.getState());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineBrushV051.getState());
  await page.keyboard.press('Escape');
  const released = await page.evaluate(() => ({ ...window.__mutineBrushV051.getState(), signature: window.__mutineBrushV051.geometrySignature() }));
  await page.mouse.move(topSite.x, topSite.y);
  await page.mouse.down();
  await page.waitForTimeout(760);
  await page.mouse.up();
  const mistimed = await page.evaluate(() => window.__mutineBrushV051.getState());
  await page.locator('[data-gesture="pulse"]').click({ clickCount: 4, delay: 10 });
  const four = await page.evaluate(() => window.__mutineBrushV051.getState());
  await page.screenshot({ path: path.join(proofDir, 'interaction-four-slips.png') });
  await context.close();
  return {
    diagnostics,
    pointer: { memory: pointer.memory.length, interaction: pointer.interaction, geometryChanged: pointer.signature !== quietSignature },
    keyboard: { memory: keyboard.memory.length, interaction: keyboard.interaction },
    lifted: { memory: lifted.memory.length, interaction: lifted.interaction },
    released: { memory: released.memory.length, interaction: released.interaction, signatureMatchesQuiet: released.signature === quietSignature },
    mistimed: { memory: mistimed.memory.length, interaction: mistimed.interaction },
    fourSlips: { memory: four.memory.length, interaction: four.interaction }
  };
}

async function runBlind(browser, reduced) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  await page.goto(`${base}/studies/p5-brush/v051/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitReady(page, 'raw');
  const state = await frame.evaluate(() => ({
    memory: window.__mutineBrushV051.getState().memory.length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    readout: getComputedStyle(document.querySelector('.phase-readout')).display,
    controls: getComputedStyle(document.querySelector('.phase-controls')).display,
    hint: getComputedStyle(document.querySelector('.phase-hint')).display,
    canvas: document.querySelector('#phase-canvas canvas').getBoundingClientRect().toJSON()
  }));
  const screenshot = `blind-390x844-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: path.join(proofDir, screenshot) });
  await context.close();
  return { reduced, state, screenshot, diagnostics };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
let index = 0;
for (const kind of ['raw', 'canonical']) for (const reduced of [false, true]) for (const viewport of viewports) results.push(await runCase(browser, kind, viewport, reduced, index++));
const interaction = await runInteraction(browser);
const blind = [await runBlind(browser, false), await runBlind(browser, true)];
await browser.close();
await new Promise((resolve) => server.close(resolve));
const summary = {
  base,
  matrixRuns: results.length,
  diagnostics: results.reduce((sum, result) => sum + result.diagnostics.length, 0) + interaction.diagnostics.length + blind.reduce((sum, result) => sum + result.diagnostics.length, 0),
  firstPartyFailures: results.flatMap((result) => result.firstPartyFailures),
  overflows: results.filter((result) => result.outer.scrollWidth > result.outer.innerWidth || result.tableau.scrollWidth > result.tableau.innerWidth).length,
  targetWidthsValid: results.every((result) => Number(result.viewport.split('x')[0]) === result.outer.innerWidth && result.outer.clientWidth === result.outer.innerWidth && result.tableau.clientWidth === result.tableau.innerWidth),
  blind,
  interaction,
  results
};
await writeFile(path.join(proofDir, 'matrix.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ matrixRuns: summary.matrixRuns, diagnostics: summary.diagnostics, firstPartyFailures: summary.firstPartyFailures, overflows: summary.overflows, targetWidthsValid: summary.targetWidthsValid, blind: summary.blind.map((entry) => ({ reduced: entry.reduced, memory: entry.state.memory, innerWidth: entry.state.innerWidth, clientWidth: entry.state.clientWidth, scrollWidth: entry.state.scrollWidth, readout: entry.state.readout, controls: entry.state.controls, hint: entry.state.hint, diagnostics: entry.diagnostics.length })), interaction: summary.interaction }, null, 2));
