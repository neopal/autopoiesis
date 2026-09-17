import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = 'http://127.0.0.1:4173';
const out = new URL('file:///C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v013-2026-09-17/');
const outPath = 'C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v013-2026-09-17';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = { canonical: [], raw: null, staticBlind: null, journal: null };

async function collectPage(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function measure(page, path, media, screenshotName) {
  const diagnostics = await collectPage(page);
  await page.emulateMedia({ reducedMotion: media ? 'reduce' : 'no-preference' });
  await page.goto(`${root}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail], canvas#field, [data-catalog="journal"]');
  await page.waitForTimeout(100);
  const evidence = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, bottom: box.bottom };
    };
    const iframe = document.querySelector('iframe');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
      iframeCount: document.querySelectorAll('iframe').length,
      iframe: rect('iframe'),
      firstCanvas: rect('canvas'),
      heading: rect('h1'),
      ready: document.querySelector('[data-ready="true"]') !== null,
      bodyText: document.body.innerText.slice(0, 260)
    };
  });
  if (screenshotName) await page.screenshot({ path: `${outPath}/${screenshotName}`, fullPage: true });
  return { ...evidence, ...diagnostics };
}

for (const reduced of [false, true]) {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const label = `${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}`;
    const evidence = await measure(page, '/works/naive-2026-09-17/', reduced, `canonical-${label}.png`);
    results.canonical.push({ viewport, reducedMotion: reduced, ...evidence });
    await context.close();
  }
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = await collectPage(page);
  await page.goto(`${root}/studies/naive-art/v013/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas#field');
  await page.waitForTimeout(100);
  const initial = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const box = await page.locator('canvas#field').boundingBox();
  await page.mouse.click(box.x + box.width * 0.23, box.y + box.height * 0.72);
  const pointerState = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const pointerCanvas = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.locator('canvas#field').focus();
  await page.keyboard.press('Enter');
  const keyboardState = await page.evaluate(() => window.__mutineNaiveV013.getState());
  await page.locator('#undo-control').click();
  const undoState = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const undoCanvas = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.locator('#release-control').click();
  const releaseState = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const interactionLayout = await page.evaluate(() => {
    const canvas = document.querySelector('canvas').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width }));
    return { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, canvas: { width: canvas.width, height: canvas.height }, buttons };
  });
  await page.screenshot({ path: `${outPath}/raw-interaction-390x844.png`, fullPage: true });
  results.raw = { initial, pointerState, keyboardState, undoState, releaseState, canvasRestored: pointerCanvas === undoCanvas, interactionLayout, ...diagnostics };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  results.staticBlind = await measure(page, '/studies/naive-art/v013/?preview=1&static=1&blind=1', true, 'static-blind-390x844.png');
  results.staticBlind.controls = await page.locator('.field-controls').evaluate((node) => getComputedStyle(node).display);
  results.staticBlind.readout = await page.locator('.field-readout').evaluate((node) => getComputedStyle(node).display);
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  results.journal = await measure(page, '/journal/', true, 'journal-390x844.png');
  results.journal.anchorCount = await page.locator('#journal-naive-2026-09-17').count();
  results.journal.anchorTitle = await page.locator('#journal-naive-2026-09-17 h3').innerText();
  await context.close();
}

await writeFile(new URL('results.json', out), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
await browser.close();
