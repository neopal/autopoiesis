import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = Number(process.env.QA_PORT || 41774);
const localBase = `http://127.0.0.1:${port}`;
const base = process.env.QA_BASE || localBase;
const proofDir = resolve(process.env.QA_PROOF_DIR || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v054-2026-11-11-local');
const isLocal = !process.env.QA_BASE;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/p5-brush/v054/?preview=1&interaction=1',
  canonical: '/works/brush-2026-11-11/'
};

const server = isLocal ? http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, localBase);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) { response.writeHead(403); response.end('forbidden'); return; }
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
}) : null;

function diagnostics(page) {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
}
const diagnosticsOk = (result) => !result.consoleMessages.length && !result.pageErrors.length && !result.failedRequests.length && !result.badResponses.length;

async function waitForTableau(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineBrushV054), null, { timeout: 20000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 20000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/p5-brush/v054/'));
  if (!frame) throw new Error('canonical v054 iframe not found');
  await frame.waitForFunction(() => Boolean(window.__mutineBrushV054), null, { timeout: 20000 });
  return frame;
}

async function shellEvidence(page, canonical) {
  return page.evaluate((isCanonical) => {
    const iframe = document.querySelector('iframe');
    const heading = document.querySelector('h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    };
  }, canonical);
}

async function tableauEvidence(frame, reducedMotion) {
  return frame.evaluate((reduced) => {
    const state = window.__mutineBrushV054?.getFrame();
    const controls = [...document.querySelectorAll('.relay-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(document.querySelector('#relay-field')?.getBoundingClientRect().width),
      svgVisible: Boolean(document.querySelector('[data-relay-svg]')?.getBoundingClientRect().width),
      state: state ? { memory: state.memory.length, depositCount: state.body.deposits.length, relayCount: state.body.relays.length, composition: state.composition, renderer: state.renderer } : null,
      controls: controls.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      readoutDisplay: getComputedStyle(document.querySelector('.relay-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.relay-controls')).display,
      selectionDisplay: getComputedStyle(document.querySelector('.relay-selection')).display,
      hintDisplay: getComputedStyle(document.querySelector('.relay-hint')).display,
      reducedMotion: reduced
    };
  }, reducedMotion);
}

async function gotoRoute(browser, route, viewport, reducedMotion, context = browser) {
  const page = await context.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 40000 });
  const frame = await waitForTableau(page, route === routes.canonical);
  const shell = await shellEvidence(page, route === routes.canonical);
  const tableau = await tableauEvidence(frame, reducedMotion);
  return { page, frame, diag, shell, tableau };
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const screenshot = resolve(proofDir, `${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`);
        await run.page.screenshot({ path: screenshot, fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell: run.shell, tableau: run.tableau, diagnostics: run.diag, screenshot, screenshotBytes: (await stat(screenshot)).size });
        await run.page.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser) {
  const run = await gotoRoute(browser, routes.raw, [390, 844], false);
  const { page, frame } = run;
  const getState = () => frame.evaluate(() => window.__mutineBrushV054.getFrame());
  const baseline = await frame.evaluate(() => window.__mutineBrushV054.geometrySignature());
  await frame.getByRole('button', { name: 'make a pressure relay' }).click();
  const first = await getState();
  const firstSignature = await frame.evaluate(() => window.__mutineBrushV054.geometrySignature());
  await frame.getByRole('button', { name: 'make a pressure relay' }).click();
  const second = await getState();
  await frame.locator('#relay-field').focus();
  await page.keyboard.press('Delete');
  const lifted = await getState();
  const liftedSignature = await frame.evaluate(() => window.__mutineBrushV054.geometrySignature());
  await page.keyboard.press('Escape');
  const released = await getState();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await getState();

  const svgBox = await frame.locator('[data-relay-svg]').boundingBox();
  if (!svgBox) throw new Error('v054 SVG unavailable for pointer relay');
  await page.mouse.move(svgBox.x + svgBox.width * 0.06, svgBox.y + svgBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + svgBox.width * 0.32, svgBox.y + svgBox.height * 0.30, { steps: 4 });
  await page.mouse.move(svgBox.x + svgBox.width * 0.62, svgBox.y + svgBox.height * 0.66, { steps: 4 });
  await page.mouse.move(svgBox.x + svgBox.width * 0.94, svgBox.y + svgBox.height * 0.5, { steps: 4 });
  await page.mouse.up();
  const pointer = await getState();

  await page.mouse.move(svgBox.x + svgBox.width * 0.06, svgBox.y + svgBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + svgBox.width * 0.94, svgBox.y + svgBox.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const refused = await getState();
  const buttons = await frame.locator('.relay-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshot = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshot, fullPage: false });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, routes.raw, [390, 844], false, touchContext);
  await touchRun.frame.getByRole('button', { name: 'make a pressure relay' }).tap();
  const touch = { state: await touchRun.frame.evaluate(() => window.__mutineBrushV054.getFrame()), diagnostics: touchRun.diag };
  await touchRun.page.close();
  await touchContext.close();

  return {
    baseline,
    first: { memory: first.memory.length, geometryChanged: firstSignature !== baseline },
    second: { memory: second.memory.length },
    lifted: { memory: lifted.memory.length, interaction: lifted.interaction, exact: liftedSignature === firstSignature },
    released: { memory: released.memory.length },
    keyboard: { memory: keyboard.memory.length },
    pointer: { memory: pointer.memory.length, interaction: pointer.interaction },
    refused: { memory: refused.memory.length, interaction: refused.interaction },
    buttons,
    touch: { memory: touch.state.memory.length, interaction: touch.state.interaction, diagnostics: touch.diagnostics },
    diagnostics: run.diag,
    screenshot
  };
}

async function runBlind(browser) {
  const route = '/studies/p5-brush/v054/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineBrushV054.getFrame();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#relay-field')).display !== 'none',
      state: { memory: state.memory.length, depositCount: state.body.deposits.length, relayCount: state.body.relays.length, composition: state.composition },
      readoutDisplay: getComputedStyle(document.querySelector('.relay-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.relay-controls')).display,
      selectionDisplay: getComputedStyle(document.querySelector('.relay-selection')).display,
      hintDisplay: getComputedStyle(document.querySelector('.relay-hint')).display,
      captionDisplay: getComputedStyle(document.querySelector('.relay-work figcaption')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  const screenshot = resolve(proofDir, 'blind-390x844.png');
  await run.page.screenshot({ path: screenshot, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot };
}

async function runReadback(browser, route, marker, name, title) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 40000 });
  await page.waitForSelector(marker, { timeout: 20000 });
  const evidence = await page.evaluate((expectedTitle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyText: document.body.textContent?.includes(expectedTitle) ?? false }), title);
  const screenshot = resolve(proofDir, `${name}-390x844.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag, screenshot };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  if (server) await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const journal = await runReadback(browser, '/journal/', '#journal-brush-2026-11-11', 'journal', 'The pigment changes hands.');
    const current = await runReadback(browser, '/currents/brush/', '[data-catalog-current="brush"][data-ready="true"]', 'current', 'The pigment changes hands.');
    const work = await runReadback(browser, '/works/brush-2026-11-11/', '[data-catalog-work-detail][data-ready="true"]', 'work', 'The pigment changes hands.');
    const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/brush-2026-11-11/', '/studies/p5-brush/v054/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
    const readback = {};
    for (const path of paths) {
      const response = await fetch(`${base}${path}`);
      const text = await response.text();
      readback[path] = { status: response.status, hasRecord: path.includes('works.json') ? text.includes('brush-2026-11-11') : path.includes('favicon') || response.status === 200 };
    }
    const source = await (await fetch(`${base}/studio/data/works.json`)).json();
    const catalog = await (await fetch(`${base}/studio/data/catalog-public.json`)).json();
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'brush-2026-11-11');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'brush-2026-11-11');
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === Number(run.viewport.split('x')[0]) && run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.svgVisible && run.tableau.state?.composition === 'relay-ledger' && run.tableau.state?.depositCount === 9 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = interaction.first.memory === 1 && interaction.first.geometryChanged && interaction.second.memory === 2 && interaction.lifted.memory === 1 && interaction.lifted.exact && interaction.released.memory === 0 && interaction.keyboard.memory === 1 && interaction.pointer.memory === 2 && interaction.refused.memory === 2 && interaction.touch.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(interaction.touch.diagnostics);
    const blindPassed = blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.depositCount === 9 && blind.evidence.state.relayCount === 4 && blind.evidence.state.composition === 'relay-ledger' && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.selectionDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const readbacksPassed = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.bodyText && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && Object.values(readback).every((entry) => entry.status === 200 && entry.hasRecord);
    const summary = { base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work, readback };
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
