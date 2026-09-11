import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const OUT = 'research/qa/proofs/naive-art-v007-2026-09-11';
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

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
  await page.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ state: 'visible' });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v007/'));
  if (!frame) throw new Error('v007 tableau iframe did not attach');
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
        await page.goto(`${ROOT}/works/naive-2026-09-11/`, { waitUntil: 'networkidle' });
        const frame = await frameFor(page);
        await page.waitForTimeout(reducedMotion ? 120 : 180);
        const state = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
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
    await page.goto(`${ROOT}/studies/naive-art/v007/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v007/'));
    if (!frame) throw new Error('raw interactive v007 frame did not attach');
    const canvas = frame.locator('#field');
    await canvas.waitFor({ state: 'visible' });
    const initial = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    await canvas.click({ position: { x: 190, y: 320 } });
    const pointer = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    await canvas.focus();
    await canvas.press('Enter');
    const keyboard = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    await frame.locator('#undo-control').click();
    const lifted = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    await frame.locator('#release-control').click();
    const released = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    const controls = await frame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => {
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
      layout: await geometry(page, frame),
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
    await page.goto(`${ROOT}/studies/naive-art/v007/?preview=1&static=1`, { waitUntil: 'networkidle' });
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v007/'));
    if (!frame) throw new Error('raw blind v007 frame did not attach');
    await frame.locator('#field').waitFor({ state: 'visible' });
    const state = await frame.evaluate(() => window.__mutineNaiveV007?.getState());
    const hidden = await frame.evaluate(() => ({
      readout: getComputedStyle(document.querySelector('.field-readout')).display === 'none',
      controls: getComputedStyle(document.querySelector('.field-controls')).display === 'none',
      header: getComputedStyle(document.querySelector('.studio-header')).display === 'none',
      svgNotation: document.querySelectorAll('#field text').length === 0
    }));
    await page.screenshot({ path: `${OUT}/raw-blind-390x844.png`, fullPage: true });
    return { state, hidden, layout: await geometry(page, frame), capture: 'raw-blind-390x844.png', ...issuesFor(events) };
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
    route: `${ROOT}/works/naive-2026-09-11/`,
    rawPreview: `${ROOT}/studies/naive-art/v007/?preview=1&interaction=1`,
    matrix,
    interaction,
    blind
  };
  await writeFile(`${OUT}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ matrix: matrix.length, interaction, blind }, null, 2)}\n`);
} finally {
  await browser.close();
}
