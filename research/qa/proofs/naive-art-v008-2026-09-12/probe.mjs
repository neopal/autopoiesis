import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ROOT = process.env.ROOT ?? 'http://127.0.0.1:4173';
const OUT = process.env.PROOF_DIR ?? 'research/qa/proofs/naive-art-v008-2026-09-12';
const CHROME = process.env.CHROME_PATH ?? chromium.executablePath();
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: CHROME });
const context = await browser.newContext({ deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => events.pageErrors.push(String(error)));
page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });

async function geometry() {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
}

async function waitForCatalog() {
  await page.waitForFunction(() => document.querySelector('[data-ready="true"]'));
  await page.waitForTimeout(80);
}

const matrix = [];
try {
  for (const [width, height] of viewports) {
    for (const reducedMotion of [false, true]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      await page.goto(`${ROOT}/works/naive-2026-09-12/`, { waitUntil: 'networkidle' });
      await waitForCatalog();
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v008/'));
      const state = await frame?.evaluate(() => window.__mutineNaiveV008?.getState?.() ?? null);
      const layout = await page.evaluate(() => ({
        ...document.querySelector('.work-inspect__stage')?.getBoundingClientRect().toJSON(),
        tableauFirst: Boolean(document.querySelector('.work-inspect__stage iframe')?.compareDocumentPosition(document.querySelector('.work-inspect__heading')) & Node.DOCUMENT_POSITION_FOLLOWING)
      }));
      const geometryState = await geometry();
      const capture = `${OUT}/canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
      await page.locator('.work-inspect__stage iframe').screenshot({ path: capture });
      matrix.push({ width, height, reducedMotion, url: page.url(), state, layout, geometry: geometryState, capture });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${ROOT}/studies/naive-art/v008/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#field');
  const rawInitial = await page.evaluate(() => window.__mutineNaiveV008.getState());
  const canvas = page.locator('#field');
  await canvas.click({ position: { x: 72, y: 310 } });
  const rawAfterPointer = await page.evaluate(() => window.__mutineNaiveV008.getState());
  await canvas.focus();
  await page.keyboard.press('Enter');
  const rawAfterKeyboard = await page.evaluate(() => window.__mutineNaiveV008.getState());
  const rawAfterKeyboardGeometry = await geometry();
  const touchTargets = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().height)));
  await page.locator('#undo-control').click();
  const rawAfterUndo = await page.evaluate(() => window.__mutineNaiveV008.getState());
  await page.locator('#release-control').click();
  const rawAfterRelease = await page.evaluate(() => window.__mutineNaiveV008.getState());
  const rawCapture = `${OUT}/raw-interaction-390x844.png`;
  await canvas.screenshot({ path: rawCapture });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${ROOT}/studies/naive-art/v008/?preview=1&static=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#field');
  const blind = await page.evaluate(() => ({
    state: window.__mutineNaiveV008.getState(),
    preview: document.documentElement.classList.contains('preview-mode'),
    staticMode: document.documentElement.classList.contains('static-mode'),
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    canvasTabIndex: document.querySelector('#field').tabIndex
  }));
  const blindGeometry = await geometry();
  const blindCapture = `${OUT}/raw-static-blind-390x844.png`;
  await canvas.screenshot({ path: blindCapture });

  const result = {
    route: `${ROOT}/works/naive-2026-09-12/`,
    rawPreview: `${ROOT}/studies/naive-art/v008/?preview=1&interaction=1`,
    matrix,
    rawInteraction: {
      initial: rawInitial,
      afterPointer: rawAfterPointer,
      afterKeyboard: rawAfterKeyboard,
      afterUndo: rawAfterUndo,
      afterRelease: rawAfterRelease,
      geometry: rawAfterKeyboardGeometry,
      touchTargets,
      capture: rawCapture
    },
    staticBlind: { ...blind, geometry: blindGeometry, capture: blindCapture },
    events,
    pass: matrix.length === 10 && events.console.length === 0 && events.pageErrors.length === 0 && events.requestFailures.length === 0 && events.httpErrors.length === 0
  };
  await writeFile(`${OUT}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await context.close();
  await browser.close();
}
