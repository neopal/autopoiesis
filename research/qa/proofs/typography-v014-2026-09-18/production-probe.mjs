import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const proofDir = new URL('./production/', import.meta.url);
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const canonicalPath = '/works/typography-2026-09-18/';
const rawPath = '/studies/handwriting/v014/?preview=1&interaction=1';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const results = { base, canonicalPath, rawPath, viewportRuns: [], interaction: null, staticBlind: null, journal: null, redirect: null, favicon: null, issues: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listen(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

function issueMessages(run) {
  return [
    ...(run.consoleMessages ?? []).map((entry) => `console: ${entry.type} ${entry.text}`),
    ...(run.pageErrors ?? []).map((entry) => `pageerror: ${entry}`),
    ...(run.failedRequests ?? []).map((entry) => `requestfailed: ${entry.url}`),
    ...(run.badResponses ?? []).map((entry) => `http-${entry.status}: ${entry.url}`)
  ];
}

async function openCanonical(browser, viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const response = await page.goto(`${base}${canonicalPath}`, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `canonical returned ${response?.status()}`);
  await page.waitForSelector('[data-catalog-work-detail] .work-inspect__stage iframe');
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.contentDocument?.querySelector('#piece')), null, { timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/handwriting/v014/'));
  assert(frame, 'embedded v014 frame did not load');
  await frame.waitForFunction(() => Boolean(window.__mutineHandwritingV014));
  const shell = await page.evaluate(() => {
    const root = document.documentElement;
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('.work-inspect__heading');
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      tableauFirst: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      workReady: mount?.dataset.ready === 'true',
      title: heading?.querySelector('h1')?.textContent?.trim() ?? '',
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      firstArtwork: (() => { const rect = iframe?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; })(),
      intro: (() => { const rect = heading?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; })(),
      touchTargets: [...document.querySelectorAll('a, button')].map((element) => Math.round(element.getBoundingClientRect().height)).filter((height) => height > 0)
    };
  });
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineHandwritingV014.getState(),
    hasCanvas: Boolean(document.querySelector('#piece')),
    canvasWidth: document.querySelector('#piece')?.getBoundingClientRect().width ?? 0,
    canvasHeight: document.querySelector('#piece')?.getBoundingClientRect().height ?? 0
  }));
  assert(shell.workReady && shell.tableauFirst && shell.iframeCount === 1, 'canonical shell did not render tableau first');
  assert(shell.innerWidth === shell.clientWidth && shell.scrollWidth <= shell.innerWidth, 'canonical page overflow');
  assert(tableau.hasCanvas && tableau.canvasWidth > 0 && tableau.canvasHeight > 0, 'tableau canvas missing');
  assert(tableau.innerWidth === tableau.clientWidth && tableau.scrollWidth <= tableau.innerWidth, 'embedded tableau overflow');
  if (reducedMotion) assert(tableau.state.stage === 16 && tableau.state.memory.length === 6 && tableau.state.paused, 'reduced motion did not settle the final cadence frame');
  else assert(tableau.state.stage === 0 && tableau.state.memory.length === 0 && !tableau.state.paused, 'normal motion did not begin at the empty frame');
  const capture = `canonical-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: fileURLToPath(new URL(capture, proofDir)), fullPage: true });
  const run = { viewport, reducedMotion, responseStatus: response.status(), shell, tableau, ...events, capture };
  await context.close();
  return run;
}

async function openInteraction(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const response = await page.goto(`${base}${rawPath}`, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `raw interaction returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV014));
  const initial = await page.evaluate(() => ({
    geometry: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    state: window.__mutineHandwritingV014.getState(),
    signature: document.querySelector('#piece').toDataURL(),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: Math.round(button.getBoundingClientRect().height), disabled: button.disabled }))
  }));
  assert(initial.geometry.innerWidth === initial.geometry.clientWidth && initial.geometry.scrollWidth <= initial.geometry.innerWidth, 'raw interaction overflow before gesture');
  assert(initial.controls.length === 3 && initial.controls.every((control) => control.height >= 44) && initial.controls.find((control) => control.id === 'place-return')?.disabled === false && initial.controls.find((control) => control.id === 'release-sequence')?.disabled === false && initial.controls.find((control) => control.id === 'lift-return')?.disabled === true, 'raw controls below 44px or wrong initial disabled state');
  const canvas = page.locator('#piece');
  const box = await canvas.boundingBox();
  assert(box, 'raw canvas has no bounds');
  await page.mouse.move(box.x + box.width * .56, box.y + box.height * .42);
  await page.mouse.click(box.x + box.width * .56, box.y + box.height * .42);
  const afterPointer = await page.evaluate(() => ({ state: window.__mutineHandwritingV014.getState(), signature: document.querySelector('#piece').toDataURL() }));
  assert(afterPointer.state.memory.length === 1 && afterPointer.state.paused && afterPointer.state.answeredRoutes >= 3 && afterPointer.signature !== initial.signature, 'pointer did not change the structural field');
  await canvas.focus();
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => ({ state: window.__mutineHandwritingV014.getState() }));
  assert(afterKeyboard.state.memory.length === 2 && afterKeyboard.state.answeredRoutes >= 3, 'keyboard did not add a second cadence');
  await page.locator('#lift-return').click();
  const afterLift = await page.evaluate(() => ({ state: window.__mutineHandwritingV014.getState(), signature: document.querySelector('#piece').toDataURL() }));
  assert(afterLift.state.memory.length === 1, 'lift did not remove only the latest cadence');
  assert(afterLift.signature === afterPointer.signature, 'lift did not restore the exact pointer-state field');
  await page.locator('#release-sequence').click();
  const afterRelease = await page.evaluate(() => ({ state: window.__mutineHandwritingV014.getState() }));
  assert(afterRelease.state.memory.length === 0 && afterRelease.state.stage === 0 && !afterRelease.state.paused, 'release did not restart the sequence');
  const geometryAfter = await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(geometryAfter.innerWidth === geometryAfter.clientWidth && geometryAfter.scrollWidth <= geometryAfter.innerWidth, 'raw interaction overflow after gesture');
  await page.screenshot({ path: fileURLToPath(new URL('raw-interaction-390x844.png', proofDir)), fullPage: true });
  const result = { viewport, responseStatus: response.status(), initial, afterPointer, afterKeyboard, afterLift, afterRelease, geometryAfter, ...events, capture: 'raw-interaction-390x844.png' };
  await context.close();
  return result;
}

