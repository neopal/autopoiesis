import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const OUT = 'research/qa/proofs/portrait-v007-2026-09-11';

async function pageWithEvents(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const events = { pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => {
    if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return { page, events };
}

function frameFor(page) {
  return page.frames().find((frame) => frame.url().includes('/studies/self-portrait/v007/'));
}

const layout = (page) => page.evaluate(() => ({
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const canonicalRun = await pageWithEvents(browser, { width: 390, height: 844 });
  const canonicalResponse = await canonicalRun.page.goto(`${ROOT}/works/portrait-2026-09-11/`, { waitUntil: 'networkidle' });
  const canonicalFrame = frameFor(canonicalRun.page);
  await canonicalRun.page.locator('.work-inspect__stage iframe').waitFor({ state: 'visible' });
  await canonicalFrame.locator('#field').waitFor({ state: 'visible' });
  const canonical = {
    status: canonicalResponse.status(),
    title: await canonicalRun.page.locator('.work-inspect__heading h1').textContent(),
    tableauFirst: await canonicalRun.page.evaluate(() => document.querySelector('.work-inspect__stage iframe').getBoundingClientRect().top < document.querySelector('.work-inspect__heading h1').getBoundingClientRect().top),
    canvas: await canonicalFrame.locator('#field').count(),
    layout: await layout(canonicalRun.page),
    capture: 'production-canonical-390x844.png',
    ...canonicalRun.events
  };
  await canonicalRun.page.screenshot({ path: `${OUT}/${canonical.capture}`, fullPage: true });
  await canonicalRun.page.close();

  const journalRun = await pageWithEvents(browser, { width: 390, height: 844 });
  const journalResponse = await journalRun.page.goto(`${ROOT}/journal/`, { waitUntil: 'networkidle' });
  const journal = {
    status: journalResponse.status(),
    anchorCount: await journalRun.page.locator('#journal-portrait-2026-09-11').count(),
    titleCount: await journalRun.page.locator('#journal-portrait-2026-09-11 h3').filter({ hasText: 'The face looks away from its decision.' }).count(),
    workHrefCount: await journalRun.page.locator('#journal-portrait-2026-09-11 a[href="/works/portrait-2026-09-11/#journal"]').count(),
    layout: await layout(journalRun.page),
    capture: 'production-journal-390x844.png',
    ...journalRun.events
  };
  await journalRun.page.screenshot({ path: `${OUT}/${journal.capture}`, fullPage: true });
  await journalRun.page.close();

  const rawRun = await pageWithEvents(browser, { width: 390, height: 844 });
  const rawResponse = await rawRun.page.goto(`${ROOT}/studies/self-portrait/v007/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const rawFrame = frameFor(rawRun.page);
  await rawFrame.locator('#field').waitFor({ state: 'visible' });
  const canvas = rawFrame.locator('#field');
  const initial = await rawFrame.evaluate(() => window.__mutinePortraitV007?.getState());
  await canvas.click({ position: { x: 190, y: 320 } });
  const pointer = await rawFrame.evaluate(() => window.__mutinePortraitV007?.getState());
  await canvas.focus();
  await canvas.press('Enter');
  const keyboard = await rawFrame.evaluate(() => window.__mutinePortraitV007?.getState());
  await rawFrame.locator('#undo-control').click();
  const lifted = await rawFrame.evaluate(() => window.__mutinePortraitV007?.getState());
  const raw = {
    status: rawResponse.status(),
    initial,
    pointer,
    keyboard,
    lifted,
    controls: await rawFrame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height }))),
    layout: await rawFrame.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
    capture: 'production-raw-interaction-390x844.png',
    ...rawRun.events
  };
  await rawRun.page.screenshot({ path: `${OUT}/${raw.capture}`, fullPage: true });
  await rawRun.page.close();

  const result = { generatedAt: new Date().toISOString(), stableAlias: ROOT, canonical, journal, raw };
  await writeFile(`${OUT}/production-results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
