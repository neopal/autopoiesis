import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = Number(process.env.QA_PORT || 4487);
const localBase = `http://127.0.0.1:${port}`;
const base = process.env.QA_BASE || localBase;
const proofDir = resolve(process.env.QA_PROOF_DIR || 'C:/Users/ASUS/autopoiesis/research/qa/proofs/webgpu-v047-2026-11-08-local');
const isLocal = !process.env.QA_BASE;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/webgpu/v047/?preview=1&interaction=1', canonical: '/works/webgpu-2026-11-08/' };

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
const compactState = (state) => state ? ({ stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, agentCount: state.agentCount, absenceCount: state.absenceCount, presentCount: state.presentCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable }) : null;

const waitForTableau = async (page, canonical) => {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV047), null, { timeout: 15000 });
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/webgpu/v047/'));
  if (!frame) throw new Error('canonical v047 iframe not found');
  await frame.waitForFunction(() => Boolean(window.__mutineWebGPUV047), null, { timeout: 15000 });
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
  const field = document.querySelector('#absence-field');
  const buttons = [...document.querySelectorAll('.absence-controls button')];
  const state = window.__mutineWebGPUV047?.getState();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
    field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
    state: state ? { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, agentCount: state.agentCount, absenceCount: state.absenceCount, presentCount: state.presentCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable } : null,
    controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
    readoutDisplay: getComputedStyle(document.querySelector('.absence-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.absence-controls')).display,
    statusDisplay: getComputedStyle(document.querySelector('.absence-status')).display,
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

const runInteraction = async (browser) => {
  const run = await gotoRoute(browser, routes.raw, [390, 844], false);
  const { page, frame } = run;
  const state = () => frame.evaluate(() => window.__mutineWebGPUV047.getState());
  const initial = await state();
  const baseline = initial.signature;
  const canvas = frame.locator('#absence-field');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('v047 absence canvas unavailable for interaction probe');
  const clickAt = async (x, y) => page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await clickAt(0.15, 0.66);
  const first = await state();
  await clickAt(0.5, 0.31);
  const second = await state();
  await clickAt(0.85, 0.66);
  const committed = await state();
  const event = committed.events[0];
  await canvas.focus();
  await page.keyboard.press('Delete');
  const lifted = await state();
  await page.keyboard.press('Enter');
  const keyboardCommitted = await state();
  await page.keyboard.press('Escape');
  const released = await state();
  await clickAt(0.5, 0.31);
  await clickAt(0.5, 0.31);
  const repeated = await state();
  const buttons = await frame.locator('.absence-controls button').evaluateAll((nodes) => nodes.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })));
  const screenshotPath = resolve(proofDir, 'interaction-390x844.png');
  await run.page.screenshot({ path: screenshotPath, fullPage: false });
  await run.page.close();

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchRun = await gotoRoute(browser, routes.raw, [390, 844], false, touchContext);
  await touchRun.frame.getByRole('button', { name: 'look at three' }).tap();
  const touch = { state: await touchRun.frame.evaluate(() => window.__mutineWebGPUV047.getState()), diagnostics: touchRun.diag };
  await touchRun.page.close();
  await touchContext.close();

  return {
    states: { initial: compactState(initial), first: compactState(first), second: compactState(second), committed: compactState(committed), lifted: compactState(lifted), keyboardCommitted: compactState(keyboardCommitted), released: compactState(released), repeated: compactState(repeated) },
    baseline,
    event,
    geometryNeutralBeforeCommit: first.memory === 0 && second.memory === 0 && first.signature === baseline && second.signature === baseline,
    committedMemory: committed.memory === 1,
    changedGeometry: committed.signature !== baseline,
    remoteAbsence: event?.type === 'attention-defection' && !event.witnesses.includes(event.absentSlot),
    liftedQuiet: lifted.memory === 0 && lifted.signature === baseline,
    keyboardMemory: keyboardCommitted.memory === 1,
    releasedQuiet: released.memory === 0,
    repeatedRefused: repeated.memory === 0 && repeated.signature === baseline,
    buttons,
    touch,
    diagnostics: run.diag,
    screenshot: screenshotPath
  };
};

