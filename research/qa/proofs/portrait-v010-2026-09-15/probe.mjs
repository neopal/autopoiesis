import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const proofDir = new URL('./', import.meta.url);
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const workId = 'portrait-2026-09-15';
const canonicalPath = `/works/${workId}/`;
const studyPath = '/studies/self-portrait/v010/';
const rawPath = `${studyPath}?preview=1&interaction=1`;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const results = {
  base,
  workId,
  canonicalPath,
  studyPath,
  viewportRuns: [],
  interaction: null,
  staticBlind: null,
  journal: null,
  directRawRedirect: null,
  favicon: null,
  issues: [],
  captures: []
};

await mkdir(proofDir, { recursive: true });

function listen(page) {
  const events = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => events.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) events.badResponses.push({ url: response.url(), status: response.status() });
  });
  return events;
}

function issueMessages(events) {
  return [
    ...(events.consoleMessages ?? []).map((entry) => `console: ${entry.type} ${entry.text}`),
    ...(events.pageErrors ?? []).map((entry) => `pageerror: ${entry}`),
    ...(events.failedRequests ?? []).map((entry) => `requestfailed: ${entry.url}`),
    ...(events.badResponses ?? []).map((entry) => `http-${entry.status}: ${entry.url}`)
  ];
}

function check(condition, message) {
  if (!condition) results.issues.push(message);
}

