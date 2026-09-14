import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const base = 'http://127.0.0.1:4173';
const workId = 'portrait-2026-09-14';
const studyPath = '/studies/self-portrait/v009/';
const canonicalPath = `/works/${workId}/`;
const stamp = 'portrait-v009-local-2026-09-14';
const outputDir = fileURLToPath(new URL('./', import.meta.url));
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const failures = [];
const viewportMatrix = [];
await mkdir(outputDir, { recursive: true });

function attachDiagnostics(page) {
  const diagnostics = { consoleMessages: [], pageErrors: [], networkFailures: [], httpFailures: [] };
  page.on('console', (message) => diagnostics.consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.networkFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.httpFailures.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function cleanDiagnostics(diagnostics) {
  return {
    consoleMessages: diagnostics.consoleMessages,
    pageErrors: diagnostics.pageErrors,
    networkFailures: diagnostics.networkFailures,
    httpFailures: diagnostics.httpFailures
  };
}

function recordFailure(condition, name) {
  if (condition) failures.push(name);
}

const browser = await chromium.launch({ headless: true, executablePath });

for (const reduced of [false, true]) {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 }
  ]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const diagnostics = attachDiagnostics(page);
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const url = `${base}${canonicalPath}?qa=${stamp}-${reduced ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    const iframe = page.locator('.work-inspect__stage iframe');
    await iframe.waitFor({ state: 'visible' });
    const frame = page.frames().find((candidate) => candidate.url().includes(studyPath));
    const outer = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const offenders = [...document.querySelectorAll('*')].map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className : '',
        right: element.getBoundingClientRect().right,
        left: element.getBoundingClientRect().left,
        inTimeline: Boolean(element.closest('.work-timeline-bar'))
      })).filter((entry) => (entry.right > innerWidth + 1 || entry.left < -1) && !entry.inTimeline).slice(0, 8);
      return {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        workId: document.body.dataset.workId,
        mount: Boolean(document.querySelector(`[data-catalog-work-detail="${'portrait-2026-09-14'}"]`)),
        tableauFirst: (rect('.work-inspect__stage')?.top ?? Infinity) <= (rect('.work-inspect__heading')?.top ?? -Infinity),
        tableauTop: rect('.work-inspect__stage')?.top ?? null,
        headingTop: rect('.work-inspect__heading')?.top ?? null,
        firstArtwork: rect('.work-inspect__stage iframe'),
        offenders
      };
    });
    const embedded = frame ? await frame.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: Boolean(document.querySelector('#field')?.width),
      canvasCssWidth: document.querySelector('#field')?.getBoundingClientRect().width ?? 0,
      canvasCssHeight: document.querySelector('#field')?.getBoundingClientRect().height ?? 0,
      preview: document.documentElement.classList.contains('preview-mode'),
      interactivePreview: document.documentElement.classList.contains('interactive-preview'),
      stage: document.querySelector('span[data-stage]')?.textContent ?? null,
      memory: document.querySelector('span[data-memory]')?.textContent ?? null,
      state: window.__mutinePortraitV009?.getState?.() ?? null
    })) : null;
    const screenshot = `canonical-${reduced ? 'reduced' : 'normal'}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: join(outputDir, screenshot), fullPage: false });
    const entry = { reducedMotion: reduced, viewport, url, outer, embedded, screenshot, diagnostics: cleanDiagnostics(diagnostics) };
    viewportMatrix.push(entry);
    recordFailure(!frame || !outer.mount || outer.workId !== workId || !outer.tableauFirst || outer.scrollWidth > outer.innerWidth || outer.offenders.length, `canonical shell ${reduced ? 'reduced' : 'normal'} ${viewport.width}x${viewport.height}`);
    recordFailure(!embedded?.canvas || !embedded.preview || !embedded.interactivePreview || embedded.scrollWidth > embedded.innerWidth, `embedded tableau ${reduced ? 'reduced' : 'normal'} ${viewport.width}x${viewport.height}`);
    recordFailure(diagnostics.consoleMessages.length || diagnostics.pageErrors.length || diagnostics.networkFailures.length || diagnostics.httpFailures.length, `canonical runtime ${reduced ? 'reduced' : 'normal'} ${viewport.width}x${viewport.height}`);
    await page.close();
  }
}

const staticPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const staticDiagnostics = attachDiagnostics(staticPage);
await staticPage.emulateMedia({ reducedMotion: 'reduce' });
const staticUrl = `${base}${studyPath}?preview=1&static=1&blind=1&qa=${stamp}`;
await staticPage.goto(staticUrl, { waitUntil: 'networkidle' });
await staticPage.locator('#field').waitFor({ state: 'visible' });
const staticReadback = await staticPage.evaluate(() => {
  const style = (selector) => getComputedStyle(document.querySelector(selector)).display;
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    preview: document.documentElement.classList.contains('preview-mode'),
    staticMode: document.documentElement.classList.contains('static-mode'),
    blindMode: new URLSearchParams(location.search).get('blind') === '1',
    canvas: Boolean(document.querySelector('#field')?.width),
    canvasCssWidth: document.querySelector('#field')?.getBoundingClientRect().width ?? 0,
    canvasCssHeight: document.querySelector('#field')?.getBoundingClientRect().height ?? 0,
    headerDisplay: style('.studio-header'),
    annotationsDisplay: style('.work-annotations'),
    readoutDisplay: style('.surface-readout'),
    controlsDisplay: style('.field-controls')
  };
});
const staticScreenshot = 'static-blind-390x844.png';
await staticPage.screenshot({ path: join(outputDir, staticScreenshot), fullPage: false });
recordFailure(!staticReadback.preview || !staticReadback.staticMode || !staticReadback.blindMode || !staticReadback.canvas || staticReadback.canvasCssWidth <= 0 || staticReadback.canvasCssHeight <= 0, 'static blind canvas');
recordFailure(staticReadback.headerDisplay !== 'none' || staticReadback.annotationsDisplay !== 'none' || staticReadback.readoutDisplay !== 'none' || staticReadback.controlsDisplay !== 'none', 'static blind furniture');
recordFailure(staticReadback.scrollWidth > staticReadback.innerWidth, 'static blind overflow');
recordFailure(staticDiagnostics.consoleMessages.length || staticDiagnostics.pageErrors.length || staticDiagnostics.networkFailures.length || staticDiagnostics.httpFailures.length, 'static blind runtime');
await staticPage.close();

