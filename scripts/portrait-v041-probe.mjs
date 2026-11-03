import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const production = process.argv.includes('--production');
const smoke = process.argv.includes('--smoke');
const port = 4372;
const base = production ? 'https://autopoiesis-nine.vercel.app' : `http://127.0.0.1:${port}`;
const proofDir = resolve(`C:/Users/ASUS/autopoiesis/research/qa/proofs/portrait-v041-2026-11-03${production ? '-production' : ''}`);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = smoke ? [[390, 844]] : [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = smoke
  ? { raw: '/studies/self-portrait/v041/?preview=1&interaction=1' }
  : { raw: '/studies/self-portrait/v041/?preview=1&interaction=1', canonical: '/works/portrait-2026-11-03/' };

const server = production ? null : http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, base);
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
});

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
    await page.waitForFunction(() => Boolean(window.__mutinePortraitV041), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutinePortraitV041), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/self-portrait/v041/'));
  if (!frame) throw new Error('canonical v041 iframe frame not found');
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV041), null, { timeout: 15000 });
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
  const plane = document.querySelector('[data-attention-plane]');
  const buttons = [...document.querySelectorAll('.attention-controls button')];
  const state = window.__mutinePortraitV041?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    planeVisible: Boolean(plane && plane.getBoundingClientRect().width > 0 && plane.getBoundingClientRect().height > 0),
    plateCount: document.querySelectorAll('[data-plate]').length,
    state: state ? { revision: state.revision, memory: state.memory.length, plates: state.plates.length, interaction: state.interaction } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutVisibility: getComputedStyle(document.querySelector('.attention-readout')).visibility,
    controlsVisibility: getComputedStyle(document.querySelector('.attention-controls')).visibility,
    hintVisibility: getComputedStyle(document.querySelector('.attention-hint')).visibility,
    reducedMotion
  };
}, reduced);

const gotoRoute = async (browser, route, viewport, reducedMotion, options = {}) => {
  const context = options.context ?? browser;
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
  await mkdir(proofDir, { recursive: true });
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const run = await gotoRoute(browser, route, viewport, reducedMotion);
        const filename = `${production ? 'production-' : ''}${routeName}-${reducedMotion ? 'reduced' : 'normal'}-${viewport[0]}x${viewport[1]}.png`;
        const screenshotPath = resolve(proofDir, filename);
        await run.page.screenshot({ path: screenshotPath, fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell: run.shell, tableau: run.tableau, diagnostics: run.diag, screenshot: screenshotPath, screenshotBytes: (await stat(screenshotPath)).size });
        await run.page.close();
      }
    }
  }
  return results;
};

const platePoint = async (frame, site) => frame.evaluate((siteIndex) => {
  const node = document.querySelector(`[data-plate="${siteIndex}"]`);
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width * .5, y: rect.top + rect.height * .5 };
}, site);

const runInteraction = async (browser) => {
  const run = await gotoRoute(browser, routes.raw, [390, 844], false);
  const { page, frame } = run;
  const state = () => frame.evaluate(() => window.__mutinePortraitV041.getState());
  const signature = () => frame.evaluate(() => window.__mutinePortraitV041.geometrySignature());
  const initial = await state();
  const baselineSignature = await signature();
  const point = await platePoint(frame, 4);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  const brief = { state: await state(), signature: await signature() };

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(820);
  await page.mouse.up();
  const committed = { state: await state(), signature: await signature() };
  const localPlate = committed.state.plates[4];

  await frame.getByRole('button', { name: 'lift last fold' }).click();
  const lifted = { state: await state(), signature: await signature() };
  await frame.getByRole('button', { name: 'release field' }).click();
  const released = await state();

  await frame.locator('[data-attention-stage]').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const keyboardReleased = await state();

  const buttons = await frame.locator('.attention-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}interaction-390x844.png`);
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, routes.raw, [390, 844], false, { context: touchContext });
  const touchPoint = await platePoint(touchRun.frame, 3);
  await touchRun.page.touchscreen.tap(touchPoint.x, touchPoint.y);
  const touchBrief = await touchRun.frame.evaluate(() => window.__mutinePortraitV041.getState());
  await touchRun.frame.getByRole('button', { name: 'watch selected' }).click();
  const touchCommitted = await touchRun.frame.evaluate(() => window.__mutinePortraitV041.getState());
  const touchDiagnostics = touchRun.diag;
  await touchRun.page.close();
  await touchContext.close();

  return {
    initial,
    brief,
    committed,
    lifted,
    released,
    keyboardCommitted,
    keyboardReleased,
    baselineSignature,
    briefGeometryNeutral: brief.signature === baselineSignature,
    committedGeometryChanged: committed.signature !== brief.signature,
    localSelfEdited: localPlate.segments.length > initial.plates[4].segments.length && localPlate.state === 'folded',
    liftedExact: lifted.signature === brief.signature,
    releaseQuiet: released.memory.length === 0 && released.revision === 0,
    keyboardProduced: keyboardCommitted.memory.length === 1,
    keyboardReleaseQuiet: keyboardReleased.memory.length === 0,
    buttons,
    touchBrief,
    touchCommitted,
    touchAcceptedByWatchControl: touchCommitted.memory.length === 1,
    diagnostics: run.diag,
    touchDiagnostics,
    screenshot: screenshotPath
  };
};