const runBlind = async (browser) => {
  const run = await gotoRoute(browser, '/studies/webgpu/v047/?preview=1&static=1&blind=1', [390, 844], true);
  const evidence = await run.frame.evaluate(() => {
    const state = window.__mutineWebGPUV047.getState();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#absence-field')).display !== 'none',
      state: state ? { stage: state.stage, memory: state.memory, events: state.events, signature: state.signature?.slice(0, 32), gesture: state.gesture, lastAction: state.lastAction, kind: state.kind, agentCount: state.agentCount, absenceCount: state.absenceCount, presentCount: state.presentCount, memoryLimit: state.memoryLimit, gpuAvailable: state.gpuAvailable } : null,
      readoutDisplay: getComputedStyle(document.querySelector('.absence-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.absence-controls')).display,
      statusDisplay: getComputedStyle(document.querySelector('.absence-status')).display,
      hintDisplay: getComputedStyle(document.querySelector('.absence-hint')).display,
      captionDisplay: getComputedStyle(document.querySelector('.absence-frame figcaption')).display,
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
  const evidence = await page.evaluate((expectedTitle) => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, bodyText: document.body.textContent?.includes(expectedTitle) ?? false }), title);
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
    const journal = await runReadback(browser, '/journal/', '#journal-webgpu-2026-11-08', 'journal', 'The crowd keeps an empty seat.');
    const current = await runReadback(browser, '/currents/webgpu/', '[data-catalog-current="webgpu"][data-ready="true"]', 'current', 'The crowd keeps an empty seat.');
    const work = await runReadback(browser, '/works/webgpu-2026-11-08/', '[data-catalog-work-detail][data-ready="true"]', 'work', 'The crowd keeps an empty seat.');
    const registryResponse = await fetch(`${base}/studio/data/works.json`);
    const publicResponse = await fetch(`${base}/studio/data/catalog-public.json`);
    const faviconResponse = await fetch(`${base}/studio/favicon.svg`);
    const source = await registryResponse.json();
    const catalog = await publicResponse.json();
    const matrixPassed = matrix.every((run) => run.shell.innerWidth === Number(run.viewport.split('x')[0]) && run.shell.innerWidth === run.shell.clientWidth && run.shell.scrollWidth <= run.shell.clientWidth && run.shell.tableauFirst && run.tableau.innerWidth === run.tableau.clientWidth && run.tableau.scrollWidth <= run.tableau.clientWidth && run.tableau.fieldVisible && run.tableau.state?.kind === 'absence-arch' && run.tableau.state?.agentCount === 26 && run.tableau.controls.every((button) => button.height >= 44) && diagnosticsOk(run.diagnostics));
    const diagnosticCount = matrix.reduce((sum, run) => sum + run.diagnostics.consoleMessages.length + run.diagnostics.pageErrors.length + run.diagnostics.failedRequests.length + run.diagnostics.badResponses.length, 0);
    const overflowCount = matrix.filter((run) => run.shell.scrollWidth > run.shell.clientWidth || run.tableau.scrollWidth > run.tableau.clientWidth).length;
    const interactionPassed = interaction.geometryNeutralBeforeCommit && interaction.committedMemory && interaction.changedGeometry && interaction.remoteAbsence && interaction.liftedQuiet && interaction.keyboardMemory && interaction.releasedQuiet && interaction.repeatedRefused && interaction.touch?.state?.memory === 1 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics) && diagnosticsOk(interaction.touch.diagnostics);
    const blindPassed = blind.evidence.fieldVisible && blind.evidence.state.memory === 4 && blind.evidence.state.kind === 'absence-arch' && blind.evidence.state.absenceCount === 4 && blind.evidence.state.presentCount === 22 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.statusDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.captionDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
    const recordMatches = source.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-08');
    const catalogMatches = catalog.works.works.filter((workEntry) => workEntry.id === 'webgpu-2026-11-08');
    const readbacksPassed = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.clientWidth && result.evidence.bodyText && diagnosticsOk(result.diagnostics)) && recordMatches.length === 1 && catalogMatches.length === 1 && registryResponse.ok && publicResponse.ok && faviconResponse.ok;
    const summary = { base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir, matrix, interaction, blind, journal, current, work };
    await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ base, matrixCount: matrix.length, matrixPassed, interactionPassed, blindPassed, readbacksPassed, diagnosticCount, overflowCount, registryStatus: registryResponse.status, publicCatalogStatus: publicResponse.status, faviconStatus: faviconResponse.status, recordMatches: recordMatches.length, catalogMatches: catalogMatches.length, proofDir }, null, 2));
    if (!matrixPassed || !interactionPassed || !blindPassed || !readbacksPassed) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.close();
  }
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
