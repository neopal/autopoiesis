import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const OUT = 'research/qa/proofs/portrait-v008-2026-09-12';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];

const issuesFor = (events) => ({
  console: events.console,
  pageErrors: events.pageErrors,
  requestFailures: events.requestFailures,
  httpErrors: events.httpErrors
});

async function newPage(browser, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return { page, events };
}

async function frameFor(page) {
  await page.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v008/'));
  if (!frame) throw new Error('v008 tableau iframe did not attach');
  await frame.locator('#field').waitFor({ state: 'visible' });
  return frame;
}

async function geometry(page, frame) {
  return page.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tableauFirst: (() => {
      const stage = document.querySelector('.work-inspect__stage iframe');
      const title = document.querySelector('.work-inspect__heading h1');
      return Boolean(stage && title && stage.getBoundingClientRect().top < title.getBoundingClientRect().top);
    })()
  })).then(async (outer) => ({
    ...outer,
    embedded: await frame.evaluate(() => ({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: Boolean(document.querySelector('#field')),
      previewMode: document.documentElement.classList.contains('preview-mode'),
      interactivePreview: document.documentElement.classList.contains('interactive-preview')
    }))
  }));
}

async function runMatrix(browser) {
  const results = [];
  for (const [width, height] of viewports) {
    for (const reducedMotion of [false, true]) {
      const { page, events } = await newPage(browser, { width, height }, reducedMotion);
      try {
        await page.goto(`${ROOT}/works/portrait-2026-09-12/`, { waitUntil: 'networkidle' });
        const frame = await frameFor(page);
        await page.waitForTimeout(reducedMotion ? 120 : 180);
        const state = await frame.evaluate(() => window.__mutinePortraitV008?.getState());
        const layout = await geometry(page, frame);
        const file = `canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
        await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
        results.push({ width, height, reducedMotion, state, layout, capture: file, ...issuesFor(events) });
      } finally {
        await page.close();
      }
    }
  }
  return results;
}

async function runRawInteraction(browser) {
  const { page, events } = await newPage(browser, { width: 390, height: 844 }, false);
  try {
    await page.goto(`${ROOT}/studies/self-portrait/v008/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
    const canvas = page.locator('#field');
    await canvas.waitFor({ state: 'visible' });
    const initial = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    await canvas.click({ position: { x: 190, y: 320 } });
    const pointer = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    await canvas.focus();
    await canvas.press('Enter');
    const keyboard = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    await page.locator('#undo-control').click();
    const lifted = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    await page.locator('#release-control').click();
    const released = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    const controls = await page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: rect.width, height: rect.height };
    }));
    await page.screenshot({ path: `${OUT}/raw-interaction-390x844.png`, fullPage: true });
    return {
      initial,
      pointer,
      keyboard,
      lifted,
      released,
      controls,
      layout: await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
      capture: 'raw-interaction-390x844.png',
      ...issuesFor(events)
    };
  } finally {
    await page.close();
  }
}

async function runRawBlind(browser) {
  const { page, events } = await newPage(browser, { width: 390, height: 844 }, true);
  try {
    await page.goto(`${ROOT}/studies/self-portrait/v008/?preview=1&static=1`, { waitUntil: 'networkidle' });
    await page.locator('#field').waitFor({ state: 'visible' });
    const state = await page.evaluate(() => window.__mutinePortraitV008?.getState());
    const hidden = await page.evaluate(() => ({
      readout: getComputedStyle(document.querySelector('.surface-readout')).display === 'none',
      controls: getComputedStyle(document.querySelector('.field-controls')).display === 'none',
      header: getComputedStyle(document.querySelector('.studio-header')).display === 'none'
    }));
    await page.screenshot({ path: `${OUT}/raw-blind-390x844.png`, fullPage: true });
    return { state, hidden, layout: await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })), capture: 'raw-blind-390x844.png', ...issuesFor(events) };
  } finally {
    await page.close();
  }
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const matrix = await runMatrix(browser);
  const interaction = await runRawInteraction(browser);
  const blind = await runRawBlind(browser);
  const result = {
    generatedAt: new Date().toISOString(),
    route: `${ROOT}/works/portrait-2026-09-12/`,
    rawPreview: `${ROOT}/studies/self-portrait/v008/?preview=1&interaction=1`,
    matrix,
    interaction,
    blind
  };
  await writeFile(`${OUT}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ matrix: matrix.length, interaction, blind }, null, 2)}\n`);
} finally {
  await browser.close();
}
