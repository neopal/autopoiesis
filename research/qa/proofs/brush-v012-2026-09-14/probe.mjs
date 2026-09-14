import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const outDirUrl = new URL('./', import.meta.url);
const outDir = fileURLToPath(outDirUrl);
const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/brush-2026-09-14/`;
const raw = `${base}/studies/p5-brush/v012/?preview=1&interaction=1`;
const blind = `${base}/studies/p5-brush/v012/?preview=1&static=1&blind=1`;
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = {
  base,
  canonical,
  raw,
  blind,
  matrix: [],
  interaction: null,
  blindPreview: null,
  issues: []
};

function attachIssues(page, label) {
  const issues = { label, console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.badResponses.push({ url: response.url(), status: response.status() });
  });
  results.issues.push(issues);
  return issues;
}

async function readCanonical(page, label, path, screenshotName) {
  const issues = attachIssues(page, label);
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.locator('.work-inspect__stage iframe').waitFor();
  const frame = page.locator('.work-inspect__stage iframe').contentFrame();
  await frame.locator('#field').waitFor();
  const evidence = await page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading');
    const root = document.documentElement;
    const firstArtwork = iframe?.getBoundingClientRect();
    const intro = heading?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      iframeRect: firstArtwork && { x: firstArtwork.x, y: firstArtwork.y, width: firstArtwork.width, height: firstArtwork.height },
      headingRect: intro && { x: intro.x, y: intro.y, width: intro.width, height: intro.height },
      tableauBeforeHeading: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim(),
      selectedWork: document.body.dataset.workId
    };
  });
  await page.screenshot({ path: join(outDir, screenshotName), fullPage: true });
  return { ...evidence, issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses } };
}

for (const reducedMotion of [false, true]) {
  const context = await browser.newContext({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  for (const viewport of viewports) {
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    const label = `canonical-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}`;
    const item = await readCanonical(page, label, canonical, `canonical-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
    results.matrix.push({ viewport, reducedMotion, ...item });
    await page.close();
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = attachIssues(page, 'raw-interaction-390x844');
  await page.goto(raw, { waitUntil: 'networkidle' });
  const canvas = page.locator('#field');
  const make = page.locator('#make-wake');
  const lift = page.locator('#lift-wake');
  const release = page.locator('#release-sequence');
  await canvas.waitFor();
  const initial = await page.locator('[data-memory]').textContent();
  const initialImage = await canvas.evaluate((node) => node.toDataURL());
  const buttonRects = await Promise.all([make, lift, release].map((button) => button.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  })));
  await canvas.click({ position: { x: 140, y: 180 } });
  await page.waitForTimeout(40);
  const afterPointer = await page.locator('[data-memory]').textContent();
  const pointerImage = await canvas.evaluate((node) => node.toDataURL());
  await canvas.press('Enter');
  await page.waitForTimeout(40);
  const afterKeyboard = await page.locator('[data-memory]').textContent();
  const keyboardImage = await canvas.evaluate((node) => node.toDataURL());
  await lift.click();
  await page.waitForTimeout(40);
  const afterLift = await page.locator('[data-memory]').textContent();
  const liftedImage = await canvas.evaluate((node) => node.toDataURL());
  await lift.click();
  await page.waitForTimeout(40);
  const afterSecondLift = await page.locator('[data-memory]').textContent();
  await release.click();
  await page.waitForTimeout(40);
  const afterRelease = await page.locator('[data-memory]').textContent();
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: (() => { const r = document.querySelector('#field').getBoundingClientRect(); return { width: r.width, height: r.height }; })(),
    controlsVisible: [...document.querySelectorAll('.field-controls button')].every((node) => getComputedStyle(node).display !== 'none')
  }));
  await page.screenshot({ path: join(outDir, 'raw-interaction-390x844.png'), fullPage: true });
  results.interaction = {
    initial,
    afterPointer,
    afterKeyboard,
    afterLift,
    afterSecondLift,
    afterRelease,
    initialImageLength: initialImage.length,
    pointerImageLength: pointerImage.length,
    keyboardImageLength: keyboardImage.length,
    liftedMatchesPointer: liftedImage === pointerImage,
    changedAfterPointer: pointerImage !== initialImage,
    changedAfterKeyboard: keyboardImage !== pointerImage,
    buttonRects,
    geometry,
    issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses }
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = attachIssues(page, 'blind-static-390x844');
  await page.goto(blind, { waitUntil: 'networkidle' });
  await page.locator('#field').waitFor();
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const rect = field.getBoundingClientRect();
    const root = document.documentElement;
    const visible = (selector) => getComputedStyle(document.querySelector(selector)).display !== 'none';
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      canvasVisible: getComputedStyle(field).display !== 'none' && rect.width > 0 && rect.height > 0,
      controlsVisible: visible('.field-controls'),
      readoutVisible: visible('.field-readout'),
      editorialVisible: visible('.brush-opening'),
      canvasRect: { width: rect.width, height: rect.height }
    };
  });
  await page.screenshot({ path: join(outDir, 'blind-static-390x844.png'), fullPage: true });
  results.blindPreview = { ...evidence, issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses } };
  await context.close();
}

await browser.close();
await writeFile(new URL('results.json', outDirUrl), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ matrixRuns: results.matrix.length, interaction: results.interaction, blindPreview: results.blindPreview, issueCounts: results.issues.map((entry) => ({ label: entry.label, console: entry.console.length, pageErrors: entry.pageErrors.length, requestFailures: entry.requestFailures.length, badResponses: entry.badResponses.length })) }, null, 2));