async function openCanonical(browser, viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const response = await page.goto(`${base}${canonicalPath}?qa=portrait-v010-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}`, { waitUntil: 'networkidle' });
  check(response?.ok(), `canonical returned ${response?.status()} at ${viewport.width}x${viewport.height}`);
  await page.waitForSelector('[data-catalog-work-detail] .work-inspect__stage iframe');
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
  const frame = page.frames().find((candidate) => candidate.url().includes(studyPath));
  check(Boolean(frame), `embedded v010 frame missing at ${viewport.width}x${viewport.height}`);
  if (!frame) {
    await context.close();
    return;
  }
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV010));
  const shell = await page.evaluate(() => {
    const root = document.documentElement;
    const mount = document.querySelector('[data-catalog-work-detail]');
    const stage = mount?.querySelector('.work-inspect__stage');
    const heading = mount?.querySelector('.work-inspect__heading');
    const iframe = stage?.querySelector('iframe');
    const rect = (element) => element ? element.getBoundingClientRect().toJSON() : null;
    const offenders = [...document.querySelectorAll('*')].map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className : '',
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      inTimeline: Boolean(element.closest('.work-timeline-bar'))
    })).filter((entry) => (entry.left < -1 || entry.right > innerWidth + 1) && !entry.inTimeline).slice(0, 8);
    return {
      innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      mountReady: mount?.dataset.ready === 'true',
      bodyWorkId: document.body.dataset.workId,
      title: mount?.querySelector('h1')?.textContent?.trim() ?? '',
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      tableauFirst: Boolean(stage && heading && (stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      stageTop: rect(stage)?.top ?? null,
      headingTop: rect(heading)?.top ?? null,
      firstArtwork: rect(iframe),
      offenders
    };
  });
  const tableau = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: Boolean(document.querySelector('#field')?.width),
    canvasCssWidth: document.querySelector('#field')?.getBoundingClientRect().width ?? 0,
    canvasCssHeight: document.querySelector('#field')?.getBoundingClientRect().height ?? 0,
    preview: document.documentElement.classList.contains('preview-mode'),
    interactivePreview: document.documentElement.classList.contains('interactive-preview'),
    state: window.__mutinePortraitV010.getState(),
    stage: document.querySelector('[data-stage]')?.textContent ?? null,
    memory: document.querySelector('[data-memory]')?.textContent ?? null
  }));
  check(shell.mountReady && shell.bodyWorkId === workId && shell.iframeCount === 1 && shell.tableauFirst, `canonical tableau-first shell failed at ${viewport.width}x${viewport.height}`);
  check(shell.innerWidth === shell.clientWidth && shell.scrollWidth <= shell.innerWidth && shell.offenders.length === 0, `canonical shell overflow at ${viewport.width}x${viewport.height}`);
  check(tableau.canvas && tableau.canvasCssWidth > 0 && tableau.canvasCssHeight > 0 && tableau.preview && tableau.interactivePreview, `embedded v010 canvas/preview failed at ${viewport.width}x${viewport.height}`);
  check(tableau.innerWidth === tableau.clientWidth && tableau.scrollWidth <= tableau.innerWidth, `embedded v010 overflow at ${viewport.width}x${viewport.height}`);
  if (reducedMotion) {
    check(tableau.state.stage === 15 && tableau.state.memory === 4 && tableau.state.paused, `reduced-motion v010 did not settle at stage 16 / 16 with four forks at ${viewport.width}x${viewport.height}`);
  } else {
    check(tableau.state.stage === 0 && tableau.state.memory === 0 && !tableau.state.paused, `normal-motion v010 did not open at stage 01 / 16 with zero forks at ${viewport.width}x${viewport.height}`);
  }
  const capture = `canonical-${reducedMotion ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: fileURLToPath(new URL(capture, proofDir)), fullPage: false });
  results.captures.push(capture);
  results.viewportRuns.push({ viewport, reducedMotion, responseStatus: response?.status() ?? null, shell, tableau, capture, ...events });
  results.issues.push(...issueMessages(events).map((message) => `${viewport.width}x${viewport.height}: ${message}`));
  await context.close();
}

async function openInteraction(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const response = await page.goto(`${base}${rawPath}&qa=portrait-v010-interaction`, { waitUntil: 'networkidle' });
  check(response?.ok(), `raw interaction returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV010));
  const field = page.locator('#field');
  const initial = await page.evaluate(() => ({
    geometry: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    state: window.__mutinePortraitV010.getState(),
    signature: document.querySelector('#field').toDataURL(),
    controls: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: Math.round(button.getBoundingClientRect().height), disabled: button.disabled }))
  }));
  check(initial.geometry.innerWidth === initial.geometry.clientWidth && initial.geometry.scrollWidth <= initial.geometry.innerWidth, 'raw interaction overflow before gesture');
  check(initial.controls.length === 3 && initial.controls.every((control) => control.height >= 44), 'raw interaction controls below 44px');
  const bounds = await field.boundingBox();
  check(Boolean(bounds), 'raw interaction canvas has no bounds');
  if (!bounds) {
    await context.close();
    return;
  }
  await page.mouse.click(bounds.x + bounds.width * .56, bounds.y + bounds.height * .42);
  const afterPointer = await page.evaluate(() => ({ state: window.__mutinePortraitV010.getState(), signature: document.querySelector('#field').toDataURL() }));
  check(afterPointer.state.memory === 1 && afterPointer.state.paused && afterPointer.state.interaction === 'visitor-fork', 'pointer did not register a structural fork');
  check(afterPointer.signature !== initial.signature, 'pointer did not change canvas pixels');
  await field.focus();
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => ({ state: window.__mutinePortraitV010.getState(), signature: document.querySelector('#field').toDataURL() }));
  check(afterKeyboard.state.memory === 2 && afterKeyboard.state.paused, 'Enter did not add a second fork');
  await page.locator('#undo-control').click();
  const afterLift = await page.evaluate(() => ({ state: window.__mutinePortraitV010.getState(), signature: document.querySelector('#field').toDataURL() }));
  check(afterLift.state.memory === 1 && afterLift.state.interaction === 'fork-returned', 'undo did not remove only the latest fork');
  check(afterLift.signature === afterPointer.signature, 'undo did not restore the exact pointer-state canvas');
  await page.locator('#undo-control').click();
  const afterSecondLift = await page.evaluate(() => ({ state: window.__mutinePortraitV010.getState(), signature: document.querySelector('#field').toDataURL() }));
  check(afterSecondLift.state.memory === 0 && afterSecondLift.signature === initial.signature, 'second undo did not restore the empty field');
  await page.locator('#release-control').click();
  const afterRelease = await page.evaluate(() => ({ state: window.__mutinePortraitV010.getState(), signature: document.querySelector('#field').toDataURL() }));
  check(afterRelease.state.memory === 0 && afterRelease.state.stage === 0 && !afterRelease.state.paused, 'release did not restart the sequence');
  const geometryAfter = await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  check(geometryAfter.innerWidth === geometryAfter.clientWidth && geometryAfter.scrollWidth <= geometryAfter.innerWidth, 'raw interaction overflow after gesture');
  const capture = 'raw-interaction-390x844.png';
  await page.screenshot({ path: fileURLToPath(new URL(capture, proofDir)), fullPage: false });
  results.captures.push(capture);
  results.interaction = { viewport, responseStatus: response?.status() ?? null, initial, afterPointer, afterKeyboard, afterLift, afterSecondLift, afterRelease, geometryAfter, capture, ...events };
  results.issues.push(...issueMessages(events).map((message) => `interaction: ${message}`));
  await context.close();
}