const runBlind = async (browser) => {
  const route = '/studies/self-portrait/v041/?preview=1&static=1&blind=1';
  const run = await gotoRoute(browser, route, [390, 844], true);
  const evidence = await run.frame.evaluate(() => ({
    planeVisible: getComputedStyle(document.querySelector('[data-attention-plane]')).display !== 'none',
    plateCount: document.querySelectorAll('[data-plate]').length,
    state: window.__mutinePortraitV041.getState(),
    readoutVisibility: getComputedStyle(document.querySelector('.attention-readout')).visibility,
    controlsVisibility: getComputedStyle(document.querySelector('.attention-controls')).visibility,
    hintVisibility: getComputedStyle(document.querySelector('.attention-hint')).visibility,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  const screenshotPath = resolve(proofDir, `${production ? 'production-' : ''}blind-390x844.png`);
  await run.page.screenshot({ path: screenshotPath, fullPage: true });
  await run.page.close();
  return { evidence, diagnostics: run.diag, screenshot: screenshotPath };
};

const runReadbacks = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  const results = [];
  const jsonRoutes = ['/studio/data/works.json', '/studio/data/catalog-public.json'];
  for (const route of jsonRoutes) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    const text = await response.text();
    results.push({ route, status: response?.status() ?? null, hasRecord: text.includes('portrait-2026-11-03'), hasTitle: text.includes('The portrait edits the witness'), hasJournalAnchor: text.includes('journal-portrait-2026-11-03') });
  }

  const journalResponse = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-catalog="journal"][data-ready="true"]', { timeout: 15000 });
  const journalEvidence = await page.evaluate(() => ({
    hasRecord: Boolean(document.querySelector('#journal-portrait-2026-11-03')),
    hasTitle: document.body.innerText.includes('The portrait edits the witness'),
    hasJournalAnchor: Boolean(document.querySelector('#journal-portrait-2026-11-03'))
  }));
  results.push({ route: '/journal/', status: journalResponse?.status() ?? null, ...journalEvidence });

  const workResponse = await page.goto(`${base}/works/portrait-2026-11-03/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  const workEvidence = await page.evaluate(() => ({
    hasRecord: Boolean(document.querySelector('[data-catalog-work-detail="portrait-2026-11-03"]')),
    hasTitle: document.body.innerText.includes('The portrait edits the witness'),
    hasJournalAnchor: Boolean(document.querySelector('#journal'))
  }));
  results.push({ route: '/works/portrait-2026-11-03/', status: workResponse?.status() ?? null, ...workEvidence });

  const faviconResponse = await page.goto(`${base}/studio/favicon.svg`, { waitUntil: 'networkidle', timeout: 30000 });
  results.push({ route: '/studio/favicon.svg', status: faviconResponse?.status() ?? null, hasRecord: false, hasTitle: false, hasJournalAnchor: false });
  await page.close();
  return { results, diagnostics: diag };
};

const main = async () => {
  if (server) await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const matrix = await runMatrix(browser);
    const interaction = await runInteraction(browser);
    const blind = await runBlind(browser);
    const readbacks = await runReadbacks(browser);
    const output = { production, base, matrix, interaction, blind, readbacks };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    await browser.close();
    if (server) await new Promise((resolveClose) => server.close(resolveClose));
  }
};

await main();
