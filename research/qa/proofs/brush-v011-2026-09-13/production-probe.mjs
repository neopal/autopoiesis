import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'research/qa/proofs/brush-v011-2026-09-13/production';
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { stableAlias: ROOT };

function observe(page) {
  const events = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => events.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) events.badResponses.push({ url: response.url(), status: response.status() }); });
  return events;
}

async function outerRead(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.work-inspect__stage');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
      title: document.querySelector('.work-inspect__heading h1')?.textContent ?? null,
      tableauBeforeHeading: Boolean(stage && heading && stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length
    };
  });
}

async function studyRead(frame) {
  return frame.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    memory: document.querySelector('[data-memory]')?.textContent ?? null,
    stage: document.querySelector('[data-stage]')?.textContent ?? null,
    buttonHeights: [...document.querySelectorAll('.field-controls button')].map((button) => Math.round(button.getBoundingClientRect().height)),
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display
  }));
}

{
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${ROOT}/studio/data/works.json`, { waitUntil: 'networkidle' });
  const data = await response.json();
  const matching = data.works.filter((work) => work.id === 'brush-2026-09-13');
  results.worksJson = { status: response.status(), count: matching.length, record: matching[0] ?? null, issues };
  await page.close();
  await context.close();
}

{
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${ROOT}/works/brush-2026-09-13/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForSelector('.work-inspect__stage iframe');
  await page.waitForTimeout(100);
  const outer = await outerRead(page);
  const studyFrame = page.frames().find((frame) => frame.url().includes('/studies/p5-brush/v011/'));
  await studyFrame.waitForSelector('#field');
  results.canonical = { status: response.status(), outer, study: await studyRead(studyFrame), issues };
  await page.screenshot({ path: `${proofDir}/canonical-390x844.png`, fullPage: true });
  await page.close();
  await context.close();
}

{
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${ROOT}/journal/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog="journal"][data-ready="true"]');
  results.journal = await page.evaluate((status) => ({
    status,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    entryCount: document.querySelectorAll('#journal-brush-2026-09-13').length,
    title: document.querySelector('#journal-brush-2026-09-13 h3')?.textContent ?? null,
    href: document.querySelector('#journal-brush-2026-09-13 h3 a')?.getAttribute('href') ?? null
  }), response.status());
  results.journal.issues = issues;
  await page.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
  await page.close();
  await context.close();
}

{
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto(`${ROOT}/studies/p5-brush/v011/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const frame = page.mainFrame();
  await frame.waitForSelector('#field');
  const initial = await studyRead(frame);
  const rect = await frame.locator('#field').boundingBox();
  await page.mouse.click(rect.x + rect.width * .64, rect.y + rect.height * .51);
  const afterPointer = await studyRead(frame);
  await frame.locator('#field').press('Enter');
  const afterKeyboard = await studyRead(frame);
  await frame.locator('#lift-siphon').click();
  const afterLift = await studyRead(frame);
  await frame.locator('#lift-siphon').click();
  const afterSecondLift = await studyRead(frame);
  await frame.locator('#release-sequence').click();
  const afterRelease = await studyRead(frame);
  results.rawPreview = { status: response.status(), initial, afterPointer, afterKeyboard, afterLift, afterSecondLift, afterRelease, issues };
  await page.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: false });
  await page.close();
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  const issues = observe(page);
  const response = await page.goto(`${ROOT}/studio/favicon.svg`, { waitUntil: 'networkidle' });
  results.favicon = { status: response.status(), contentType: response.headers()['content-type'] ?? null, issues };
  await page.close();
  await context.close();
}

await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
