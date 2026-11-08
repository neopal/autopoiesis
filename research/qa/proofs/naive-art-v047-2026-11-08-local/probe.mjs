import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const proofDir = path.resolve(process.env.QA_PROOF_DIR || path.join(root, 'research/qa/proofs/naive-art-v047-2026-11-08-local'));
await mkdir(proofDir, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
let server = null;
let base = process.env.QA_BASE_URL || '';
if (!base) {
  server = createServer(async (request, response) => {
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
  base = `http://127.0.0.1:${server.address().port}`;
}
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v047/?preview=1&interaction=1',
  canonical: '/works/naive-2026-11-08/'
};

async function waitReady(page, kind) {
  if (kind === 'canonical') {
    await page.waitForSelector('[data-catalog-work-detail="naive-2026-11-08"][data-ready="true"]', { timeout: 30000 });
    await page.waitForFunction(() => Array.from(window.frames).some((candidate) => candidate.location.href.includes('/studies/naive-art/v047/')), { timeout: 30000 });
  }
  const frame = kind === 'canonical' ? page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v047/')) : page;
  await frame.waitForFunction(() => Boolean(window._p5Ready && window.__mutineNaiveV047), { timeout: 30000 });
  return frame;
}

async function inspect(page, frame, kind, viewport, reduced, index) {
  const outer = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, heading: document.querySelector('h1, h2, h3')?.textContent?.trim() || null }));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineNaiveV047.getState().memory.length,
    interaction: window.__mutineNaiveV047.getState().interaction,
    fieldRect: document.querySelector('#proof-field')?.getBoundingClientRect().toJSON() || null,
    canvasRect: document.querySelector('#proof-canvas canvas')?.getBoundingClientRect().toJSON() || null,
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
  const frame = await waitReady(page, 'raw');
  const quietSignature = await frame.evaluate(() => window.__mutineNaiveV047.geometrySignature());
  const canvas = frame.locator('#proof-canvas canvas');
  const rect = await canvas.boundingBox();
  const start = { x: rect.x + rect.width * 0.16, y: rect.y + rect.height * 0.5 };
  const finish = { x: rect.x + rect.width * 0.94, y: rect.y + rect.height * 0.5 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(finish.x, finish.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  const pointer = await frame.evaluate(() => ({ ...window.__mutineNaiveV047.getState(), signature: window.__mutineNaiveV047.geometrySignature() }));
  await frame.locator('#proof-field').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await frame.evaluate(() => window.__mutineNaiveV047.getState());
  await page.keyboard.press('Delete');
  const lifted = await frame.evaluate(() => window.__mutineNaiveV047.getState());
  await page.keyboard.press('Escape');
  const released = await frame.evaluate(() => ({ ...window.__mutineNaiveV047.getState(), signature: window.__mutineNaiveV047.geometrySignature() }));
  const shortStart = { x: rect.x + rect.width * 0.45, y: rect.y + rect.height * 0.5 };
  const shortFinish = { x: rect.x + rect.width * 0.56, y: rect.y + rect.height * 0.5 };
  await page.mouse.move(shortStart.x, shortStart.y);
  await page.mouse.down();
  await page.mouse.move(shortFinish.x, shortFinish.y, { steps: 2 });
  await page.mouse.up();
  const short = await frame.evaluate(() => window.__mutineNaiveV047.getState());
  await frame.locator('[data-action="correct"]').click({ clickCount: 4, delay: 10 });
  const four = await frame.evaluate(() => window.__mutineNaiveV047.getState());
  await page.screenshot({ path: path.join(proofDir, 'interaction-four-misprints.png') });
  await context.close();
  return {
    diagnostics,
    pointer: { memory: pointer.memory.length, interaction: pointer.interaction, geometryChanged: pointer.signature !== quietSignature },
    keyboard: { memory: keyboard.memory.length, interaction: keyboard.interaction },
    lifted: { memory: lifted.memory.length, interaction: lifted.interaction },
    released: { memory: released.memory.length, interaction: released.interaction, signatureMatchesQuiet: released.signature === quietSignature },
    short: { memory: short.memory.length, interaction: short.interaction },
    fourMisprints: { memory: four.memory.length, interaction: four.interaction }
  };
}

async function runBlind(browser, reduced) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
  await page.goto(`${base}/studies/naive-art/v047/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitReady(page, 'raw');
  const state = await frame.evaluate(() => ({
    memory: window.__mutineNaiveV047.getState().memory.length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    readout: getComputedStyle(document.querySelector('.proof-readout')).display,
    controls: getComputedStyle(document.querySelector('.proof-controls')).display,
    hint: getComputedStyle(document.querySelector('.proof-hint')).display,
    canvas: document.querySelector('#proof-canvas canvas').getBoundingClientRect().toJSON()
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
if (server) await new Promise((resolve) => server.close(resolve));
const summary = {
  base,
  matrixRuns: results.length,
  diagnostics: results.reduce((sum, result) => sum + result.diagnostics.length, 0) + interaction.diagnostics.length + blind.reduce((sum, result) => sum + result.diagnostics.length, 0),
  firstPartyFailures: results.flatMap((result) => result.firstPartyFailures),
  overflows: results.filter((result) => result.outer.scrollWidth > result.outer.innerWidth || result.tableau.scrollWidth > result.tableau.innerWidth).length,
  targetWidthsValid: results.every((result) => Number(result.viewport.split('x')[0]) === result.outer.innerWidth && result.outer.clientWidth === result.outer.innerWidth && result.tableau.clientWidth === result.tableau.innerWidth),
  minTouchTarget: Math.min(...results.flatMap((result) => result.tableau.buttons.map((button) => Math.min(button.width, button.height)))),
  blind,
  interaction,
  results
};
await writeFile(path.join(proofDir, 'matrix.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ matrixRuns: summary.matrixRuns, diagnostics: summary.diagnostics, firstPartyFailures: summary.firstPartyFailures, overflows: summary.overflows, targetWidthsValid: summary.targetWidthsValid, minTouchTarget: summary.minTouchTarget, blind: summary.blind.map((entry) => ({ reduced: entry.reduced, memory: entry.state.memory, innerWidth: entry.state.innerWidth, clientWidth: entry.state.clientWidth, scrollWidth: entry.state.scrollWidth, readout: entry.state.readout, controls: entry.state.controls, hint: entry.state.hint, diagnostics: entry.diagnostics.length })), interaction: summary.interaction }, null, 2));
