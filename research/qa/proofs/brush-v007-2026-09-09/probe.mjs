import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const root = 'http://127.0.0.1:4173';
const proofDir = 'research/qa/proofs/brush-v007-2026-09-09';
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const matrix = [];
let interactionEvidence = null;

function safeName(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
}

async function geometry(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [...document.querySelectorAll('*')]
      .map((element) => ({
        element,
        tag: element.tagName.toLowerCase(),
        id: element.id,
        className: typeof element.className === 'string' ? element.className : '',
        right: Math.round(element.getBoundingClientRect().right * 100) / 100
      }))
      .filter((entry) => entry.right > window.innerWidth + 1)
      .filter((entry) => {
        let parent = entry.element.parentElement;
        while (parent) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden' || overflowX === 'clip') return false;
          parent = parent.parentElement;
        }
        return true;
      })
      .map(({ element, ...entry }) => entry)
      .slice(0, 8);
    const scrollContainers = [...document.querySelectorAll('*')]
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === 'string' ? element.className : '',
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }))
      .filter((entry) => entry.scrollWidth > entry.clientWidth + 1)
      .slice(0, 8);
    return {
      innerWidth: window.innerWidth,
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      offenders,
      scrollContainers
    };
  });
}

async function frameGeometry(frame) {
  return frame.locator('html').evaluate(() => {
    const doc = document.documentElement;
    const canvas = document.querySelector('#field');
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      canvas: canvas ? {
        width: Math.round(canvas.getBoundingClientRect().width),
        height: Math.round(canvas.getBoundingClientRect().height),
        controls: [...document.querySelectorAll('button')].map((button) => ({
          id: button.id,
          height: Math.round(button.getBoundingClientRect().height)
        }))
      } : null
    };
  });
}

async function canvasStructuralSignature(frame) {
  return frame.locator('#field').evaluate((canvas) => {
    const height = Math.max(1, Math.floor(canvas.height * .9));
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, height).data;
    let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 1) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 16777619);
    }
    return `${canvas.width}x${height}:${hash >>> 0}`;
  });
}

