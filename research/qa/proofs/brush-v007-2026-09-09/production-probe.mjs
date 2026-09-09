import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'research/qa/proofs/brush-v007-2026-09-09';
const browser = await chromium.launch({ headless: true });
const result = { base, routes: {}, pass: false };

async function probePage(path, callback) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const evidence = await callback(page);
  const route = {
    status: response.status(),
    consoleMessages,
    pageErrors,
    failedRequests,
    httpErrors,
    ...evidence
  };
  await context.close();
  return route;
}

result.routes.worksJson = await probePage('/studio/data/works.json', async (page) => {
  const body = await page.locator('body').textContent();
  const data = JSON.parse(body);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-09');
  return { record: { id: work?.id, title: work?.title, rawPath: work?.rawPath, journalAnchor: work?.journal?.anchor } };
});

result.routes.journal = await probePage('/journal/', async (page) => {
  const anchor = page.locator('#journal-brush-2026-09-09');
  await anchor.waitFor();
  return {
    renderedAnchorCount: await anchor.count(),
    renderedTitle: await anchor.locator('h3').textContent(),
    renderedNote: await anchor.locator('p').nth(1).textContent()
  };
});

result.routes.canonical = await probePage('/works/brush-2026-09-09/', async (page) => {
  const mount = page.locator('[data-catalog-work-detail="brush-2026-09-09"]');
  await mount.locator('.work-inspect__stage iframe').waitFor();
  const frame = mount.locator('.work-inspect__stage iframe').contentFrame();
  await frame.locator('#field').waitFor();
  return {
    bodyWorkId: await page.locator('body').getAttribute('data-work-id'),
    renderedTitle: await mount.locator('.work-inspect__heading h1').textContent(),
    iframeCount: await mount.locator('.work-inspect__stage iframe').count(),
    tableauCanvas: await frame.locator('#field').count(),
    scrollWidth: await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  };
});

result.routes.rawPreview = await probePage('/studies/p5-brush/v007/?preview=1&interaction=1', async (page) => {
  await page.locator('#field').waitFor();
  const before = await page.locator('[data-memory]').textContent();
  await page.locator('#make-capillary').click();
  const after = await page.locator('[data-memory]').textContent();
  const stateAfter = await page.locator('[data-stage]').textContent();
  return {
    previewClass: await page.locator('html.preview-mode').count() === 1,
    interactiveClass: await page.locator('html.interactive-preview').count() === 1,
    furnitureHidden: await page.locator('.studio-header').evaluate((node) => getComputedStyle(node).display === 'none'),
    canvas: await page.locator('#field').count(),
    controls: await page.locator('button').count(),
    memoryBefore: before,
    memoryAfterPointer: after,
    stateAfter,
    scrollWidth: await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
  };
});

result.pass = result.routes.worksJson.status === 200
  && result.routes.worksJson.record.id === 'brush-2026-09-09'
  && result.routes.journal.status === 200
  && result.routes.journal.renderedAnchorCount === 1
  && result.routes.journal.renderedTitle === 'The brush drinks the wound.'
  && result.routes.canonical.status === 200
  && result.routes.canonical.bodyWorkId === 'brush-2026-09-09'
  && result.routes.canonical.renderedTitle === 'The brush drinks the wound.'
  && result.routes.canonical.iframeCount === 1
  && result.routes.canonical.tableauCanvas === 1
  && result.routes.rawPreview.status === 200
  && result.routes.rawPreview.previewClass
  && result.routes.rawPreview.interactiveClass
  && result.routes.rawPreview.furnitureHidden
  && result.routes.rawPreview.canvas === 1
  && result.routes.rawPreview.controls === 3
  && result.routes.rawPreview.memoryBefore === '6 capillary seams remembered'
  && result.routes.rawPreview.memoryAfterPointer === '6 capillary seams remembered'
  && result.routes.rawPreview.stateAfter === 'seam made / paused'
  && Object.values(result.routes).every((route) => route.pageErrors.length === 0 && route.failedRequests.length === 0 && route.httpErrors.length === 0 && route.consoleMessages.length === 0);

await writeFile(`${proofDir}/production-results.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (!result.pass) process.exitCode = 1;
