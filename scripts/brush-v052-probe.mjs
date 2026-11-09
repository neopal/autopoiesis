import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = Number(process.env.QA_PORT || 4177);
const localBase = `http://127.0.0.1:${port}`;
const base = process.env.QA_BASE || localBase;
const proofDir = resolve(process.env.QA_PROOF_DIR || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v052-2026-11-09-local');
const isLocal = !process.env.QA_BASE;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/p5-brush/v052/?preview=1&interaction=1',
  canonical: '/works/brush-2026-11-09/'
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

const diagnostics = (page) => {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
};
const diagnosticsOk = (result) => !result.consoleMessages.length && !result.pageErrors.length && !result.failedRequests.length && !result.badResponses.length;

const waitForTableau = async (page, canonical) => {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineBrushV052), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/p5-brush/v052/'));
  if (!frame) throw new Error('canonical v052 iframe not found');
  await frame.waitForFunction(() => Boolean(window.__mutineBrushV052), null, { timeout: 15000 });
  return frame;
};

const shellEvidence = async (page, canonical) => page.evaluate((isCanonical) => {
  const iframe = document.querySelector('.work-inspect__stage iframe');
  const heading = document.querySelector('.work-inspect__heading h1');
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

const tableauEvidence = async (frame, reduced) => frame.evaluate((reducedMotion) => {
  const field = document.querySelector('#register-field');
  const controls = [...document.querySelectorAll('.register-controls button')];
  const state = window.__mutineBrushV052?.getFrame();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    canvasVisible: Boolean(document.querySelector('#register-canvas canvas')?.getBoundingClientRect().width),
    state: state ? { stage: state.stage, memory: state.memory.length, cellCount: state.body.cells.length, presentCount: state.body.cells.filter((cell) => cell.present).length, composition: state.composition, renderer: state.renderer } : null,
    controls: controls.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.register-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.register-controls')).display,
    selectionDisplay: getComputedStyle(document.querySelector('.register-selection')).display,
    hintDisplay: getComputedStyle(document.querySelector('.register-hint')).display,
    reducedMotion
  };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion, context = browser) => {
  const page = await context.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  const frame = await waitForTableau(page, route === routes.canonical);
  const shell = await shellEvidence(page, route === routes.canonical);
  const tableau = await tableauEvidence(frame, reducedMotion);
  return { page, frame, diag, shell, tableau };
};

const runMatrix = async (browser) => {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const screenshotPath = resolve(proofDir, `${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`);
        await run.page.screenshot({ path: screenshotPath, fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell: run.shell, tableau: run.tableau, diagnostics: run.diag, screenshot: screenshotPath, screenshotBytes: (await stat(screenshotPath)).size });
        await run.page.close();
      }
    }
  }
  return results;
};

const clickCell = async (page, frame, index) => {
  const state = await frame.evaluate(() => window.__mutineBrushV052.getFrame());
  const cell = state.body.cells[index];
  const box = await frame.locator('#register-canvas canvas').boundingBox();
  if (!cell || !box) throw new Error(`v052 cell ${index} unavailable for interaction probe`);
  await page.mouse.click(box.x + box.width * (cell.present ? cell.x : cell.baseX), box.y + box.height * (cell.present ? cell.y : cell.baseY));
};

