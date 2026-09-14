import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'research/qa/proofs/naive-art-v010-2026-09-14/production';
const cache = `naive-v010-${Date.now()}`;
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

function observe(page) {
  const events = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => events.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) events.badResponses.push({ url: response.url(), status: response.status() }); });
  return events;
}

async function readOuter(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.work-inspect__stage');
    const heading = document.querySelector('.work-inspect__heading');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      ready: mount?.dataset.ready === 'true',
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
      tableauBeforeHeading: Boolean(stage && heading && stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
      title: document.querySelector('.work-inspect__heading h1')?.textContent ?? null,
      journalHref: document.querySelector('.work-ledger-section a[href*="journal-naive-2026-09-14"]')?.getAttribute('href') ?? null
    };
  });
}

async function studyFrame(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.src.includes('/studies/naive-art/v010/')));
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v010/'));
  if (!frame) throw new Error('production study iframe did not attach');
  await frame.waitForSelector('#field');
  return frame;
}

async function readStudy(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#field');
    const buttons = [...document.querySelectorAll('.field-controls button')];
    const rect = canvas.getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: getComputedStyle(canvas).display !== 'none' && rect.width > 0 && rect.height > 0,
      canvasRect: { width: rect.width, height: rect.height },
      memory: document.querySelector('[data-memory]')?.textContent ?? null,
      stage: document.querySelector('[data-stage]')?.textContent ?? null,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      buttonHeights: buttons.map((button) => Math.round(button.getBoundingClientRect().height)),
      buttonLabels: buttons.map((button) => button.textContent.trim()),
      state: window.__mutineNaiveV010?.getState?.()
    };
  });
}

const jsonResponse = await fetch(`${ROOT}/studio/data/works.json?${cache}`);
const worksJson = await jsonResponse.json();
const matching = worksJson.works.filter((work) => work.id === 'naive-2026-09-14');
const json = {
  status: jsonResponse.status,
  contentType: jsonResponse.headers.get('content-type'),
  matchingCount: matching.length,
  record: matching[0] ? { id: matching[0].id, title: matching[0].title, rawPath: matching[0].rawPath, journalAnchor: matching[0].journal?.anchor } : null
};

const canonicalPage = await browser.newPage();
const canonicalIssues = observe(canonicalPage);
await canonicalPage.setViewportSize({ width: 390, height: 844 });
await canonicalPage.goto(`${ROOT}/works/naive-2026-09-14/?${cache}`, { waitUntil: 'networkidle' });
const canonicalOuter = await readOuter(canonicalPage);
const canonicalFrame = await studyFrame(canonicalPage);
const canonicalStudy = await readStudy(canonicalFrame);
await canonicalPage.screenshot({ path: `${proofDir}/canonical-390x844.png`, fullPage: true });
await canonicalPage.close();

const journalPage = await browser.newPage();
const journalIssues = observe(journalPage);
await journalPage.setViewportSize({ width: 390, height: 844 });
await journalPage.goto(`${ROOT}/journal/?${cache}`, { waitUntil: 'networkidle' });
await journalPage.waitForSelector('#journal-naive-2026-09-14');
const journal = await journalPage.evaluate(() => ({
  status: document.querySelector('#journal-naive-2026-09-14')?.textContent.includes('The mistake keeps a bypass.') ? 200 : 500,
  count: document.querySelectorAll('#journal-naive-2026-09-14').length,
  title: document.querySelector('#journal-naive-2026-09-14 h3')?.textContent.trim() ?? null,
  href: document.querySelector('#journal-naive-2026-09-14 h3 a')?.getAttribute('href') ?? null,
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await journalPage.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
await journalPage.close();

const rawPage = await browser.newPage();
const rawIssues = observe(rawPage);
await rawPage.setViewportSize({ width: 390, height: 844 });
await rawPage.goto(`${ROOT}/studies/naive-art/v010/?preview=1&interaction=1&${cache}`, { waitUntil: 'networkidle' });
const rawFrame = rawPage.mainFrame();
await rawFrame.waitForSelector('#field');
const rawInitialOuter = await rawPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
const rawInitial = await readStudy(rawFrame);
const initialImage = await rawFrame.locator('#field').evaluate((canvas) => canvas.toDataURL());
const rect = await rawFrame.locator('#field').boundingBox();
await rawPage.mouse.click(rect.x + rect.width * .64, rect.y + rect.height * .51);
const afterPointer = await readStudy(rawFrame);
const pointerImage = await rawFrame.locator('#field').evaluate((canvas) => canvas.toDataURL());
await rawFrame.locator('#field').press('Enter');
const afterKeyboard = await readStudy(rawFrame);
const afterKeyboardImage = await rawFrame.locator('#field').evaluate((canvas) => canvas.toDataURL());
await rawFrame.locator('#undo-control').click();
const afterLift = await readStudy(rawFrame);
const afterLiftImage = await rawFrame.locator('#field').evaluate((canvas) => canvas.toDataURL());
await rawFrame.locator('#undo-control').click();
const afterSecondLift = await readStudy(rawFrame);
await rawFrame.locator('#release-control').click();
const afterRelease = await readStudy(rawFrame);
await rawPage.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: false });
const raw = {
  initialOuter: rawInitialOuter,
  initial: rawInitial,
  afterPointer,
  afterKeyboard,
  afterLift,
  afterSecondLift,
  afterRelease,
  canvasChangedOnPointer: pointerImage !== initialImage,
  canvasChangedOnKeyboard: afterKeyboardImage !== pointerImage,
  liftRestoredPointerState: afterLiftImage === pointerImage,
  secondLiftReturnedToZero: afterSecondLift.memory === '0 bypasses retained',
  releaseReturnedToZero: afterRelease.memory === '0 bypasses retained'
};
await rawPage.close();

const faviconResponse = await fetch(`${ROOT}/studio/favicon.svg?${cache}`);
const favicon = { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type') };
const result = {
  generatedAt: new Date().toISOString(),
  stableAlias: ROOT,
  json,
  canonical: { outer: canonicalOuter, study: canonicalStudy, issues: canonicalIssues },
  journal: { readback: journal, issues: journalIssues },
  raw: { ...raw, issues: rawIssues },
  favicon
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify(result, null, 2));
