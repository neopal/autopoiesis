import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'research/qa/proofs/naive-art-v009-2026-09-13/production';
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
    const overflow = [...document.querySelectorAll('*')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { element: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''), left: rect.left, right: rect.right };
    }).filter((item) => item.left < -1 || item.right > innerWidth + 1);
    const stage = document.querySelector('.work-inspect__stage');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow,
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true',
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
      tableauBeforeHeading: Boolean(stage && heading && stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
      title: document.querySelector('.work-inspect__heading h1')?.textContent ?? null
    };
  });
}
async function readStudy(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#field');
    const wrap = document.querySelector('.field-wrap');
    const state = window.__mutineNaiveV009?.getState?.();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: getComputedStyle(canvas).display !== 'none' && canvas.getBoundingClientRect().width > 0,
      canvasRect: (() => { const rect = canvas.getBoundingClientRect(); return { width: rect.width, height: rect.height }; })(),
      wrapRect: (() => { const rect = wrap.getBoundingClientRect(); return { width: rect.width, height: rect.height }; })(),
      memory: document.querySelector('[data-memory]')?.textContent ?? null,
      stage: document.querySelector('[data-stage]')?.textContent ?? null,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      buttonHeights: [...document.querySelectorAll('.field-controls button')].map((button) => Math.round(button.getBoundingClientRect().height)),
      state
    };
  });
}
async function findStudyFrame(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.src.includes('/studies/naive-art/v009/')));
  await page.waitForTimeout(100);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v009/'));
  if (!frame) throw new Error('production study iframe did not attach');
  await frame.waitForSelector('#field');
  return frame;
}

const results = { json: null, canonical: null, journal: null, raw: null, favicon: null };
const jsonResponse = await fetch(`${ROOT}/studio/data/works.json`);
const json = await jsonResponse.json();
const matches = json.works.filter((work) => work.id === 'naive-2026-09-13');
results.json = { status: jsonResponse.status, contentType: jsonResponse.headers.get('content-type'), recordMatches: matches.length, title: matches[0]?.title ?? null, rawPath: matches[0]?.rawPath ?? null, journalAnchor: matches[0]?.journal?.anchor ?? null };

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const issues = observe(page);
  await page.goto(`${ROOT}/works/naive-2026-09-13/`, { waitUntil: 'networkidle' });
  const outer = await readOuter(page);
  const frame = await findStudyFrame(page);
  const study = await readStudy(frame);
  await page.screenshot({ path: `${proofDir}/canonical-390x844.png`, fullPage: true });
  results.canonical = { outer, study, issues };
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const issues = observe(page);
  await page.goto(`${ROOT}/journal/`, { waitUntil: 'networkidle' });
  const journal = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('#journal-naive-2026-09-13')];
    return { status: document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true', entryCount: entries.length, title: entries[0]?.querySelector('h3')?.textContent ?? null, href: entries[0]?.querySelector('h3 a')?.getAttribute('href') ?? null, innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
  results.journal = { journal, issues };
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const issues = observe(page);
  await page.goto(`${ROOT}/studies/naive-art/v009/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const frame = page.mainFrame();
  await frame.waitForSelector('#field');
  const initialOuter = await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  const initial = await readStudy(frame);
  const initialImage = await frame.locator('#field').evaluate((canvas) => canvas.toDataURL());
  const rect = await frame.locator('#field').boundingBox();
  await page.mouse.click(rect.x + rect.width * .64, rect.y + rect.height * .51);
  const afterPointer = await readStudy(frame);
  const pointerImage = await frame.locator('#field').evaluate((canvas) => canvas.toDataURL());
  await frame.locator('#field').press('Enter');
  const afterKeyboard = await readStudy(frame);
  const afterKeyboardImage = await frame.locator('#field').evaluate((canvas) => canvas.toDataURL());
  await frame.locator('#undo-control').click();
  const afterLift = await readStudy(frame);
  const afterLiftImage = await frame.locator('#field').evaluate((canvas) => canvas.toDataURL());
  await frame.locator('#undo-control').click();
  const afterSecondLift = await readStudy(frame);
  await frame.locator('#release-control').click();
  const afterRelease = await readStudy(frame);
  await page.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: false });
  results.raw = {
    initialOuter,
    initial,
    afterPointer,
    afterKeyboard,
    afterLift,
    afterSecondLift,
    afterRelease,
    canvasChangedOnPointer: pointerImage !== initialImage,
    canvasChangedOnKeyboard: afterKeyboardImage !== pointerImage,
    liftRestoredPointerState: afterLiftImage === pointerImage,
    secondLiftReturnedToZero: afterSecondLift.memory === '0 doorways retained',
    releaseReturnedToZero: afterRelease.memory === '0 doorways retained',
    issues
  };
  await page.close();
}

{
  const response = await fetch(`${ROOT}/studio/favicon.svg`);
  results.favicon = { status: response.status, contentType: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength };
}

await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