const runInteraction = async (browser) => {
  const run = await gotoRoute(browser, routes.raw, [390, 844], false);
  const { page, frame } = run;
  const state = () => frame.evaluate(() => window.__mutineBrushV052.getFrame());
  const initial = await state();
  const baseline = await frame.evaluate(() => window.__mutineBrushV052.geometrySignature());
  await clickCell(page, frame, 7);
  const committed = await state();
  const afterCutSignature = await frame.evaluate(() => window.__mutineBrushV052.geometrySignature());
  await clickCell(page, frame, 7);
  const repeated = await state();
  await clickCell(page, frame, 23);
  await clickCell(page, frame, 10);
  const threeCuts = await state();
  await frame.locator('#register-field').focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  const releasedSignature = await frame.evaluate(() => window.__mutineBrushV052.geometrySignature());
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await state();
  const buttons = await frame.locator('.register-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: false });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, routes.raw, [390, 844], false, touchContext);
  await touchRun.frame.getByRole('button', { name: 'cut selected cell' }).tap();
  const touch = { state: await touchRun.frame.evaluate(() => window.__mutineBrushV052.getFrame()), diagnostics: touchRun.diag };
  await touchRun.page.close();
  await touchContext.close();

  return {
    initial: { memory: initial.memory.length, cellCount: initial.body.cells.length, presentCount: initial.body.cells.filter((cell) => cell.present).length },
    committed: { memory: committed.memory.length, removed: !committed.body.cells[7].present, geometryChanged: afterCutSignature !== baseline },
    repeated: { memory: repeated.memory.length, refused: repeated.interaction === 'refused / vacancy already cut' },
    threeCuts: { memory: threeCuts.memory.length, presentCount: threeCuts.body.cells.filter((cell) => cell.present).length },
    lifted: { memory: lifted.memory.length, interaction: lifted.interaction },
    released: { memory: released.memory.length, signature: releasedSignature },
    keyboard: { memory: keyboard.memory.length },
    buttons,
    touch: { memory: touch.state.memory.length, removed: !touch.state.body.cells[touch.state.selectedIndex].present, diagnostics: touch.diagnostics },
    baseline,
    diagnostics: run.diag,
    screenshot: screenshotPath
  };
};

const runBlind = async (browser) => {
  const run = await gotoRoute(browser, '/studies/p5-brush/v052/?preview=1&static=1&blind=1', [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineBrushV052.getFrame();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#register-field')).display !== 'none',
      state: { memory: state.memory.length, presentCount: state.body.cells.filter((cell) => cell.present).length, composition: state.composition },
      readoutDisplay: getComputedStyle(document.querySelector('.register-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.register-controls')).display,
      selectionDisplay: getComputedStyle(document.querySelector('.register-selection')).display,
      hintDisplay: getComputedStyle(document.querySelector('.register-hint')).display,
      captionDisplay: getComputedStyle(document.querySelector('.register-work figcaption')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  const screenshotPath = resolve(proofDir, 'blind-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot: screenshotPath };
};

const runReadback = async (browser, route, marker, name, title) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector(marker, { timeout: 15000 });
  const evidence = await page.evaluate((expectedTitle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, bodyText: document.body.textContent?.includes(expectedTitle) ?? false }), title);
  const screenshotPath = resolve(proofDir, `${name}-390x844.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag, screenshot: screenshotPath };
};

const main = async () => {
  await mkdir(proofDir, { recursive: true });
  if (server) await new Promise((resolvePromise) => server.listen(port, '127.0.0.1', resolvePromise));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const journal = await runReadback(browser, '/journal/', '#journal-brush-2026-11-09', 'journal', 'The paint re-counts the room.');
    const current = await runReadback(browser, '/currents/brush/', '[data-catalog-current="brush"][data-ready="true"]', 'current', 'The paint re-counts the room.');
    const work = await runReadback(browser, '/works/brush-2026-11-09/', '[data-catalog-work-detail][data-ready="true"]', 'work', 'The paint re-counts the room.');
    const paths = ['/studio/data/works.json', '/studio/data/catalog-public.json', '/works/brush-2026-11-09/', '/studies/p5-brush/v052/?preview=1&static=1&blind=1', '/studio/favicon.svg'];
    const readback = {};
    for (const path of paths) {
      const response = await fetch(`${base}${path}`);
      const text = await response.text();
      readback[path] = { status: response.status, hasRecord: path.includes('works.json') ? text.includes('brush-2026-11-09') : path.includes('favicon') || response.status === 200 };
    }
    const sourceResponse = await fetch(`${base}/studio/data/works.json`);
    const catalogResponse = await fetch(`${base}/studio/data/catalog-public.json`);
    const source = await sourceResponse.json();
    const catalog = await catalogResponse.json();
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'brush-2026-11-09');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'brush-2026-11-09');
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === Number(run.viewport.split('x')[0]) && run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.canvasVisible && run.tableau.state?.composition === 'vacancy-register' && run.tableau.state?.cellCount === 35 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = interaction.committed.memory === 1 && interaction.committed.removed && interaction.committed.geometryChanged && interaction.repeated.refused && interaction.threeCuts.memory === 3 && interaction.lifted.memory === 2 && interaction.released.memory === 0 && interaction.keyboard.memory === 1 && interaction.touch.memory === 1 && interaction.touch.removed && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(interaction.touch.diagnostics);
    const blindPassed = blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.presentCount === 31 && blind.evidence.state.composition === 'vacancy-register' && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.selectionDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const readbacksPassed = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.bodyText && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && Object.values(readback).every((entry) => entry.status === 200 && entry.hasRecord) && sourceResponse.ok && catalogResponse.ok;
    const summary = { base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work, readback };
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.close();
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
