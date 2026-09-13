import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('./', import.meta.url);
const proofDir = new URL('./', root);
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const canonicalPath = '/works/typography-2026-09-13/';
const rawPath = '/studies/handwriting/v009/?preview=1&interaction=1';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

const results = {
  base,
  canonicalPath,
  rawPath,
  viewportRuns: [],
  interaction: null,
  staticBlind: null,
  issues: []
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openPage(browser, path, viewport, reducedMotion, captureName) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });

  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  assert(response?.ok(), `${path} returned ${response?.status()}`);
  await page.waitForSelector('[data-catalog-work-detail] .work-inspect__stage iframe');
  const shell = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tableauFirst: document.querySelector('.work-inspect__stage iframe')?.compareDocumentPosition(document.querySelector('.work-inspect__heading')) === Node.DOCUMENT_POSITION_FOLLOWING,
    workReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
    title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? '',
    touchTargets: [...document.querySelectorAll('a, button')].map((element) => Math.round(element.getBoundingClientRect().height)).filter((height) => height > 0)
  }));
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v009/'));
  assert(frame, 'embedded v009 frame did not load');
  await frame.waitForFunction(() => Boolean(window.__mutineHandwritingV009));
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineHandwritingV009.getState(),
    hasCanvas: Boolean(document.querySelector('#piece')),
    canvasWidth: document.querySelector('#piece')?.getBoundingClientRect().width ?? 0,
    canvasHeight: document.querySelector('#piece')?.getBoundingClientRect().height ?? 0
  }));
  assert(shell.workReady, 'catalog mount did not become ready');
  assert(shell.tableauFirst, 'canonical tableau was not first');
  assert(shell.innerWidth === shell.clientWidth && shell.scrollWidth <= shell.innerWidth, 'canonical page overflow');
  assert(tableau.hasCanvas && tableau.canvasWidth > 0 && tableau.canvasHeight > 0, 'tableau canvas missing');
  assert(tableau.innerWidth === tableau.clientWidth && tableau.scrollWidth <= tableau.innerWidth, 'embedded tableau overflow');
  if (reducedMotion) assert(tableau.state.memory === 5 && tableau.state.stage === 12, 'reduced motion did not settle the final switch frame');
  else assert(tableau.state.memory === 0 && tableau.state.stage === 0, 'normal motion did not begin at the empty frame');

  await page.screenshot({ path: fileURLToPath(new URL(captureName, proofDir)), fullPage: true });
  const run = { viewport, reducedMotion, responseStatus: response.status(), shell, tableau, consoleMessages, pageErrors, failedRequests, badResponses, capture: captureName };
  await context.close();
  return run;
}

