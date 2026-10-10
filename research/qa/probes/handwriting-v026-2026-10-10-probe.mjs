import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ROOT = process.env.V026_PROBE_ROOT || 'http://127.0.0.1:4280';
const rawRoute = '/studies/handwriting/v026/?preview=1&interaction=1';
const blindRoute = '/studies/handwriting/v026/?preview=1&static=1&blind=1';
const evidenceDir = process.env.V026_PROBE_DIR || 'research/qa/proofs/typography-v026-2026-10-10';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function inspect(page, label, viewport, reduced, route) {
  const measurements = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const state = window.__mutineHandwritingV026?.getState?.() ?? null;
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowElements: [...document.querySelectorAll('*')].filter((node) => { const box = node.getBoundingClientRect(); return box.right > window.innerWidth + 1 || box.left < -1 || node.scrollWidth > node.clientWidth + 1; }).slice(0, 12).map((node) => ({ tag: node.tagName, id: node.id, className: String(node.className), right: node.getBoundingClientRect().right, left: node.getBoundingClientRect().left, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })),
      ready: Boolean(window._p5Ready && window.__mutineHandwritingV026),
      title: document.title,
      canvasCount: document.querySelectorAll('canvas').length,
      state,
      rack: rect('#route-rack'),
      canvas: rect('#canvas-mount'),
      controls: [...document.querySelectorAll('.rack-controls button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, disabled: button.disabled })),
      visibleFurniture: [...document.querySelectorAll('.studio-header, .rack-opening, .rack-readout, .rack-controls, .rack-hint')].filter((node) => getComputedStyle(node).display !== 'none').map((node) => node.className)
    };
  });
  const screenshot = `${evidenceDir}/${label}-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: screenshot, fullPage: false });
  return { label, viewport, reduced, route, measurements, screenshot };
}

for (const viewport of viewports) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
    const response = await page.goto(`${ROOT}${rawRoute}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV026), null, { timeout: 15000 });
    await page.waitForTimeout(80);
    const entry = await inspect(page, 'raw', viewport, reduced, rawRoute);
    entry.httpStatus = response?.status() ?? null;
    entry.consoleMessages = consoleMessages;
    entry.pageErrors = pageErrors;
    entry.failedRequests = failedRequests;
    results.push(entry);
    await context.close();
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionConsole = [];
const interactionErrors = [];
const interactionFailed = [];
interactionPage.on('console', (message) => interactionConsole.push({ type: message.type(), text: message.text() }));
interactionPage.on('pageerror', (error) => interactionErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
await interactionPage.goto(`${ROOT}${rawRoute}`, { waitUntil: 'networkidle' });
await interactionPage.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV026), null, { timeout: 15000 });
const baseline = await interactionPage.evaluate(() => ({ signature: window.__mutineHandwritingV026.getSignature(), state: window.__mutineHandwritingV026.getState() }));
const canvasBox = await interactionPage.locator('#canvas-mount').boundingBox();
const y = canvasBox.y + canvasBox.height * 0.52;
const firstX = canvasBox.x + canvasBox.width * (2 / 6);
const secondX = canvasBox.x + canvasBox.width * (5 / 6);
await interactionPage.mouse.move(firstX, y);
const armed = await interactionPage.evaluate(() => window.__mutineHandwritingV026.getState());
await interactionPage.mouse.move(secondX, y);
const departed = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV026.getState(), signature: window.__mutineHandwritingV026.getSignature() }));
await interactionPage.locator('#route-rack').focus();
await interactionPage.keyboard.press('Enter');
const keyboardCommitted = await interactionPage.evaluate(() => window.__mutineHandwritingV026.getState());
await interactionPage.keyboard.press('Delete');
const deleted = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV026.getState(), signature: window.__mutineHandwritingV026.getSignature() }));
await interactionPage.locator('#release-rack').click();
const released = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV026.getState(), signature: window.__mutineHandwritingV026.getSignature() }));
results.push({
  label: 'interaction',
  viewport: { width: 390, height: 844 },
  route: rawRoute,
  baseline,
  armed,
  departed,
  keyboardCommitted,
  deleted,
  released,
  consoleMessages: interactionConsole,
  pageErrors: interactionErrors,
  failedRequests: interactionFailed
});
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
const blindConsole = [];
const blindErrors = [];
const blindFailed = [];
blindPage.on('console', (message) => blindConsole.push({ type: message.type(), text: message.text() }));
blindPage.on('pageerror', (error) => blindErrors.push(String(error)));
blindPage.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
const blindResponse = await blindPage.goto(`${ROOT}${blindRoute}`, { waitUntil: 'networkidle' });
await blindPage.waitForFunction(() => Boolean(window._p5Ready && window.__mutineHandwritingV026), null, { timeout: 15000 });
await blindPage.waitForTimeout(80);
const blindMeasurements = await blindPage.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  canvas: Boolean(document.querySelector('canvas')),
  readout: getComputedStyle(document.querySelector('.rack-readout')).display,
  controls: getComputedStyle(document.querySelector('.rack-controls')).display,
  hint: getComputedStyle(document.querySelector('.rack-hint')).display,
  state: window.__mutineHandwritingV026.getState()
}));
const blindScreenshot = `${evidenceDir}/blind-390x844-reduced.png`;
await blindPage.screenshot({ path: blindScreenshot, fullPage: false });
results.push({ label: 'blind', viewport: { width: 390, height: 844 }, reduced: true, route: blindRoute, httpStatus: blindResponse?.status() ?? null, measurements: blindMeasurements, screenshot: blindScreenshot, consoleMessages: blindConsole, pageErrors: blindErrors, failedRequests: blindFailed });
await blindContext.close();

await browser.close();
await writeFile(`${evidenceDir}/results.json`, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ runs: results.length, matrixRuns: results.filter((entry) => entry.label === 'raw').length, interaction: results.find((entry) => entry.label === 'interaction'), blind: results.find((entry) => entry.label === 'blind'), resultsPath: `${evidenceDir}/results.json` }, null, 2));
