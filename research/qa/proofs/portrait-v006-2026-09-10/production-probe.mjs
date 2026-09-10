import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const proofPath = 'research/qa/proofs/portrait-v006-2026-09-10/production-results.json';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
const results = {};

async function probe(path, callback, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const evidence = await callback(page);
  const result = { status: response.status(), consoleMessages, pageErrors, failedRequests, badResponses, ...evidence };
  await context.close();
  return result;
}

results.worksJson = await probe('/studio/data/works.json', async (page) => {
  const data = JSON.parse(await page.locator('body').textContent());
  const work = data.works.find((entry) => entry.id === 'portrait-2026-09-10');
  return { record: { id: work?.id, title: work?.title, rawPath: work?.rawPath, journalAnchor: work?.journal?.anchor } };
});

results.journal = await probe('/journal/', async (page) => {
  const anchor = page.locator('#journal-portrait-2026-09-10');
  await anchor.waitFor({ state: 'visible' });
  return {
    renderedAnchorCount: await anchor.count(),
    renderedTitle: await anchor.locator('h3').textContent(),
    renderedNote: await anchor.locator('p').nth(1).textContent()
  };
});

results.canonical = await probe('/works/portrait-2026-09-10/', async (page) => {
  const mount = page.locator('[data-catalog-work-detail="portrait-2026-09-10"]');
  const iframe = mount.locator('.work-inspect__stage iframe');
  await iframe.waitFor({ state: 'visible' });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v006/'));
  if (!frame) throw new Error('deployed v006 iframe missing');
  await frame.locator('#field').waitFor({ state: 'visible' });
  return {
    renderedTitle: await mount.locator('.work-inspect__heading h1').textContent(),
    iframeCount: await iframe.count(),
    tableauCanvas: await frame.locator('#field').count(),
    topGeometry: await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
    frameGeometry: await frame.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, state: window.__mutinePortraitV006?.getState() }))
  };
});

results.rawPreview = await probe('/studies/self-portrait/v006/?preview=1&interaction=1', async (page) => {
  await page.locator('#field').waitFor({ state: 'visible' });
  const before = await page.evaluate(() => window.__mutinePortraitV006.getState());
  await page.locator('#fold-control').click();
  const after = await page.evaluate(() => window.__mutinePortraitV006.getState());
  return {
    previewClass: await page.locator('html.preview-mode').count() === 1,
    interactiveClass: await page.locator('html.interactive-preview').count() === 1,
    furnitureHidden: await page.locator('.studio-header').evaluate((node) => getComputedStyle(node).display === 'none'),
    controls: await page.locator('button').count(),
    before,
    after,
    geometry: await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  };
}, 'no-preference');

results.favicon = await probe('/favicon.ico', async () => ({ icon: true }));
await browser.close();

const pass = results.worksJson.status === 200
  && results.worksJson.record.id === 'portrait-2026-09-10'
  && results.journal.status === 200
  && results.journal.renderedAnchorCount === 1
  && results.journal.renderedTitle === 'The face folds around its decision.'
  && results.canonical.status === 200
  && results.canonical.renderedTitle === 'The face folds around its decision.'
  && results.canonical.iframeCount === 1
  && results.canonical.tableauCanvas === 1
  && results.rawPreview.status === 200
  && results.rawPreview.previewClass
  && results.rawPreview.interactiveClass
  && results.rawPreview.furnitureHidden
  && results.rawPreview.controls === 3
  && results.rawPreview.after.memory === 1
  && results.favicon.status === 200
  && Object.values(results).every((route) => route.pageErrors.length === 0 && route.failedRequests.length === 0 && route.badResponses.length === 0 && route.consoleMessages.length === 0);
const output = { base, status: pass ? 'passed' : 'failed', results };
await mkdir('research/qa/proofs/portrait-v006-2026-09-10', { recursive: true });
await writeFile(proofPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (!pass) process.exitCode = 1;
