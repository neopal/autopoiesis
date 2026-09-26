import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'C:/Users/ASUS/autopoiesis/research/qa/proofs/typography-v016-2026-09-26-production';
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
    const runtime = window.__mutineHandwritingV016?.getState?.() ?? (iframeBox && iframeBox.width ? (document.querySelector('iframe')?.contentWindow?.__mutineHandwritingV016?.getState?.() ?? null) : null);
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
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await waitForStable(page, waitSelector);
  const metrics = await readMetrics(page);
  await page.screenshot({ path: `${proofDir}/${screenshotName}`, fullPage: true });
  await page.close();
  return { url, viewport: [width, height], reducedMotion, metrics, diagnostics: { consoleMessages, pageErrors, failedRequests, badResponses } };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
for (const reducedMotion of [false, true]) {
  for (const [width, height] of viewports) {
    results.push(await collectPage(browser, `${BASE}/works/typography-2026-09-26/`, width, height, reducedMotion, `canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`, '.work-inspect'));
    results.push(await collectPage(browser, `${BASE}/studies/handwriting/v016/?preview=1&interaction=1`, width, height, reducedMotion, `raw-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`, '#piece'));
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const interactionDiagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
interactionPage.on('console', (message) => interactionDiagnostics.consoleMessages.push({ type: message.type(), text: message.text() }));
interactionPage.on('pageerror', (error) => interactionDiagnostics.pageErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionDiagnostics.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
interactionPage.on('response', (response) => { if (response.status() >= 400) interactionDiagnostics.badResponses.push({ url: response.url(), status: response.status() }); });
await interactionPage.goto(`${BASE}/studies/handwriting/v016/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
await waitForStable(interactionPage, '#piece');
const initial = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV016.getState(), signature: window.__mutineHandwritingV016.getSvgSignature(), metrics: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth } }));
const svgBox = await interactionPage.locator('#piece').boundingBox();
await interactionPage.mouse.click(svgBox.x + svgBox.width * 0.5, svgBox.y + svgBox.height * 0.5);
const afterShortClick = await interactionPage.evaluate(() => window.__mutineHandwritingV016.getState());
await interactionPage.mouse.move(svgBox.x + svgBox.width * 0.22, svgBox.y + svgBox.height * 0.52);
await interactionPage.mouse.down();
await interactionPage.mouse.move(svgBox.x + svgBox.width * 0.67, svgBox.y + svgBox.height * 0.37, { steps: 3 });
await interactionPage.mouse.up();
const afterDrag = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV016.getState(), signature: window.__mutineHandwritingV016.getSvgSignature() }));
await interactionPage.locator('#piece').focus();
await interactionPage.keyboard.press('Enter');
const afterEnter = await interactionPage.evaluate(() => window.__mutineHandwritingV016.getState());
const signatureBeforeLift = await interactionPage.evaluate(() => window.__mutineHandwritingV016.getSvgSignature());
await interactionPage.keyboard.press('Delete');
const afterDelete = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV016.getState(), signature: window.__mutineHandwritingV016.getSvgSignature() }));
await interactionPage.keyboard.press('r');
const afterRelease = await interactionPage.evaluate(() => window.__mutineHandwritingV016.getState());
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
await interactionPage.close();

const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await blindPage.goto(`${BASE}/studies/handwriting/v016/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitForStable(blindPage, '#piece');
const blind = await blindPage.evaluate(() => ({
  state: window.__mutineHandwritingV016.getState(),
  svgVisible: getComputedStyle(document.querySelector('#piece')).display !== 'none',
  panelVisible: getComputedStyle(document.querySelector('.interaction-panel')).display !== 'none',
  cornerVisible: getComputedStyle(document.querySelector('.canvas-corner')).display !== 'none',
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await blindPage.screenshot({ path: `${proofDir}/static-blind-390x844.png`, fullPage: true });
await blindPage.close();

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await journalPage.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
await waitForStable(journalPage, '#journal-typography-2026-09-26');
const journal = await journalPage.evaluate(() => ({
  count: document.querySelectorAll('#journal-typography-2026-09-26').length,
  title: document.querySelector('#journal-typography-2026-09-26 h2, #journal-typography-2026-09-26 h3')?.textContent?.trim() ?? null,
  href: document.querySelector('#journal-typography-2026-09-26 a[href*="typography-2026-09-26"]')?.getAttribute('href') ?? null,
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await journalPage.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
await journalPage.close();

const currentPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
await currentPage.goto(`${BASE}/currents/handwriting/`, { waitUntil: 'networkidle' });
await waitForStable(currentPage, '[data-catalog-current]');
const current = await currentPage.evaluate(() => ({
  headers: document.querySelectorAll('[data-catalog-current-header]').length,
  firstArtwork: document.querySelectorAll('.catalog-card, .home-current__art').length,
  date: document.querySelector('time[datetime="2026-09-26"]')?.getAttribute('datetime') ?? null,
  metrics: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
}));
await currentPage.screenshot({ path: `${proofDir}/current-handwriting-390x844.png`, fullPage: true });
await currentPage.close();

await browser.close();
const summary = {
  route: `${BASE}/works/typography-2026-09-26/`,
  viewports,
  matrixCount: results.length,
  results,
  interaction: {
    initial,
    afterShortClick,
    afterDrag,
    afterEnter,
    signatureBeforeLift,
    afterDelete,
    afterRelease,
    diagnostics: interactionDiagnostics
  },
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
