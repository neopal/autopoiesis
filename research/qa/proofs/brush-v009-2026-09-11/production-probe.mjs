import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const canonical = `${base}/works/brush-2026-09-11/`;
const raw = `${base}/studies/p5-brush/v009/?preview=1&interaction=1`;
const blind = `${base}/studies/p5-brush/v009/?preview=1&static=1&blind=1`;
const proofDir = 'research/qa/proofs/brush-v009-2026-09-11/production';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];

await mkdir(proofDir, { recursive: true });

function hooks(page, log) {
  page.on('console', (message) => log.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => log.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => log.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) log.httpErrors.push(`${response.status()} ${response.url()}`);
  });
}

async function viewportEvidence(page, width, height) {
  return page.evaluate(({ width: targetWidth, height: targetHeight }) => {
    const first = (selector) => document.querySelector(selector);
    const rect = (selector) => {
      const element = first(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, left: box.left, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const iframe = first('.artwork-frame--inspect iframe');
    const heading = first('.work-inspect__heading h1');
    const buttonRects = [...document.querySelectorAll('button')].map((button) => {
      const box = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: box.width, height: box.height };
    });
    return {
      targetWidth,
      targetHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      tableauTop: iframe?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      tableauFirst: Boolean(iframe && heading && iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top),
      buttonRects,
      ready: Boolean(document.querySelector('[data-catalog-work-detail][data-ready="true"]')),
      title: first('.work-inspect__heading h1')?.textContent.trim() ?? null
    };
  }, { width, height });
}

async function inspectCanonical(browser, width, height, reduced) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const log = { route: canonical, viewport: `${width}x${height}`, reducedMotion: reduced, console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  hooks(page, log);
  const response = await page.goto(canonical, { waitUntil: 'networkidle' });
  await page.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ timeout: 10000 });
  await page.locator('.work-inspect__stage iframe').waitFor({ timeout: 10000 });
  const evidence = await viewportEvidence(page, width, height);
  await page.screenshot({ path: `${proofDir}/canonical-${width}x${height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: true });
  log.status = response?.status() ?? null;
  log.evidence = evidence;
  await context.close();
  return log;
}

async function frameFor(page) {
  const iframe = page.locator('.work-inspect__stage iframe');
  await iframe.waitFor();
  const handle = await iframe.elementHandle();
  const contentFrame = await handle.contentFrame();
  if (!contentFrame) throw new Error('embedded v009 frame not available');
  await contentFrame.locator('#field').waitFor();
  return contentFrame;
}

async function inspectRaw(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const log = { route: raw, viewport: `${width}x${height}`, console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  hooks(page, log);
  const response = await page.goto(raw, { waitUntil: 'networkidle' });
  const frame = page;
  await frame.locator('#field').waitFor();
  const initial = await frame.locator('[data-memory]').textContent();
  const buttons = await frame.locator('button').count();
  const rects = await frame.locator('button').evaluateAll((items) => items.map((button) => {
    const box = button.getBoundingClientRect();
    return { label: button.textContent.trim(), width: box.width, height: box.height };
  }));
  const canvas = frame.locator('#field');
  await canvas.click({ position: { x: width / 2, y: height / 2 } });
  const afterPointer = await frame.locator('[data-memory]').textContent();
  const pointerPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await canvas.focus();
  await canvas.press('Enter');
  const afterKeyboard = await frame.locator('[data-memory]').textContent();
  await frame.locator('#lift-braid-gate').click();
  const afterLift = await frame.locator('[data-memory]').textContent();
  const liftedPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await frame.locator('#release-sequence').click();
  const afterRelease = await frame.locator('[data-memory]').textContent();
  const outer = await page.evaluate(() => ({ innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  await page.screenshot({ path: `${proofDir}/raw-interaction-${width}x${height}.png`, fullPage: true });
  log.status = response?.status() ?? null;
  log.evidence = { initial, buttons, rects, afterPointer, afterKeyboard, afterLift, afterRelease, reversibleAfterLatestLift: pointerPng === liftedPng, outer };
  await context.close();
  return log;
}

async function inspectBlind(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const log = { route: blind, viewport: `${width}x${height}`, console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  hooks(page, log);
  const response = await page.goto(blind, { waitUntil: 'networkidle' });
  await page.locator('#field').waitFor();
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const rect = field.getBoundingClientRect();
    return {
      innerWidth: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      controlsHidden: getComputedStyle(document.querySelector('.field-controls')).display === 'none',
      readoutHidden: getComputedStyle(document.querySelector('.field-readout')).display === 'none',
      openingHidden: getComputedStyle(document.querySelector('.brush-opening')).display === 'none'
    };
  });
  await page.screenshot({ path: `${proofDir}/raw-blind-${width}x${height}.png`, fullPage: true });
  log.status = response?.status() ?? null;
  log.evidence = evidence;
  await context.close();
  return log;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const [width, height] of viewports) {
  results.push(await inspectCanonical(browser, width, height, false));
  results.push(await inspectCanonical(browser, width, height, true));
}
results.push(await inspectRaw(browser, 390, 844));
results.push(await inspectBlind(browser, 390, 844));
await browser.close();

const failures = results.filter((result) => result.status !== 200 || result.console.length || result.pageErrors.length || result.requestFailures.length || result.httpErrors.length);
const matrix = results.filter((result) => result.route === canonical).every((result) => result.evidence.ready && result.evidence.tableauFirst && result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth <= result.evidence.innerWidth);
const rawResult = results.find((result) => result.route === raw);
const blindResult = results.find((result) => result.route === blind);
const report = {
  generatedAt: new Date().toISOString(),
  target: 'brush-2026-09-11',
  results,
  assertions: {
    noConsoleOrNetworkFailures: failures.length === 0,
    canonicalViewportMatrix: matrix,
    rawInteraction: rawResult?.evidence ?? null,
    rawBlind: blindResult?.evidence ?? null
  }
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  resultCount: results.length,
  failures: failures.length,
  canonicalMatrix: matrix,
  rawInteraction: rawResult?.evidence,
  rawBlind: blindResult?.evidence,
  proofDir
}, null, 2));
if (failures.length || !matrix || !report.assertions.rawInteraction?.reversibleAfterLatestLift || !report.assertions.rawBlind?.controlsHidden) process.exitCode = 1;