async function openStaticBlind(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const path = '/studies/handwriting/v014/?preview=1&static=1&blind=1';
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  assert(response?.ok(), `static blind returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutineHandwritingV014));
  const state = await page.evaluate(() => ({
    geometry: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    state: window.__mutineHandwritingV014.getState(),
    canvas: Boolean(document.querySelector('#piece')),
    canvasVisible: getComputedStyle(document.querySelector('#piece')).display !== 'none',
    furnitureVisible: [...document.querySelectorAll('.studio-header, .studio-path, .opening, .annotations, .studio-footer, .interaction-panel, .canvas-corner, figcaption')].some((element) => getComputedStyle(element).display !== 'none')
  }));
  assert(state.canvas && state.canvasVisible && state.geometry.innerWidth === state.geometry.clientWidth && state.geometry.scrollWidth <= state.geometry.innerWidth, 'static blind canvas or geometry failed');
  assert(state.state.stage === 16 && state.state.memory.length === 6 && !state.furnitureVisible, 'static blind did not preserve the final field without furniture');
  await page.screenshot({ path: fileURLToPath(new URL('static-blind-390x844.png', proofDir)), fullPage: true });
  const result = { viewport, responseStatus: response.status(), ...state, ...events, capture: 'static-blind-390x844.png' };
  await context.close();
  return result;
}

async function openJournal(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const response = await page.goto(`${base}/journal/`, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `Journal returned ${response?.status()}`);
  await page.waitForFunction(() => document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true');
  const journal = await page.evaluate(() => {
    const entry = document.querySelector('#journal-typography-2026-09-18');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-typography-2026-09-18').length,
      titlePresent: document.body.textContent.includes('The sentence answers itself.'),
      href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null
    };
  });
  assert(journal.anchorCount === 1 && journal.titlePresent && journal.href === '/works/typography-2026-09-18/#journal', 'Journal record did not render');
  assert(journal.innerWidth === journal.clientWidth && journal.scrollWidth <= journal.innerWidth, 'Journal overflow');
  await page.screenshot({ path: fileURLToPath(new URL('journal-390x844.png', proofDir)), fullPage: true });
  const result = { viewport, responseStatus: response.status(), ...journal, ...events, capture: 'journal-390x844.png' };
  await context.close();
  return result;
}

async function checkRedirect(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const response = await page.goto(`${base}/studies/handwriting/v014/`, { waitUntil: 'domcontentloaded' });
  results.redirect = { responseStatus: response?.status() ?? null, url: page.url() };
  assert(page.url().includes('/works/typography-2026-09-18/'), 'direct raw tableau did not redirect to canonical work');
  await context.close();
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
try {
  for (const viewport of viewports) {
    for (const reducedMotion of [false, true]) results.viewportRuns.push(await openCanonical(browser, viewport, reducedMotion));
  }
  results.interaction = await openInteraction(browser);
  results.staticBlind = await openStaticBlind(browser);
  results.journal = await openJournal(browser);
  await checkRedirect(browser);
  const faviconResponse = await fetch(`${base}/studio/favicon.svg?qa=v014-favicon`);
  results.favicon = { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type') };
  assert(results.favicon.status === 200 && results.favicon.contentType?.includes('image/svg+xml'), 'favicon did not return SVG 200');
  results.issues = [...results.viewportRuns, results.interaction, results.staticBlind, results.journal].flatMap(issueMessages);
  assert(results.viewportRuns.length === 10, 'expected ten canonical viewport/motion runs');
  assert(results.issues.length === 0, `browser issues: ${results.issues.join('; ')}`);
  await writeFile(new URL('results.json', proofDir), JSON.stringify(results, null, 2));
  process.stdout.write(JSON.stringify({ ok: true, viewportRuns: results.viewportRuns.length, issues: results.issues.length, interactionMemory: [results.interaction.initial.state.memory.length, results.interaction.afterPointer.state.memory.length, results.interaction.afterKeyboard.state.memory.length, results.interaction.afterLift.state.memory.length, results.interaction.afterRelease.state.memory.length], journalAnchors: results.journal.anchorCount, redirect: results.redirect.url, favicon: results.favicon, captures: 13 }, null, 2));
} catch (error) {
  results.issues.push(String(error));
  await writeFile(new URL('results.json', proofDir), JSON.stringify(results, null, 2));
  process.exitCode = 1;
  process.stderr.write(`${error.stack ?? error}\n`);
} finally {
  await browser.close();
}
