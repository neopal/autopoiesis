import { chromium } from 'file:///C:/Users/ASUS/AppData/Local/Temp/mutine-browser/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const proofDir = 'research/qa/proofs/brush-v013-2026-09-15';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = { viewports: [], interaction: null, blind: null };

function attachIssues(page) {
  const issues = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`);
  });
  return issues;
}

async function waitForTableau(page) {
  await page.waitForSelector('iframe');
  await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#field'));
  await page.waitForTimeout(120);
}

async function outerAndTableauSnapshot(page, issues) {
  return page.evaluate(({ consoleMessages, pageErrors, requestFailures, badResponses }) => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    const firstElements = mount ? [...mount.querySelectorAll('*')] : [];
    const frameDocument = iframe?.contentDocument;
    const canvas = frameDocument?.querySelector('#field');
    const frameButtons = frameDocument ? [...frameDocument.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id, width: rect.width, height: rect.height };
    }) : [];
    const frameCanvasRect = canvas?.getBoundingClientRect();
    const iframeRect = iframe?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    return {
      url: location.href,
      responseStatus: 200,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      tableauFirst: iframe && heading ? firstElements.indexOf(iframe) < firstElements.indexOf(heading) : false,
      iframeRect: iframeRect ? { x: iframeRect.x, y: iframeRect.y, width: iframeRect.width, height: iframeRect.height } : null,
      headingRect: headingRect ? { x: headingRect.x, y: headingRect.y, width: headingRect.width, height: headingRect.height } : null,
      frameCanvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: frameCanvasRect.width,
        clientHeight: frameCanvasRect.height,
        stage: frameDocument.querySelector('[data-stage]')?.textContent,
        memory: frameDocument.querySelector('[data-memory]')?.textContent
      } : null,
      frameButtons,
      console: [...consoleMessages],
      pageErrors: [...pageErrors],
      requestFailures: [...requestFailures],
      badResponses: [...badResponses]
    };
  }, { consoleMessages: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses });
}

for (const viewport of viewports) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const issues = attachIssues(page);
    const response = await page.goto(`${base}/works/brush-2026-09-15/`, { waitUntil: 'domcontentloaded' });
    await waitForTableau(page);
    const snapshot = await outerAndTableauSnapshot(page, issues);
    snapshot.responseStatus = response?.status() ?? null;
    snapshot.reducedMotion = reduced;
    snapshot.viewport = viewport;
    await page.screenshot({ path: `${proofDir}/canonical-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: true });
    results.viewports.push(snapshot);
    await context.close();
  }
}

{
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = attachIssues(page);
  const response = await page.goto(`${base}/studies/p5-brush/v013/?preview=1&interaction=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#field');
  await page.waitForTimeout(120);
  const initial = await page.evaluate(({ consoleMessages, pageErrors, requestFailures, badResponses }) => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    stage: document.querySelector('[data-stage]')?.textContent,
    memory: document.querySelector('[data-memory]')?.textContent,
    canvas: Boolean(document.querySelector('#field')),
    controls: [...document.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id, width: rect.width, height: rect.height };
    }),
    console: [...consoleMessages], pageErrors: [...pageErrors], requestFailures: [...requestFailures], badResponses: [...badResponses]
  }), { consoleMessages: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses });
  initial.responseStatus = response?.status() ?? null;
  const canvas = page.locator('#field');
  await canvas.click({ position: { x: 195, y: 420 } });
  await page.waitForTimeout(80);
  const pointerCanvas = await canvas.evaluate((node) => node.toDataURL());
  const afterPointer = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent }));
  await canvas.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const beforeLiftCanvas = await canvas.evaluate((node) => node.toDataURL());
  const afterKeyboard = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent }));
  await page.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: true });
  await page.locator('#lift-seam').click();
  await page.waitForTimeout(80);
  const afterLiftCanvas = await canvas.evaluate((node) => node.toDataURL());
  const afterLift = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent }));
  await page.locator('#release-sequence').click();
  await page.waitForTimeout(80);
  const afterRelease = await page.evaluate(({ consoleMessages, pageErrors, requestFailures, badResponses }) => ({
    memory: document.querySelector('[data-memory]')?.textContent,
    stage: document.querySelector('[data-stage]')?.textContent,
    console: [...consoleMessages], pageErrors: [...pageErrors], requestFailures: [...requestFailures], badResponses: [...badResponses]
  }), { consoleMessages: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses });
  results.interaction = {
    viewport,
    url: page.url(),
    initial,
    pointer: afterPointer,
    keyboard: afterKeyboard,
    lifted: afterLift,
    released: afterRelease,
    pointerCanvasChanged: pointerCanvas !== await canvas.evaluate((node) => node.toDataURL()),
    liftRestoredPointerState: afterLiftCanvas === pointerCanvas,
    keyboardCanvasChanged: beforeLiftCanvas !== pointerCanvas,
    finalScrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    canvasVisible: await canvas.isVisible()
  };
  await context.close();
}

{
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = attachIssues(page);
  const response = await page.goto(`${base}/studies/p5-brush/v013/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#field');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${proofDir}/static-blind-390x844.png`, fullPage: true });
  results.blind = await page.evaluate(({ consoleMessages, pageErrors, requestFailures, badResponses }) => {
    const canvas = document.querySelector('#field');
    const rect = canvas.getBoundingClientRect();
    return {
      url: location.href,
      responseStatus: 200,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: { width: rect.width, height: rect.height, visible: Boolean(canvas) },
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      stage: document.querySelector('[data-stage]')?.textContent,
      memory: document.querySelector('[data-memory]')?.textContent,
      console: [...consoleMessages], pageErrors: [...pageErrors], requestFailures: [...requestFailures], badResponses: [...badResponses]
    };
  }, { consoleMessages: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses });
  results.blind.responseStatus = response?.status() ?? null;
  await context.close();
}

await browser.close();
await writeFile(`${proofDir}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ viewports: results.viewports.length, interaction: Boolean(results.interaction), blind: Boolean(results.blind) }));
