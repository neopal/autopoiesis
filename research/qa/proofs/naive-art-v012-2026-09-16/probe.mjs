import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const proofDir = 'research/qa/proofs/naive-art-v012-2026-09-16';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
const results = { local: { canonical: [], raw: null, blind: null }, generatedAt: new Date().toISOString() };

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
    const layoutOverflow = [...document.querySelectorAll('*')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { element, name: element.tagName.toLowerCase() + (element.id ? `#${element.id}` : ''), left: rect.left, right: rect.right };
    }).filter((item) => (item.left < -1 || item.right > innerWidth + 1) && !item.element.closest('.work-timeline-bar')).map(({ name, left, right }) => ({ element: name, left, right })).slice(0, 12);
    const stage = document.querySelector('.work-inspect__stage');
    const heading = document.querySelector('.work-inspect__heading');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      layoutOverflow,
      ready: mount?.dataset.ready === 'true',
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
      tableauBeforeHeading: Boolean(stage && heading && stage.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING),
      title: document.querySelector('.work-inspect__heading h1')?.textContent ?? null
    };
  });
}

async function findStudyFrame(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.src.includes('/studies/naive-art/v012/')));
  await page.waitForTimeout(80);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v012/'));
  if (!frame) throw new Error('study iframe did not attach');
  await frame.waitForSelector('#field');
  return frame;
}

async function readStudy(frame) {
  return frame.evaluate(() => {
    const canvas = document.querySelector('#field');
    const wrap = document.querySelector('.field-wrap');
    const buttons = [...document.querySelectorAll('.field-controls button')];
    const state = window.__mutineNaiveV012?.getState?.();
    const canvasRect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: getComputedStyle(canvas).display !== 'none' && canvasRect.width > 0 && canvasRect.height > 0,
      canvasRect: { width: canvasRect.width, height: canvasRect.height },
      wrapRect: { width: wrapRect.width, height: wrapRect.height },
      memory: document.querySelector('[data-memory]')?.textContent ?? null,
      stage: document.querySelector('[data-stage]')?.textContent ?? null,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      buttonHeights: buttons.map((button) => Math.round(button.getBoundingClientRect().height)),
      buttonLabels: buttons.map((button) => button.textContent.trim()),
      state
    };
  });
}

for (const reduced of [false, true]) {
  const context = await browser.newContext({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const [width, height] of viewports) {
    const page = await context.newPage();
    const events = observe(page);
    await page.setViewportSize({ width, height });
    await page.goto(`${ROOT}/works/naive-2026-09-16/`, { waitUntil: 'networkidle' });
    const outer = await readOuter(page);
    const frame = await findStudyFrame(page);
    const study = await readStudy(frame);
    await page.screenshot({ path: `${proofDir}/canonical-${reduced ? 'reduced' : 'normal'}-${width}x${height}.png`, fullPage: true });
    results.local.canonical.push({ reduced, width, height, outer, study, issues: events });
    await page.close();
  }
  await context.close();
}

{
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const events = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ROOT}/studies/naive-art/v012/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
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
  results.local.raw = {
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
    secondLiftReturnedToZero: afterSecondLift.memory === '0 bridges retained',
    releaseReturnedToZero: afterRelease.memory === '0 bridges retained',
    issues: events
  };
  await page.close();
  await context.close();
}

{
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const events = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ROOT}/studies/naive-art/v012/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#field');
  const study = await readStudy(page.mainFrame());
  await page.screenshot({ path: `${proofDir}/static-blind-390x844.png`, fullPage: false });
  results.local.blind = { study, issues: events };
  await page.close();
  await context.close();
}

await writeFile(`${proofDir}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
