import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.MUTINE_BASE_URL ?? 'http://127.0.0.1:4173';
const proofDir = fileURLToPath(new URL('./', import.meta.url));
await mkdir(proofDir, { recursive: true });

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

const browser = await chromium.launch({ headless: true });
const results = {
  base,
  target: 'svg-2026-09-15',
  rawMatrix: [],
  canonical: null,
  staticBlind: null,
  interaction: null,
  issues: []
};

function issueBucket() {
  return { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
}

async function openPage(url, viewport, reducedMotion = false) {
  const context = await browser.newContext({ viewport });
  await context.setExtraHTTPHeaders({ 'Accept-Language': 'en' });
  const page = await context.newPage();
  const issues = issueBucket();
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mutinePureSvgV012 || document.querySelector('.catalog-mount[data-catalog-work-detail]'), null, { timeout: 15000 });
  return { context, page, issues, status: response?.status() ?? null };
}

async function readDimensions(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: rect('#field'),
      fieldWrap: rect('.field-wrap'),
      opening: rect('.work-opening'),
      title: rect('#work-title'),
      controls: [...document.querySelectorAll('.field-controls button')].map((button) => {
        const box = button.getBoundingClientRect();
        return { label: button.textContent.trim(), width: box.width, height: box.height, disabled: button.disabled };
      })
    };
  });
}

for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    const suffix = `${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}`;
    const opened = await openPage(`${base}/studies/pure-svg/v012/?preview=1&interaction=1&cache=${suffix}`, viewport, reducedMotion);
    const dimensions = await readDimensions(opened.page);
    const state = await opened.page.evaluate(() => window.__mutinePureSvgV012.getState());
    await opened.page.screenshot({ path: join(proofDir, `canonical-${suffix}.png`) });
    results.rawMatrix.push({ viewport, reducedMotion, status: opened.status, dimensions, state, issues: opened.issues });
    await opened.context.close();
  }
}

{
  const opened = await openPage(`${base}/studies/pure-svg/v012/?preview=1&static=1&blind=1&cache=static-blind`, { width: 390, height: 844 }, true);
  const data = await opened.page.evaluate(() => ({
    state: window.__mutinePureSvgV012.getState(),
    dimensions: {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    },
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    labelsDisplay: getComputedStyle(document.querySelector('.artwork-label')).display,
    apertureDisplay: getComputedStyle(document.querySelector('.threshold-aperture')).display
  }));
  await opened.page.screenshot({ path: join(proofDir, 'static-blind-390x844.png') });
  results.staticBlind = { status: opened.status, ...data, issues: opened.issues };
  await opened.context.close();
}

{
  const opened = await openPage(`${base}/studies/pure-svg/v012/?preview=1&interaction=1&cache=interaction`, { width: 390, height: 844 }, false);
  await opened.page.click('#release-control');
  await opened.page.mouse.click(195, 300);
  const pointerState = await opened.page.evaluate(() => window.__mutinePureSvgV012.getState());
  const pointerSignature = await opened.page.evaluate(() => window.__mutinePureSvgV012.getFrameSignature());
  await opened.page.locator('#field').focus();
  await opened.page.keyboard.press('Enter');
  const keyboardState = await opened.page.evaluate(() => window.__mutinePureSvgV012.getState());
  const keyboardSignature = await opened.page.evaluate(() => window.__mutinePureSvgV012.getFrameSignature());
  await opened.page.click('#lift-control');
  const liftState = await opened.page.evaluate(() => window.__mutinePureSvgV012.getState());
  const liftSignature = await opened.page.evaluate(() => window.__mutinePureSvgV012.getFrameSignature());
  await opened.page.click('#lift-control');
  const emptyState = await opened.page.evaluate(() => window.__mutinePureSvgV012.getState());
  await opened.page.screenshot({ path: join(proofDir, 'raw-interaction-390x844.png') });
  results.interaction = {
    status: opened.status,
    pointerState,
    keyboardState,
    liftState,
    emptyState,
    keyboardChangedField: keyboardSignature !== pointerSignature,
    liftRestoredPointer: liftSignature === pointerSignature,
    issues: opened.issues
  };
  await opened.context.close();
}

{
  const opened = await openPage(`${base}/works/svg-2026-09-15/`, { width: 390, height: 844 }, false);
  await opened.page.waitForSelector('.work-inspect__stage iframe', { timeout: 15000 });
  await opened.page.waitForFunction(() => document.querySelector('.work-inspect__heading h1')?.textContent.includes('threshold'), null, { timeout: 15000 });
  const data = await opened.page.evaluate(() => {
    const frame = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading');
    const journalLink = document.querySelector('[data-work-region="journal"] a');
    const box = (node) => {
      const rect = node?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } : null;
    };
    return {
      dimensions: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      tableau: box(frame),
      heading: box(heading),
      title: document.querySelector('.work-inspect__heading h1')?.textContent,
      journalHref: journalLink?.getAttribute('href'),
      tableauBeforeHeading: frame && heading ? frame.getBoundingClientRect().top < heading.getBoundingClientRect().top : false
    };
  });
  await opened.page.screenshot({ path: join(proofDir, 'canonical-work-390x844.png'), fullPage: true });
  results.canonical = { status: opened.status, ...data, issues: opened.issues };
  await opened.context.close();
}

await browser.close();
const serialized = JSON.stringify(results, null, 2);
await writeFile(join(proofDir, 'results.json'), serialized);
console.log(serialized);