const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const rawDiagnostics = attachDiagnostics(rawPage);
await rawPage.emulateMedia({ reducedMotion: 'no-preference' });
const rawUrl = `${base}${studyPath}?preview=1&interaction=1&qa=${stamp}`;
await rawPage.goto(rawUrl, { waitUntil: 'networkidle' });
const field = rawPage.locator('#field');
await field.waitFor({ state: 'visible' });
const before = await rawPage.evaluate(() => ({
  stage: document.querySelector('span[data-stage]').textContent,
  memory: document.querySelector('span[data-memory]').textContent,
  signature: document.querySelector('#field').toDataURL(),
  stageHtml: document.querySelector('span[data-stage]').outerHTML,
  memoryHtml: document.querySelector('span[data-memory]').outerHTML
}));
const rawGeometry = await rawPage.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  preview: document.documentElement.classList.contains('preview-mode'),
  interactivePreview: document.documentElement.classList.contains('interactive-preview'),
  buttons: [...document.querySelectorAll('.field-controls button')].map((element) => ({ label: element.textContent.trim(), height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width }))
}));
const bounds = await field.boundingBox();
await field.click({ position: { x: bounds.width * 0.55, y: bounds.height * 0.42 } });
const afterPointerState = await rawPage.evaluate(() => ({ stage: document.querySelector('span[data-stage]').textContent, memory: document.querySelector('span[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
const afterPointer = { stage: afterPointerState.stage, memory: afterPointerState.memory, signatureChanged: afterPointerState.signature !== before.signature };
await field.press('Delete');
const afterPointerLift = await rawPage.evaluate(() => ({ stage: document.querySelector('span[data-stage]').textContent, memory: document.querySelector('span[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
await field.press('Enter');
const afterKeyboard = await rawPage.evaluate(() => ({ stage: document.querySelector('span[data-stage]').textContent, memory: document.querySelector('span[data-memory]').textContent }));
await field.press('Delete');
const afterKeyboardLift = await rawPage.evaluate(() => ({ stage: document.querySelector('span[data-stage]').textContent, memory: document.querySelector('span[data-memory]').textContent }));
await rawPage.locator('[data-gesture="release"]').click();
const afterRelease = await rawPage.evaluate(() => ({ stage: document.querySelector('span[data-stage]').textContent, memory: document.querySelector('span[data-memory]').textContent }));
const rawScreenshot = 'raw-interaction-390x844.png';
await rawPage.screenshot({ path: join(outputDir, rawScreenshot), fullPage: false });
const rawInteraction = {
  before: { stage: before.stage, memory: before.memory, stageHtml: before.stageHtml, memoryHtml: before.memoryHtml },
  afterPointer,
  afterPointerLift: { stage: afterPointerLift.stage, memory: afterPointerLift.memory, signatureRestored: afterPointerLift.signature === before.signature },
  afterKeyboard,
  afterKeyboardLift,
  afterRelease,
  geometry: rawGeometry,
  diagnostics: cleanDiagnostics(rawDiagnostics)
};
recordFailure(!rawGeometry.preview || !rawGeometry.interactivePreview || rawGeometry.scrollWidth > rawGeometry.innerWidth || rawGeometry.buttons.some((button) => button.height < 44), 'raw interaction geometry');
recordFailure(!afterPointer.memory.startsWith('1 seam carried') || !afterPointer.signatureChanged, 'raw pointer interaction');
recordFailure(!afterPointerLift.memory.startsWith('0 seams carried') || afterPointerLift.signature !== before.signature, 'raw pointer lift');
recordFailure(!afterKeyboard.memory.startsWith('1 seam carried') || !afterKeyboardLift.memory.startsWith('0 seams carried'), 'raw keyboard interaction');
recordFailure(!afterRelease.memory.startsWith('0 seams carried') || !afterRelease.stage.includes('stage 01 / 15'), 'raw release interaction');
recordFailure(rawDiagnostics.consoleMessages.length || rawDiagnostics.pageErrors.length || rawDiagnostics.networkFailures.length || rawDiagnostics.httpFailures.length, 'raw interaction runtime');
await rawPage.close();

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const journalDiagnostics = attachDiagnostics(journalPage);
const journalUrl = `${base}/journal/?qa=${stamp}`;
await journalPage.goto(journalUrl, { waitUntil: 'networkidle' });
await journalPage.locator(`#journal-${workId}`).waitFor({ state: 'visible' });
const journalReadback = await journalPage.evaluate(() => {
  const entries = [...document.querySelectorAll('#journal-portrait-2026-09-14')];
  const titleMatches = [...document.querySelectorAll('.journal-entry h3')].filter((element) => element.textContent.trim() === 'The portrait keeps a seam.');
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    entryCount: entries.length,
    titleCount: titleMatches.length,
    href: entries[0]?.querySelector('a')?.getAttribute('href') ?? null
  };
});
const journalScreenshot = 'journal-390x844.png';
await journalPage.screenshot({ path: join(outputDir, journalScreenshot), fullPage: false });
recordFailure(journalReadback.entryCount !== 1 || journalReadback.titleCount !== 1 || journalReadback.href !== `/works/${workId}/#journal`, 'Journal record');
recordFailure(journalReadback.scrollWidth > journalReadback.innerWidth, 'Journal overflow');
recordFailure(journalDiagnostics.consoleMessages.length || journalDiagnostics.pageErrors.length || journalDiagnostics.networkFailures.length || journalDiagnostics.httpFailures.length, 'Journal runtime');
await journalPage.close();

const redirectPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const redirectUrl = `${base}${studyPath}?qa=${stamp}-redirect`;
await redirectPage.goto(redirectUrl, { waitUntil: 'networkidle' });
const directRawRedirect = redirectPage.url();
await redirectPage.close();
recordFailure(!directRawRedirect.endsWith(canonicalPath), 'raw bridge redirect');

const faviconResponse = await fetch(`${base}/studio/favicon.svg?qa=${stamp}`);
const favicon = { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type'), bytes: Number(faviconResponse.headers.get('content-length') ?? 0) };
recordFailure(favicon.status !== 200 || !favicon.contentType?.includes('image/svg+xml'), 'favicon');

await browser.close();
const result = {
  base,
  workId,
  study: studyPath,
  canonicalRoute: canonicalPath,
  status: failures.length ? 'held / failed browser gate' : 'candidate / held for independent caption-free perceptual review and provider revision verification',
  failures,
  observedWith: { browser: 'Playwright + Google Chrome headless', executablePath },
  viewportMatrix,
  staticBlind: { url: staticUrl, readback: staticReadback, screenshot: staticScreenshot, diagnostics: cleanDiagnostics(staticDiagnostics) },
  raw: { url: rawUrl, interaction: rawInteraction, screenshot: rawScreenshot },
  journal: { url: journalUrl, readback: journalReadback, screenshot: journalScreenshot, diagnostics: cleanDiagnostics(journalDiagnostics) },
  directRawRedirect,
  favicon,
  captures: viewportMatrix.map((entry) => entry.screenshot).concat([staticScreenshot, rawScreenshot, journalScreenshot])
};
await writeFile(new URL('./results.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, failures, viewportCount: viewportMatrix.length, staticBlind: staticReadback, raw: rawInteraction, journal: journalReadback, directRawRedirect, favicon, captures: result.captures.length }, null, 2));
if (failures.length) process.exitCode = 1;
