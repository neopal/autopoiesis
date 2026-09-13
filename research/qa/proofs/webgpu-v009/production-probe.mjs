import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const base = 'https://autopoiesis-nine.vercel.app';
const stamp = 'bb873e501933535f053e2284a08d818e07428aeb';
const canonical = `${base}/works/webgpu-2026-09-13/?deploy=${stamp}`;
const journal = `${base}/journal/?deploy=${stamp}`;
const raw = `${base}/studies/webgpu/v009/?preview=1&interaction=1&blind=1&deploy=${stamp}`;
const outputDir = fileURLToPath(new URL('./', import.meta.url));
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const failures = [];
await mkdir(outputDir, { recursive: true });

const jsonResponse = await fetch(`${base}/studio/data/works.json?deploy=${stamp}`, { headers: { 'User-Agent': 'Mutine-QA/1.0' } });
const worksData = await jsonResponse.json();
const recordMatches = worksData.works.filter((work) => work.id === 'webgpu-2026-09-13');
const jsonReadback = { status: jsonResponse.status, contentType: jsonResponse.headers.get('content-type'), recordCount: recordMatches.length, title: recordMatches[0]?.title ?? null, rawPath: recordMatches[0]?.rawPath ?? null, journalAnchor: recordMatches[0]?.journal?.anchor ?? null };
if (jsonResponse.status !== 200 || recordMatches.length !== 1 || jsonReadback.title !== 'The crowd keeps a countercurrent.') failures.push('production works JSON');

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const pageErrors = [];
const networkFailures = [];
const httpFailures = [];
page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('requestfailed', (request) => networkFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
page.on('response', (response) => { if (response.status() >= 400) httpFailures.push(`${response.status()} ${response.url()}`); });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(canonical, { waitUntil: 'networkidle' });
const iframe = page.locator('.work-inspect__stage iframe');
await iframe.waitFor({ state: 'visible' });
const frame = page.frames().find((candidate) => candidate.url().includes('/studies/webgpu/v009/'));
const canonicalReadback = await page.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  workId: document.body.dataset.workId,
  mount: Boolean(document.querySelector('[data-catalog-work-detail="webgpu-2026-09-13"]')),
  tableauFirst: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top <= document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top,
  title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? null
}));
const embeddedReadback = frame ? await frame.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  canvas: Boolean(document.querySelector('#field')?.width),
  preview: document.documentElement.classList.contains('preview-mode'),
  stage: document.querySelector('[data-stage]')?.textContent ?? null,
  memory: document.querySelector('[data-memory]')?.textContent ?? null
})) : null;
const canonicalScreenshot = 'production-canonical-390x844.png';
await page.screenshot({ path: join(outputDir, canonicalScreenshot), fullPage: false });
if (!frame || !canonicalReadback.mount || canonicalReadback.workId !== 'webgpu-2026-09-13' || !canonicalReadback.tableauFirst || canonicalReadback.scrollWidth > canonicalReadback.innerWidth) failures.push('production canonical shell');
if (!embeddedReadback?.canvas || !embeddedReadback.preview || embeddedReadback.scrollWidth > embeddedReadback.innerWidth || embeddedReadback.memory !== '6 countercurrents') failures.push('production embedded tableau');
if (consoleMessages.length || pageErrors.length || networkFailures.length || httpFailures.length) failures.push('production canonical runtime');
await page.close();

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const journalConsole = [];
const journalErrors = [];
const journalNetwork = [];
const journalHttp = [];
journalPage.on('console', (message) => journalConsole.push({ type: message.type(), text: message.text() }));
journalPage.on('pageerror', (error) => journalErrors.push(String(error)));
journalPage.on('requestfailed', (request) => journalNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
journalPage.on('response', (response) => { if (response.status() >= 400) journalHttp.push(`${response.status()} ${response.url()}`); });
await journalPage.goto(journal, { waitUntil: 'networkidle' });
const journalReadback = await journalPage.evaluate(() => {
  const entries = [...document.querySelectorAll('#journal-webgpu-2026-09-13')];
  const titleMatches = [...document.querySelectorAll('.journal-entry h3')].filter((element) => element.textContent.trim() === 'The crowd keeps a countercurrent.');
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    entryCount: entries.length,
    titleCount: titleMatches.length,
    href: entries[0]?.querySelector('a')?.getAttribute('href') ?? null
  };
});
const journalScreenshot = 'production-journal-390x844.png';
await journalPage.screenshot({ path: join(outputDir, journalScreenshot), fullPage: false });
if (journalReadback.entryCount !== 1 || journalReadback.titleCount !== 1 || journalReadback.href !== '/works/webgpu-2026-09-13/#journal' || journalReadback.scrollWidth > journalReadback.innerWidth) failures.push('production Journal');
if (journalConsole.length || journalErrors.length || journalNetwork.length || journalHttp.length) failures.push('production Journal runtime');
await journalPage.close();