async function runViewport(width, height, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
  });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
  });

  const url = `${root}/works/brush-2026-09-09/`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.work-inspect__stage iframe').waitFor();
  const tableauFrame = await page.locator('.work-inspect__stage iframe').contentFrame();
  await tableauFrame.locator('#field').waitFor();
  const initial = await geometry(page);
  const embedded = await frameGeometry(tableauFrame);
  const screenshot = `${proofDir}/canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: screenshot });

  const result = {
    width,
    height,
    reducedMotion,
    url,
    initial,
    embedded,
    tableauFirst: await page.locator('.work-inspect__stage').evaluate((node) => node.getBoundingClientRect().top < document.querySelector('.work-inspect__heading').getBoundingClientRect().top),
    consoleMessages,
    pageErrors,
    failedRequests,
    httpErrors,
    screenshot
  };

  if (!reducedMotion && width === 390) {
    const memoryBefore = await tableauFrame.locator('[data-memory]').textContent();
    await tableauFrame.locator('#make-capillary').click();
    const memoryAfterPointer = await tableauFrame.locator('[data-memory]').textContent();
    const signatureAfterPointer = await canvasStructuralSignature(tableauFrame);
    const pointerState = await tableauFrame.locator('[data-stage]').textContent();
    await tableauFrame.locator('#field').focus();
    await tableauFrame.locator('#field').press('Enter');
    const memoryAfterKeyboard = await tableauFrame.locator('[data-memory]').textContent();
    await tableauFrame.locator('#lift-capillary').click();
    const memoryAfterLift = await tableauFrame.locator('[data-memory]').textContent();
    const signatureAfterLift = await canvasStructuralSignature(tableauFrame);
    const liftState = await tableauFrame.locator('[data-stage]').textContent();
    await tableauFrame.locator('#release-sequence').click();
    const memoryAfterRelease = await tableauFrame.locator('[data-memory]').textContent();
    const postInteraction = await geometry(page);
    const postEmbedded = await frameGeometry(tableauFrame);
    interactionEvidence = {
      memoryBefore,
      memoryAfterPointer,
      pointerState,
      memoryAfterKeyboard,
      memoryAfterLift,
      liftState,
      memoryAfterRelease,
      signatureRestored: signatureAfterPointer === signatureAfterLift,
      postInteraction,
      postEmbedded,
      postInteractionConsoleMessages: consoleMessages.slice(),
      postInteractionPageErrors: pageErrors.slice(),
      postInteractionFailedRequests: failedRequests.slice(),
      postInteractionHttpErrors: httpErrors.slice()
    };
  }

  await context.close();
  return result;
}

for (const reducedMotion of [false, true]) {
  for (const [width, height] of viewports) {
    matrix.push(await runViewport(width, height, reducedMotion));
  }
}

const rawContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const rawPage = await rawContext.newPage();
const rawErrors = [];
const rawFailed = [];
const rawHttpErrors = [];
rawPage.on('pageerror', (error) => rawErrors.push(String(error)));
rawPage.on('requestfailed', (request) => rawFailed.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
rawPage.on('response', (response) => { if (response.status() >= 400) rawHttpErrors.push({ url: response.url(), status: response.status() }); });
const rawUrl = `${root}/studies/p5-brush/v007/?preview=1&interaction=1`;
await rawPage.goto(rawUrl, { waitUntil: 'networkidle' });
const rawFrame = rawPage;
await rawFrame.locator('#field').waitFor();
const rawGeometry = await geometry(rawPage);
const rawClasses = await rawPage.evaluate(() => ({
  preview: document.documentElement.classList.contains('preview-mode'),
  interactive: document.documentElement.classList.contains('interactive-preview'),
  headerVisible: getComputedStyle(document.querySelector('.studio-header')).display !== 'none',
  canvas: Boolean(document.querySelector('#field')),
  controls: document.querySelectorAll('button').length
}));
const rawScreenshot = `${proofDir}/raw-preview-390x844-reduced.png`;
await rawPage.screenshot({ path: rawScreenshot });
await rawContext.close();

const summary = {
  generatedAt: new Date().toISOString(),
  route: `${root}/works/brush-2026-09-09/`,
  rawPreview: rawUrl,
  viewports: viewports.map(([width, height]) => `${width}x${height}`),
  matrix,
  interactionEvidence,
  rawPreviewEvidence: {
    geometry: rawGeometry,
    classes: rawClasses,
    pageErrors: rawErrors,
    failedRequests: rawFailed,
    httpErrors: rawHttpErrors,
    screenshot: rawScreenshot
  },
  pass: matrix.every((entry) => entry.initial.innerWidth === entry.width
    && entry.initial.clientWidth === entry.initial.scrollWidth
    && entry.initial.offenders.length === 0
    && entry.embedded.clientWidth === entry.embedded.scrollWidth
    && entry.embedded.canvas?.controls.every((control) => control.height >= 44)
    && entry.consoleMessages.length === 0
    && entry.pageErrors.length === 0
    && entry.failedRequests.length === 0
    && entry.httpErrors.length === 0)
    && interactionEvidence?.signatureRestored
    && interactionEvidence.postInteraction.clientWidth === interactionEvidence.postInteraction.scrollWidth
    && rawGeometry.clientWidth === rawGeometry.scrollWidth
    && rawClasses.preview
    && rawClasses.interactive
    && !rawClasses.headerVisible
    && rawErrors.length === 0
    && rawFailed.length === 0
    && rawHttpErrors.length === 0
};
await writeFile(`${proofDir}/results.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ pass: summary.pass, matrixRuns: matrix.length, interactionEvidence, rawPreviewEvidence: summary.rawPreviewEvidence }, null, 2));
await browser.close();
if (!summary.pass) process.exitCode = 1;
