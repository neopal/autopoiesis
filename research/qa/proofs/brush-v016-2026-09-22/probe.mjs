import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4174';
const proofDir = new URL('./', import.meta.url);
const proofPath = decodeURIComponent(proofDir.pathname).replace(/^\//, '').replaceAll('/', '/');
await mkdir(proofPath, { recursive: true });

const viewports = [
  { width: 320, height: 568, name: '320x568' },
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1920, height: 1080, name: '1920x1080' }
];

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const issues = [];
const screenshots = [];
const canonicalRuns = [];
const rawRuns = [];

function attachDiagnostics(page, route) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  issues.push({ route, consoleMessages, pageErrors, failedRequests, badResponses });
  return issues.at(-1);
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(140);
}

async function viewportEvidence(page, url, viewport, reducedMotion, screenshotName, selector) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(selector);
  await settle(page);
  const evidence = await page.evaluate(() => {
    const first = document.querySelector('iframe, canvas');
    const heading = document.querySelector('.work-inspect__heading h1, #work-title');
    const rect = first?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstTag: first?.tagName ?? null,
      firstTop: rect?.top ?? null,
      headingTop: headingRect?.top ?? null,
      bodyHeight: document.body.getBoundingClientRect().height
    };
  });
  await page.screenshot({ path: `${proofPath}/${screenshotName}`, fullPage: true });
  screenshots.push(screenshotName);
  return { viewport: viewport.name, reducedMotion, ...evidence };
}

const canonical = await browser.newPage();
attachDiagnostics(canonical, 'canonical');
for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    canonicalRuns.push(await viewportEvidence(
      canonical,
      `${base}/works/brush-2026-09-22/`,
      viewport,
      reducedMotion,
      `canonical-${viewport.name}-${reducedMotion ? 'reduced' : 'normal'}.png`,
      '[data-catalog-work-detail] .work-inspect__stage iframe'
    ));
  }
}

const raw = await browser.newPage();
attachDiagnostics(raw, 'raw');
for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    rawRuns.push(await viewportEvidence(
      raw,
      `${base}/studies/p5-brush/v016/?preview=1&interaction=1`,
      viewport,
      reducedMotion,
      `raw-${viewport.name}-${reducedMotion ? 'reduced' : 'normal'}.png`,
      '#field'
    ));
  }
}

await raw.setViewportSize({ width: 390, height: 844 });
await raw.emulateMedia({ reducedMotion: 'no-preference' });
await raw.goto(`${base}/studies/p5-brush/v016/?preview=1&interaction=1&cache=interaction`, { waitUntil: 'domcontentloaded' });
await raw.waitForSelector('#field');
await settle(raw);
const initialInteraction = await raw.evaluate(() => ({
  state: window.__mutineBrushV016.getState(),
  image: document.querySelector('#field').toDataURL('image/png')
}));
const rect = await raw.locator('#field').boundingBox();
await raw.mouse.move(rect.x + rect.width * .2, rect.y + rect.height * .28);
await raw.mouse.down();
await raw.mouse.move(rect.x + rect.width * .48, rect.y + rect.height * .49, { steps: 4 });
await raw.mouse.move(rect.x + rect.width * .8, rect.y + rect.height * .64, { steps: 4 });
await raw.mouse.up();
await raw.waitForTimeout(60);
const pointerInteraction = await raw.evaluate(() => ({
  state: window.__mutineBrushV016.getState(),
  image: document.querySelector('#field').toDataURL('image/png')
}));
await raw.locator('#field').focus();
await raw.keyboard.press('Enter');
await raw.waitForTimeout(60);
const keyboardInteraction = await raw.evaluate(() => window.__mutineBrushV016.getState());
await raw.keyboard.press('Delete');
await raw.waitForTimeout(60);
const liftedInteraction = await raw.evaluate(() => ({
  state: window.__mutineBrushV016.getState(),
  image: document.querySelector('#field').toDataURL('image/png')
}));
await raw.keyboard.press('r');
await raw.waitForTimeout(60);
const releasedInteraction = await raw.evaluate(() => window.__mutineBrushV016.getState());
await raw.screenshot({ path: `${proofPath}/raw-interaction-390x844.png` });
screenshots.push('raw-interaction-390x844.png');