const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const rawConsole = [];
const rawErrors = [];
const rawNetwork = [];
const rawHttp = [];
rawPage.on('console', (message) => rawConsole.push({ type: message.type(), text: message.text() }));
rawPage.on('pageerror', (error) => rawErrors.push(String(error)));
rawPage.on('requestfailed', (request) => rawNetwork.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
rawPage.on('response', (response) => { if (response.status() >= 400) rawHttp.push(`${response.status()} ${response.url()}`); });
await rawPage.emulateMedia({ reducedMotion: 'no-preference' });
await rawPage.goto(raw, { waitUntil: 'networkidle' });
const field = rawPage.locator('#field');
await field.waitFor({ state: 'visible' });
const before = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
const rawGeometry = await rawPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, preview: document.documentElement.classList.contains('preview-mode'), interactivePreview: document.documentElement.classList.contains('interactive-preview'), blind: document.documentElement.classList.contains('blind-mode'), buttons: [...document.querySelectorAll('.field-controls button')].map((element) => ({ label: element.textContent.trim(), height: element.getBoundingClientRect().height })) }));
const bounds = await field.boundingBox();
await field.click({ position: { x: bounds.width * 0.55, y: bounds.height * 0.42 } });
const afterPointerState = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
const afterPointer = { stage: afterPointerState.stage, memory: afterPointerState.memory, signatureChanged: afterPointerState.signature !== before.signature };
await field.press('Delete');
const afterPointerLift = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent, signature: document.querySelector('#field').toDataURL() }));
await field.press('Enter');
const afterKeyboard = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
await field.press('Delete');
const afterKeyboardLift = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
await rawPage.locator('[data-gesture="release"]').click();
const afterRelease = await rawPage.evaluate(() => ({ stage: document.querySelector('[data-stage]').textContent, memory: document.querySelector('[data-memory]').textContent }));
const rawScreenshot = 'production-raw-interaction-390x844.png';
await rawPage.screenshot({ path: join(outputDir, rawScreenshot), fullPage: false });
const rawInteraction = { before: { stage: before.stage, memory: before.memory }, afterPointer, afterPointerLift: { stage: afterPointerLift.stage, memory: afterPointerLift.memory, signatureRestored: afterPointerLift.signature === before.signature }, afterKeyboard, afterKeyboardLift, afterRelease, geometry: rawGeometry, consoleMessages: rawConsole, pageErrors: rawErrors, networkFailures: rawNetwork, httpFailures: rawHttp };
if (rawPage.url() !== raw) failures.push('production raw route changed');
if (!rawGeometry.preview || !rawGeometry.interactivePreview || !rawGeometry.blind || rawGeometry.scrollWidth > rawGeometry.innerWidth || rawGeometry.buttons.some((button) => button.height < 44)) failures.push('production raw geometry');
if (afterPointer.memory !== '1 countercurrent' || afterPointer.stage !== 'visitor current / paused' || !afterPointer.signatureChanged) failures.push('production pointer interaction');
if (afterPointerLift.memory !== '0 countercurrents' || afterPointerLift.signature !== before.signature) failures.push('production pointer lift');
if (afterKeyboard.memory !== '1 countercurrent' || afterKeyboard.stage !== 'visitor current / paused' || afterKeyboardLift.memory !== '0 countercurrents') failures.push('production keyboard interaction');
if (afterRelease.memory !== '0 countercurrents' || !afterRelease.stage.includes('stage 01 / 17')) failures.push('production release interaction');
if (rawConsole.length || rawErrors.length || rawNetwork.length || rawHttp.length) failures.push('production raw runtime');
await rawPage.close();

const redirectPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await redirectPage.goto(`${base}/studies/webgpu/v009/`, { waitUntil: 'networkidle' });
const directRawRedirect = redirectPage.url();
await redirectPage.close();
if (!directRawRedirect.endsWith('/works/webgpu-2026-09-13/')) failures.push('production raw bridge redirect');

const faviconResponse = await fetch(`${base}/studio/favicon.svg?deploy=${stamp}`, { headers: { 'User-Agent': 'Mutine-QA/1.0' } });
const favicon = { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type'), bytes: Number(faviconResponse.headers.get('content-length') ?? 0) };
if (favicon.status !== 200 || !favicon.contentType?.includes('image/svg+xml')) failures.push('production favicon');
await browser.close();

const result = {
  stableAlias: base,
  deploymentUrl: null,
  deploymentError: 'Vercel CLI scope-not-accessible',
  observedWith: { browser: 'Playwright + Google Chrome headless', executablePath },
  workId: 'webgpu-2026-09-13',
  study: '/studies/webgpu/v009/',
  canonicalRoute: '/works/webgpu-2026-09-13/',
  status: failures.length ? 'held / failed production gate' : 'candidate / held for independent caption-free perceptual review and provider revision verification',
  failures,
  jsonReadback,
  canonical: { url: canonical, readback: canonicalReadback, embedded: embeddedReadback, consoleMessages, pageErrors, networkFailures, httpFailures, screenshot: canonicalScreenshot },
  journal: { url: journal, readback: journalReadback, consoleMessages: journalConsole, pageErrors: journalErrors, networkFailures: journalNetwork, httpFailures: journalHttp, screenshot: journalScreenshot },
  raw: { url: raw, redirect: directRawRedirect, interaction: rawInteraction, screenshot: rawScreenshot },
  favicon
};
await writeFile(new URL('./production-results.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ status: result.status, failures, jsonReadback, canonical: { readback: canonicalReadback, embedded: embeddedReadback }, journal: journalReadback, raw: rawInteraction, directRawRedirect, favicon }, null, 2));
if (failures.length) process.exitCode = 1;
