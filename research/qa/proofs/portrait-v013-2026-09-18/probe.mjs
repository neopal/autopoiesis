import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = 'http://127.0.0.1:4173';
const proofDir = path.resolve('research/qa/proofs/portrait-v013-2026-09-18');
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
const errors = [];
const allConsole = [];
const allFailedRequests = [];
const allBadResponses = [];

function attachDiagnostics(page, label) {
  page.on('console', (message) => allConsole.push({ label, type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => errors.push({ label, type: 'pageerror', text: error.message }));
  page.on('requestfailed', (request) => allFailedRequests.push({ label, url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) allBadResponses.push({ label, url: response.url(), status: response.status() });
  });
}

async function open(page, url, reducedMotion) {
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(url, { waitUntil: 'networkidle' });
}

async function canonicalRun(browser, width, height, reducedMotion) {
  const page = await browser.newPage({ viewport: { width, height } });
  const label = `canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}`;
  attachDiagnostics(page, label);
  await open(page, `${root}/works/portrait-2026-09-18/`, reducedMotion);
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForTimeout(80);
  const measurements = await page.evaluate(() => {
    const frame = document.querySelector('.work-inspect__stage figure');
    const title = document.querySelector('.work-inspect__heading h1');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null;
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      frame: rect(frame),
      iframe: rect(iframe),
      title: rect(title),
      tableauFirst: Boolean(frame && title && frame.getBoundingClientRect().top <= title.getBoundingClientRect().top),
      ready: document.querySelector('[data-ready="true"]')?.dataset.ready === 'true'
    };
  });
  await page.screenshot({ path: path.join(proofDir, `${label}.png`), fullPage: true });
  await page.close();
  return measurements;
}

async function rawInteractionRun(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const label = 'raw-interaction-390x844';
  attachDiagnostics(page, label);
  await open(page, `${root}/studies/self-portrait/v013/?preview=1&interaction=1&cache=portrait-2026-09-18`, false);
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV013));
  const initial = await page.evaluate(() => window.__mutinePortraitV013.getState());
  const initialPng = await page.locator('#field').evaluate((canvas) => canvas.toDataURL('image/png'));
  const canvas = page.locator('#field');
  const bounds = await canvas.boundingBox();
  await page.mouse.click(bounds.x + bounds.width * .72, bounds.y + bounds.height * .38);
  const afterPointer = await page.evaluate(() => window.__mutinePortraitV013.getState());
  const pointerPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await canvas.focus();
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => window.__mutinePortraitV013.getState());
  await page.getByRole('button', { name: 'lift latest fold' }).click();
  const afterLift = await page.evaluate(() => window.__mutinePortraitV013.getState());
  const liftPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await page.getByRole('button', { name: 'release sequence' }).click();
  const afterRelease = await page.evaluate(() => window.__mutinePortraitV013.getState());
  const touchTargets = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height })));
  const dom = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: path.join(proofDir, `${label}.png`), fullPage: true });
  await page.close();
  return { initial, afterPointer, afterKeyboard, afterLift, afterRelease, changedCanvas: initialPng !== pointerPng, liftRestoredPointer: pointerPng === liftPng, touchTargets, ...dom };
}

async function staticBlindRun(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const label = 'static-blind-390x844';
  attachDiagnostics(page, label);
  await open(page, `${root}/studies/self-portrait/v013/?preview=1&static=1&blind=1&cache=portrait-2026-09-18`, true);
  await page.waitForSelector('#field');
  const evidence = await page.evaluate(() => {
    const canvas = document.querySelector('#field');
    const controls = document.querySelector('.field-controls');
    const readout = document.querySelector('.surface-readout');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height },
      controlsDisplay: getComputedStyle(controls).display,
      readoutDisplay: getComputedStyle(readout).display,
      canvasVisible: canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0
    };
  });
  await page.screenshot({ path: path.join(proofDir, `${label}.png`), fullPage: true });
  await page.close();
  return evidence;
}

async function journalRun(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const label = 'journal-390x844';
  attachDiagnostics(page, label);
  await open(page, `${root}/journal/`, true);
  await page.waitForSelector('[data-ready="true"]');
  const evidence = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('#journal-portrait-2026-09-18')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: entries.length,
      titleCount: entries.filter((entry) => entry.textContent.includes('The portrait turns inward.')).length,
      href: entries[0]?.querySelector('h3 a')?.getAttribute('href') ?? null
    };
  });
  await page.screenshot({ path: path.join(proofDir, `${label}.png`), fullPage: true });
  await page.close();
  return evidence;
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const canonical = {};
for (const [width, height] of viewports) {
  for (const reducedMotion of [false, true]) {
    canonical[`${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}`] = await canonicalRun(browser, width, height, reducedMotion);
  }
}
const rawInteraction = await rawInteractionRun(browser);
const staticBlind = await staticBlindRun(browser);
const journal = await journalRun(browser);
await browser.close();

const result = {
  route: `${root}/works/portrait-2026-09-18/`,
  rawPreview: `${root}/studies/self-portrait/v013/?preview=1&interaction=1`,
  canonical,
  rawInteraction,
  staticBlind,
  journal,
  diagnostics: { console: allConsole, pageErrors: errors, failedRequests: allFailedRequests, badResponses: allBadResponses },
  passed: Object.values(canonical).every((run) => run.innerWidth === run.clientWidth && run.scrollWidth <= run.innerWidth && run.tableauFirst && run.iframe?.width > 0 && run.iframe?.height > 0)
    && rawInteraction.innerWidth === rawInteraction.clientWidth && rawInteraction.scrollWidth <= rawInteraction.innerWidth
    && rawInteraction.changedCanvas && rawInteraction.liftRestoredPointer
    && rawInteraction.touchTargets.every((target) => target.height >= 44)
    && staticBlind.innerWidth === staticBlind.clientWidth && staticBlind.scrollWidth <= staticBlind.innerWidth && staticBlind.canvasVisible && staticBlind.controlsDisplay === 'none' && staticBlind.readoutDisplay === 'none'
    && journal.anchorCount === 1 && journal.titleCount === 1 && journal.href === '/works/portrait-2026-09-18/#journal'
    && allConsole.length === 0 && errors.length === 0 && allFailedRequests.length === 0 && allBadResponses.length === 0
};
await writeFile(path.join(proofDir, 'results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, canonicalRuns: Object.keys(canonical).length, diagnostics: result.diagnostics, rawInteraction, staticBlind, journal }, null, 2));
if (!result.passed) process.exitCode = 1;
