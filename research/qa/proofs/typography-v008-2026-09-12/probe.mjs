import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'research/qa/proofs/typography-v008-2026-09-12';
const BASE = 'http://127.0.0.1:4173';
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1161/chrome-win/chrome.exe';
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
const failures = [];
const matrix = [];
await mkdir(`${ROOT}/captures`, { recursive: true });

function recordFailure(label, detail) {
  failures.push({ label, detail });
}

async function observePage(page, label, url, viewport, reducedMotion) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: viewport[0], height: viewport[1] });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  if (label === 'canonical') {
    await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
    await page.locator('iframe').first().waitFor({ state: 'visible' });
  } else {
    await page.waitForFunction(() => Boolean(window.__mutineHandwritingV008));
  }
  const artworkFrame = page.frames().find((frame) => frame.url().includes('/studies/handwriting/v008/')) ?? page.mainFrame();
  const tableauState = await artworkFrame.evaluate(() => window.__mutineHandwritingV008?.getState?.() ?? null);
  const dom = await page.evaluate((state) => {
    const root = document.documentElement;
    const body = document.body;
    const iframe = document.querySelector('iframe');
    const frameRoot = document.querySelector('[data-catalog-work-detail]');
    const controls = [...document.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
    });
    const overflows = [...document.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > innerWidth + 1 || rect.left < -1;
    }).slice(0, 8).map((element) => ({ tag: element.tagName, id: element.id, className: element.className }));
    return {
      innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      iframeCount: document.querySelectorAll('iframe').length,
      tableauBeforeTitle: Boolean(frameRoot && iframe && frameRoot.innerHTML.indexOf('<iframe') < frameRoot.innerHTML.indexOf('<h1')),
      controls,
      overflows,
      rawState: state,
      title: document.title
    };
  }, tableauState);
  const screenshotName = `${label}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: `${ROOT}/captures/${screenshotName}`, fullPage: label === 'canonical' });
  const result = {
    label,
    url,
    viewport: { width: viewport[0], height: viewport[1] },
    reducedMotion,
    dom,
    consoleMessages,
    pageErrors,
    requestFailures,
    badResponses,
    screenshot: `captures/${screenshotName}`
  };
  matrix.push(result);
  if (dom.innerWidth !== viewport[0] || dom.clientWidth !== viewport[0] || dom.scrollWidth !== viewport[0]) recordFailure(`${label} ${viewport.join('x')} ${reducedMotion ? 'reduced' : 'normal'} overflow`, dom);
  if (consoleMessages.length || pageErrors.length || requestFailures.length || badResponses.length) recordFailure(`${label} ${viewport.join('x')} browser issues`, result);
  return result;
}

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      await observePage(await browser.newPage({ deviceScaleFactor: 1 }), 'canonical', '/works/typography-2026-09-12/', viewport, reducedMotion);
    }
  }

  const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const rawResult = await observePage(rawPage, 'raw-interactive', '/studies/handwriting/v008/?preview=1&interaction=1', [390, 844], false);
  const rawFrame = rawPage.frames().find((frame) => frame.url().includes('/studies/handwriting/v008/')) ?? rawPage.mainFrame();
  const initialState = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getState());
  const canvas = rawFrame.locator('#piece');
  await canvas.click({ position: { x: 130, y: 260 } });
  const pointerState = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getState());
  const pointerSignature = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getFrameSignature());
  await canvas.focus();
  await canvas.press('Enter');
  const keyboardState = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getState());
  await rawFrame.locator('#lift-relay').click();
  const liftedState = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getState());
  const liftedSignature = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getFrameSignature());
  await rawFrame.locator('#release-sequence').click();
  const releasedState = await rawFrame.evaluate(() => window.__mutineHandwritingV008.getState());
  const interaction = {
    initialState,
    pointerState,
    keyboardState,
    liftedState,
    releasedState,
    liftRestoredPointerFrame: liftedSignature === pointerSignature
  };
  await rawPage.screenshot({ path: `${ROOT}/captures/raw-interaction-390x844.png` });
  if (initialState.memory !== 0 || pointerState.memory !== 1 || keyboardState.memory !== 2 || liftedState.memory !== 1 || !interaction.liftRestoredPointerFrame || releasedState.memory !== 0) recordFailure('raw interaction sequence', interaction);
  matrix.push({ label: 'raw-interaction-sequence', interaction, base: rawResult });
  await rawPage.close();

  const blindPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const blindResult = await observePage(blindPage, 'raw-blind', '/studies/handwriting/v008/?preview=1&static=1&blind=1', [390, 844], true);
  const blindDom = await blindPage.evaluate(() => ({
    headerVisible: Boolean(document.querySelector('.studio-header')?.getBoundingClientRect().height),
    canvasCornerVisible: Boolean(document.querySelector('.canvas-corner')?.getBoundingClientRect().height),
    interactionVisible: Boolean(document.querySelector('.interaction-panel')?.getBoundingClientRect().height),
    state: window.__mutineHandwritingV008.getState()
  }));
  matrix.push({ label: 'raw-blind-state', blindDom, base: blindResult });
  if (blindDom.headerVisible || blindDom.canvasCornerVisible || blindDom.interactionVisible) recordFailure('raw blind furniture visibility', blindDom);
  await blindPage.close();
} finally {
  await browser.close();
}

const output = {
  status: failures.length ? 'held / failed browser gate' : 'candidate / held for independent perceptual review',
  observedWith: { server: 'python http.server 4173', browser: 'Playwright + Chromium headless', executablePath },
  route: '/works/typography-2026-09-12/',
  rawPreview: '/studies/handwriting/v008/?preview=1&interaction=1',
  viewportMatrix: matrix.filter((entry) => entry.label === 'canonical').map((entry) => ({ viewport: entry.viewport, reducedMotion: entry.reducedMotion, dom: entry.dom, issues: [...entry.consoleMessages, ...entry.pageErrors, ...entry.requestFailures, ...entry.badResponses] })),
  interaction: matrix.find((entry) => entry.label === 'raw-interaction-sequence')?.interaction ?? null,
  blind: matrix.find((entry) => entry.label === 'raw-blind-state')?.blindDom ?? null,
  failures,
  matrix
};
await writeFile(`${ROOT}/results.json`, JSON.stringify(output, null, 2));
process.stdout.write(JSON.stringify({ status: output.status, failures: failures.length, canonicalRuns: output.viewportMatrix.length, interaction: output.interaction, blind: output.blind }, null, 2));
if (failures.length) process.exitCode = 1;