const blind = await browser.newPage();
attachDiagnostics(blind, 'blind');
await blind.setViewportSize({ width: 390, height: 844 });
await blind.emulateMedia({ reducedMotion: 'reduce' });
await blind.goto(`${base}/studies/p5-brush/v016/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
await blind.waitForSelector('#field');
await settle(blind);
const blindEvidence = await blind.evaluate(() => {
  const canvas = document.querySelector('#field');
  const readout = document.querySelector('.field-readout');
  const controls = document.querySelector('.field-controls');
  return {
    canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0),
    readoutDisplay: getComputedStyle(readout).display,
    controlsDisplay: getComputedStyle(controls).display,
    width: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineBrushV016.getState()
  };
});
await blind.screenshot({ path: `${proofPath}/static-blind-390x844.png` });
screenshots.push('static-blind-390x844.png');

const journal = await browser.newPage();
attachDiagnostics(journal, 'journal');
await journal.setViewportSize({ width: 390, height: 844 });
await journal.goto(`${base}/journal/`, { waitUntil: 'domcontentloaded' });
await journal.waitForSelector('#journal-brush-2026-09-22');
await settle(journal);
const journalEvidence = await journal.evaluate(() => ({
  count: document.querySelectorAll('#journal-brush-2026-09-22').length,
  title: document.querySelector('#journal-brush-2026-09-22 h2, #journal-brush-2026-09-22 h3')?.textContent?.trim() ?? null,
  href: document.querySelector('#journal-brush-2026-09-22 a[href*="/works/brush-2026-09-22/"]')?.getAttribute('href') ?? null,
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await journal.screenshot({ path: `${proofPath}/journal-390x844.png`, fullPage: true });
screenshots.push('journal-390x844.png');

const current = await browser.newPage();
attachDiagnostics(current, 'current');
await current.setViewportSize({ width: 390, height: 844 });
await current.goto(`${base}/currents/brush/`, { waitUntil: 'domcontentloaded' });
await current.waitForSelector('[data-catalog-current="brush"]');
await settle(current);
const currentEvidence = await current.evaluate(() => ({
  headerCount: document.querySelectorAll('[data-catalog-current-header="brush"] .catalog-current-header__title').length,
  workCount: document.querySelectorAll('[data-work-id="brush-2026-09-22"]').length,
  href: document.querySelector('[data-work-id="brush-2026-09-22"] a')?.getAttribute('href') ?? null,
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await current.screenshot({ path: `${proofPath}/current-brush-390x844.png`, fullPage: true });
screenshots.push('current-brush-390x844.png');

const registerResponse = await current.request.get(`${base}/studio/data/works.json`);
const registerJson = await registerResponse.json();
const registerMatches = registerJson.works.filter((work) => work.id === 'brush-2026-09-22');

const result = {
  canonicalRuns,
  rawRuns,
  initialInteraction,
  pointerInteraction,
  keyboardInteraction,
  liftedInteraction,
  releasedInteraction,
  interactionAssertions: {
    pointerAddedCut: pointerInteraction.state.memory === 1 && pointerInteraction.image !== initialInteraction.image,
    keyboardAddedCut: keyboardInteraction.memory === 2,
    deleteRestoredPointerState: liftedInteraction.state.memory === 1 && liftedInteraction.image === pointerInteraction.image,
    releaseClearedMemory: releasedInteraction.memory === 0 && releasedInteraction.paused === false
  },
  blindEvidence,
  journalEvidence,
  currentEvidence,
  register: {
    status: registerResponse.status(),
    matchCount: registerMatches.length,
    record: registerMatches[0] ?? null
  },
  issues,
  screenshots,
  viewportCount: canonicalRuns.length + rawRuns.length
};

await writeFile(`${proofPath}/results.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  viewportCount: result.viewportCount,
  canonicalPasses: canonicalRuns.filter((run) => run.innerWidth === run.clientWidth && run.scrollWidth === run.innerWidth).length,
  rawPasses: rawRuns.filter((run) => run.innerWidth === run.clientWidth && run.scrollWidth === run.innerWidth).length,
  interactionAssertions: result.interactionAssertions,
  blindEvidence,
  journalEvidence,
  currentEvidence,
  register: result.register,
  issueCounts: issues.map((entry) => ({ route: entry.route, console: entry.consoleMessages.length, pageErrors: entry.pageErrors.length, failedRequests: entry.failedRequests.length, badResponses: entry.badResponses.length }))
}, null, 2));
await browser.close();
