import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.MUTINE_BASE_URL ?? 'http://127.0.0.1:4188';
const proofDir = process.env.MUTINE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/typography-v017-2026-09-27';
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
await mkdir(proofDir, { recursive: true });

async function waitForStable(page, selector = 'body') {
  await page.waitForSelector(selector, { state: 'visible' });
  await page.waitForFunction(() => document.fonts?.status !== 'loading');
  await page.waitForTimeout(90);
}

async function readMetrics(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
    };
    const frameBox = rect('.artwork-frame');
    const firstArtwork = rect('.work-inspect__stage');
    const headingBox = rect('.work-inspect__heading');
    const iframeBox = rect('iframe');
    const runtime = window.__mutineHandwritingV017?.getState?.() ?? (iframeBox && iframeBox.width ? (document.querySelector('iframe')?.contentWindow?.__mutineHandwritingV017?.getState?.() ?? null) : null);
    const touchTargets = [...document.querySelectorAll('button')].map((node) => {
      const box = node.getBoundingClientRect();
      return { id: node.id, width: box.width, height: box.height };
    });
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      frame: frameBox,
      firstArtwork,
      heading: headingBox,
      iframe: iframeBox,
      tableauFirst: iframeBox && headingBox ? iframeBox.y < headingBox.y : null,
      runtime,
      touchTargets,
      issues: { body: document.body?.dataset?.error ?? null }
    };
  });
}

async function collectPage(browser, url, width, height, reducedMotion, screenshotName, waitSelector = 'body') {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  await waitForStable(page, waitSelector);
  const metrics = await readMetrics(page);
  await page.screenshot({ path: `${proofDir}/${screenshotName}`, fullPage: true });
  await context.close();
  return { url, viewport: [width, height], reducedMotion, responseStatus: response?.status() ?? null, metrics, diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses } };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const reducedMotion of [false, true]) {
  for (const [width, height] of viewports) {
    results.push(await collectPage(browser, `${BASE}/works/typography-2026-09-27/`, width, height, reducedMotion, `canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`, '.work-inspect'));
    results.push(await collectPage(browser, `${BASE}/studies/handwriting/v017/?preview=1&interaction=1`, width, height, reducedMotion, `raw-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`, '#piece'));
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const interactionPage = await interactionContext.newPage();
const interactionDiagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
interactionPage.on('console', (message) => interactionDiagnostics.consoleMessages.push({ type: message.type(), text: message.text() }));
interactionPage.on('pageerror', (error) => interactionDiagnostics.pageErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionDiagnostics.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
interactionPage.on('response', (response) => { if (response.status() >= 400) interactionDiagnostics.badResponses.push({ url: response.url(), status: response.status() }); });
await interactionPage.goto(`${BASE}/studies/handwriting/v017/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
await waitForStable(interactionPage, '#piece');
const initial = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV017.getState(), signature: window.__mutineHandwritingV017.getSignature(), metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth } }));
const fieldBox = await interactionPage.locator('#piece').boundingBox();
await interactionPage.mouse.click(fieldBox.x + fieldBox.width * 0.34, fieldBox.y + fieldBox.height * 0.28);
const afterTap = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV017.getState(), signature: window.__mutineHandwritingV017.getSignature() }));
await interactionPage.locator('#piece').focus();
await interactionPage.keyboard.press('Enter');
const afterEnter = await interactionPage.evaluate(() => window.__mutineHandwritingV017.getState());
const signatureBeforeLift = await interactionPage.evaluate(() => window.__mutineHandwritingV017.getSignature());
await interactionPage.keyboard.press('Delete');
const afterDelete = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV017.getState(), signature: window.__mutineHandwritingV017.getSignature() }));
await interactionPage.keyboard.press('r');
const afterRelease = await interactionPage.evaluate(() => window.__mutineHandwritingV017.getState());
const interactionTargets = await interactionPage.evaluate(() => [...document.querySelectorAll('button')].map((node) => { const box = node.getBoundingClientRect(); return { id: node.id, width: box.width, height: box.height }; }));
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
await blindPage.goto(`${BASE}/studies/handwriting/v017/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitForStable(blindPage, '#piece');
const blind = await blindPage.evaluate(() => ({
  state: window.__mutineHandwritingV017.getState(),
  fieldVisible: getComputedStyle(document.querySelector('#piece')).display !== 'none',
  panelVisible: getComputedStyle(document.querySelector('.interaction-panel')).display !== 'none',
  cornerVisible: getComputedStyle(document.querySelector('.field-corner')).display !== 'none',
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await blindPage.screenshot({ path: `${proofDir}/static-blind-390x844.png`, fullPage: true });
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
await journalPage.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
await waitForStable(journalPage, '#journal-typography-2026-09-27');
const journal = await journalPage.evaluate(() => ({
  count: document.querySelectorAll('#journal-typography-2026-09-27').length,
  title: document.querySelector('#journal-typography-2026-09-27 h2, #journal-typography-2026-09-27 h3')?.textContent?.trim() ?? null,
  href: document.querySelector('#journal-typography-2026-09-27 a[href*="typography-2026-09-27"]')?.getAttribute('href') ?? null,
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await journalPage.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
await journalContext.close();

const currentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const currentPage = await currentContext.newPage();
await currentPage.goto(`${BASE}/currents/handwriting/`, { waitUntil: 'networkidle' });
await waitForStable(currentPage, '[data-catalog-current]');
const current = await currentPage.evaluate(() => ({
  headers: document.querySelectorAll('[data-catalog-current-header]').length,
  firstArtwork: document.querySelectorAll('.catalog-card, .home-current__art').length,
  date: document.querySelector('time[datetime="2026-09-27"]')?.getAttribute('datetime') ?? null,
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await currentPage.screenshot({ path: `${proofDir}/current-handwriting-390x844.png`, fullPage: true });
await currentContext.close();

await browser.close();
const summary = {
  route: `${BASE}/works/typography-2026-09-27/`,
  viewports,
  matrixCount: results.length,
  results,
  interaction: { initial, afterTap, afterEnter, signatureBeforeLift, afterDelete, afterRelease, interactionTargets, diagnostics: interactionDiagnostics },
  blind,
  journal,
  current
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(summary, null, 2));
await writeFile(`${proofDir}/summary.json`, JSON.stringify({
  matrixCount: results.length,
  diagnostics: results.reduce((sum, item) => sum + item.diagnostics.consoleMessages.length + item.diagnostics.pageErrors.length + item.diagnostics.failedRequests.length + item.diagnostics.badResponses.length, 0),
  viewportOverflow: results.filter((item) => item.metrics.scrollWidth > item.metrics.clientWidth).length,
  interaction: summary.interaction,
  blind,
  journal,
  current
}, null, 2));
console.log(JSON.stringify({ matrixCount: results.length, interaction: summary.interaction, blind, journal, current }, null, 2));