async function openRawInteraction(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(`${base}${rawPath}`, { waitUntil: 'networkidle' });
  assert(response?.ok(), `raw interaction returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV009));
  const initial = await page.evaluate(() => ({
    geometry: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    state: window.__mutineHandwritingV009.getState(),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: Math.round(button.getBoundingClientRect().height), disabled: button.disabled }))
  }));
  assert(initial.geometry.innerWidth === initial.geometry.clientWidth && initial.geometry.scrollWidth <= initial.geometry.innerWidth, 'raw interaction overflow before gesture');
  assert(initial.controls.length === 3 && initial.controls.every((control) => control.height >= 44), 'raw controls below 44px');
  const canvas = page.locator('#piece');
  const box = await canvas.boundingBox();
  assert(box, 'raw canvas has no bounds');
  await page.mouse.click(box.x + box.width * 0.56, box.y + box.height * 0.42);
  const afterPointer = await page.evaluate(() => ({ state: window.__mutineHandwritingV009.getState(), signature: window.__mutineHandwritingV009.getFrameSignature() }));
  assert(afterPointer.state.memory === 1 && afterPointer.state.paused === true && afterPointer.state.switchedRoutes === 2, 'pointer did not create a structural pair switch');
  await canvas.focus();
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => ({ state: window.__mutineHandwritingV009.getState() }));
  assert(afterKeyboard.state.memory === 2 && afterKeyboard.state.switchedRoutes === 2, 'keyboard did not add a second switch');
  await page.locator('#lift-switch').click();
  const afterLift = await page.evaluate(() => ({ state: window.__mutineHandwritingV009.getState(), signature: window.__mutineHandwritingV009.getFrameSignature() }));
  assert(afterLift.state.memory === 1, 'lift did not remove only the latest switch');
  assert(afterLift.signature === afterPointer.signature, 'lift did not restore the exact pointer-state field');
  await page.locator('#release-sequence').click();
  const afterRelease = await page.evaluate(() => ({ state: window.__mutineHandwritingV009.getState() }));
  assert(afterRelease.state.memory === 0 && afterRelease.state.stage === 0 && afterRelease.state.paused === false, 'release did not restart the sequence');
  const geometryAfter = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(geometryAfter.innerWidth === geometryAfter.clientWidth && geometryAfter.scrollWidth <= geometryAfter.innerWidth, 'raw interaction overflow after gesture');
  await page.screenshot({ path: fileURLToPath(new URL('raw-interaction-390x844.png', proofDir)), fullPage: true });
  const result = { viewport, responseStatus: response.status(), initial, afterPointer, afterKeyboard, afterLift, afterRelease, geometryAfter, consoleMessages, pageErrors, failedRequests, badResponses, capture: 'raw-interaction-390x844.png' };
  await context.close();
  return result;
}

async function openStaticBlind(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const path = '/studies/handwriting/v009/?preview=1&static=1&blind=1';
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  assert(response?.ok(), `static blind returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV009));
  const state = await page.evaluate(() => ({
    geometry: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    state: window.__mutineHandwritingV009.getState(),
    canvas: Boolean(document.querySelector('#piece')),
    furnitureVisible: [...document.querySelectorAll('.studio-header, .studio-path, .opening, .annotations, .studio-footer, .interaction-panel, .canvas-corner, figcaption')].some((element) => getComputedStyle(element).display !== 'none')
  }));
  assert(state.canvas && state.geometry.innerWidth === state.geometry.clientWidth && state.geometry.scrollWidth <= state.geometry.innerWidth, 'static blind canvas or geometry failed');
  assert(!state.furnitureVisible, 'static blind retained editorial furniture');
  await page.screenshot({ path: fileURLToPath(new URL('static-blind-390x844.png', proofDir)), fullPage: true });
  const result = { viewport, responseStatus: response.status(), ...state, consoleMessages, pageErrors, failedRequests, badResponses, capture: 'static-blind-390x844.png' };
  await context.close();
  return result;
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    for (const reducedMotion of [false, true]) {
      const mode = reducedMotion ? 'reduced' : 'normal';
      const capture = `canonical-${viewport.width}x${viewport.height}-${mode}.png`;
      results.viewportRuns.push(await openPage(browser, canonicalPath, viewport, reducedMotion, capture));
    }
  }
  results.interaction = await openRawInteraction(browser);
  results.staticBlind = await openStaticBlind(browser);
  results.issues = [...results.viewportRuns, results.interaction, results.staticBlind].flatMap((run) => [
    ...(run.consoleMessages ?? []).map((entry) => `console: ${entry.type} ${entry.text}`),
    ...(run.pageErrors ?? []).map((entry) => `pageerror: ${entry}`),
    ...(run.failedRequests ?? []).map((entry) => `requestfailed: ${entry.url}`),
    ...(run.badResponses ?? []).map((entry) => `http-${entry.status}: ${entry.url}`)
  ]);
  assert(results.viewportRuns.length === 10, 'expected ten canonical viewport/motion runs');
  assert(results.issues.length === 0, `browser issues: ${results.issues.join('; ')}`);
  await writeFile(new URL('results.json', proofDir), JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({ ok: true, viewportRuns: results.viewportRuns.length, issues: results.issues.length, interactionMemory: [results.interaction.initial.state.memory, results.interaction.afterPointer.state.memory, results.interaction.afterKeyboard.state.memory, results.interaction.afterLift.state.memory, results.interaction.afterRelease.state.memory], captures: 12 }, null, 2));
} finally {
  await browser.close();
}
