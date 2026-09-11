import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');
const base = 'https://autopoiesis-nine.vercel.app';
const canonical = `${base}/works/webgpu-2026-09-11/`;
const outputDir = fileURLToPath(new URL('./', import.meta.url));
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
await mkdir(outputDir, { recursive: true });
const failures = [];
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
const frame = page.frames().find((candidate) => candidate.url().includes('/studies/webgpu/v007/'));
const canonicalReadback = await page.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  workId: document.body.dataset.workId,
  title: document.querySelector('.work-inspect__heading')?.textContent?.trim() ?? '',
  tableauFirst: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top <= document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top,
  mount: document.querySelector('[data-catalog-work-detail="webgpu-2026-09-11"]') !== null
}));
const embeddedReadback = frame ? await frame.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  canvas: Boolean(document.querySelector('#field')?.width),
  stage: document.querySelector('[data-stage]')?.textContent,
  memory: document.querySelector('[data-memory]')?.textContent,
  preview: document.documentElement.classList.contains('preview-mode')
})) : null;
const canonicalScreenshot = 'production-canonical-390x844.png';
await page.screenshot({ path: join(outputDir, canonicalScreenshot), fullPage: false });
if (!frame || !canonicalReadback.mount || canonicalReadback.workId !== 'webgpu-2026-09-11' || !canonicalReadback.tableauFirst) failures.push('production canonical shell');
if (!embeddedReadback?.canvas || embeddedReadback.scrollWidth > embeddedReadback.innerWidth || !embeddedReadback.preview) failures.push('production embedded tableau');
if (canonicalReadback.scrollWidth > canonicalReadback.innerWidth || consoleMessages.length || pageErrors.length || networkFailures.length || httpFailures.length) failures.push('production canonical runtime');
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
await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
const journalReadback = await journalPage.evaluate(() => {
  const entry = document.querySelector('#journal-webgpu-2026-09-11');
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    anchor: Boolean(entry),
    titleCount: document.body.textContent.includes('The crowd counts the gap.') ? 1 : 0,
    href: entry?.querySelector('a')?.getAttribute('href') ?? null
  };
});
const journalScreenshot = 'production-journal-390x844.png';
await journalPage.screenshot({ path: join(outputDir, journalScreenshot), fullPage: false });
if (!journalReadback.anchor || journalReadback.titleCount !== 1 || journalReadback.href !== '/works/webgpu-2026-09-11/#journal') failures.push('production Journal entry');
if (journalReadback.scrollWidth > journalReadback.innerWidth || journalConsole.length || journalErrors.length || journalNetwork.length || journalHttp.length) failures.push('production Journal runtime');
await journalPage.close();

const result = {
  stableAlias: base,
  deploymentUrl: null,
  deploymentMethod: 'manual Vercel deploy not completed; stable alias read back independently after Git push',
  observedWith: { browser: 'Playwright + Google Chrome headless', executablePath },
  canonical: { url: canonical, readback: canonicalReadback, embedded: embeddedReadback, consoleMessages, pageErrors, networkFailures, httpFailures, screenshot: canonicalScreenshot },
  journal: { url: `${base}/journal/`, readback: journalReadback, consoleMessages: journalConsole, pageErrors: journalErrors, networkFailures: journalNetwork, httpFailures: journalHttp, screenshot: journalScreenshot },
  failures
};
await writeFile(new URL('./production-results.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ failures, canonical: { readback: canonicalReadback, embedded: embeddedReadback }, journal: journalReadback, runtime: { canonical: { consoleMessages, pageErrors, networkFailures, httpFailures }, journal: { consoleMessages: journalConsole, pageErrors: journalErrors, networkFailures: journalNetwork, httpFailures: journalHttp } } }, null, 2));
if (failures.length) process.exitCode = 1;