async function openStaticBlind(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const path = `${studyPath}?preview=1&static=1&blind=1&qa=portrait-v010-static-blind`;
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  check(response?.ok(), `static blind returned ${response?.status()}`);
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV010));
  const readback = await page.evaluate(() => {
    const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const canvas = document.querySelector('#field');
    return {
      geometry: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      preview: document.documentElement.classList.contains('preview-mode'),
      staticMode: document.documentElement.classList.contains('static-mode'),
      blindMode: new URLSearchParams(location.search).get('blind') === '1',
      canvas: Boolean(canvas?.width),
      canvasCssWidth: canvas?.getBoundingClientRect().width ?? 0,
      canvasCssHeight: canvas?.getBoundingClientRect().height ?? 0,
      state: window.__mutinePortraitV010.getState(),
      furniture: ['.studio-header', '.studio-path', '.work-annotations', '.surface-readout', '.field-controls', '.studio-footer'].map((selector) => ({ selector, display: display(selector) }))
    };
  });
  check(readback.preview && readback.staticMode && readback.blindMode && readback.canvas && readback.canvasCssWidth > 0 && readback.canvasCssHeight > 0, 'static blind canvas failed');
  check(readback.geometry.innerWidth === readback.geometry.clientWidth && readback.geometry.scrollWidth <= readback.geometry.innerWidth, 'static blind overflow');
  check(readback.state.stage === 15 && readback.state.memory === 4 && readback.state.paused, 'static blind did not preserve settled fork frame');
  check(readback.furniture.every((entry) => entry.display === 'none'), 'static blind editorial furniture or controls remain visible');
  const capture = 'static-blind-390x844.png';
  await page.screenshot({ path: fileURLToPath(new URL(capture, proofDir)), fullPage: false });
  results.captures.push(capture);
  results.staticBlind = { viewport, responseStatus: response?.status() ?? null, readback, capture, ...events };
  results.issues.push(...issueMessages(events).map((message) => `static-blind: ${message}`));
  await context.close();
}

async function openJournal(browser) {
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const events = listen(page);
  const response = await page.goto(`${base}/journal/?qa=portrait-v010-journal`, { waitUntil: 'networkidle' });
  check(response?.ok(), `Journal returned ${response?.status()}`);
  await page.waitForFunction(() => document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true');
  const readback = await page.evaluate(() => {
    const entry = document.querySelector('#journal-portrait-2026-09-15');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-portrait-2026-09-15').length,
      titleCount: [...document.querySelectorAll('.journal-entry h3')].filter((element) => element.textContent.trim() === 'The portrait keeps a fork.').length,
      href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null
    };
  });
  check(readback.anchorCount === 1 && readback.titleCount === 1 && readback.href === `/works/${workId}/#journal`, 'Journal record did not render exactly once');
  check(readback.innerWidth === readback.clientWidth && readback.scrollWidth <= readback.innerWidth, 'Journal overflow');
  const capture = 'journal-390x844.png';
  await page.screenshot({ path: fileURLToPath(new URL(capture, proofDir)), fullPage: false });
  results.captures.push(capture);
  results.journal = { viewport, responseStatus: response?.status() ?? null, readback, capture, ...events };
  results.issues.push(...issueMessages(events).map((message) => `journal: ${message}`));
  await context.close();
}

async function checkRedirect(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const response = await page.goto(`${base}${studyPath}?qa=portrait-v010-direct`, { waitUntil: 'networkidle' });
  results.directRawRedirect = { responseStatus: response?.status() ?? null, url: page.url() };
  check(page.url().endsWith(canonicalPath), 'direct raw tableau did not redirect to canonical work');
  await page.close();
}

const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  for (const viewport of viewports) {
    await openCanonical(browser, viewport, false);
    await openCanonical(browser, viewport, true);
  }
  await openInteraction(browser);
  await openStaticBlind(browser);
  await openJournal(browser);
  await checkRedirect(browser);
  const faviconResponse = await fetch(`${base}/studio/favicon.svg?qa=portrait-v010-favicon`);
  results.favicon = {
    status: faviconResponse.status,
    contentType: faviconResponse.headers.get('content-type'),
    bytes: Number(faviconResponse.headers.get('content-length') ?? 0)
  };
  check(results.favicon.status === 200 && results.favicon.contentType?.includes('image/svg+xml'), 'favicon did not return SVG 200');
} finally {
  await browser.close();
}

results.status = results.issues.length ? 'held / failed browser gate' : 'candidate / held for independent caption-free perceptual review and provider revision verification';
await writeFile(new URL('results.json', proofDir), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({
  status: results.status,
  issues: results.issues,
  viewportRuns: results.viewportRuns.length,
  interactionMemory: results.interaction ? [results.interaction.initial.state.memory, results.interaction.afterPointer.state.memory, results.interaction.afterKeyboard.state.memory, results.interaction.afterLift.state.memory, results.interaction.afterSecondLift.state.memory, results.interaction.afterRelease.state.memory] : null,
  staticBlindState: results.staticBlind?.readback?.state ?? null,
  journal: results.journal?.readback ?? null,
  directRawRedirect: results.directRawRedirect,
  favicon: results.favicon,
  captures: results.captures.length
}, null, 2));
if (results.issues.length) process.exitCode = 1;
