import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const raw = `${base}/studies/naive-art/v014/?preview=1&interaction=1`;
const blind = `${base}/studies/naive-art/v014/?preview=1&static=1&blind=1`;
const proofDir = 'research/qa/proofs/naive-art-v014-2026-09-21';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
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

for (const viewport of viewports) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const issues = attachIssues(page);
    const response = await page.goto(raw, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#field');
    await page.waitForTimeout(120);
    const snapshot = await page.evaluate((issues) => {
      const canvas = document.querySelector('#field');
      const rect = canvas?.getBoundingClientRect();
      return {
        responseStatus: 200,
        viewport: { width: innerWidth, height: innerHeight },
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvas: { width: rect?.width ?? 0, height: rect?.height ?? 0, visible: Boolean(rect?.width && rect?.height) },
        controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
        stage: document.querySelector('[data-stage]')?.textContent,
        memory: document.querySelector('[data-memory]')?.textContent,
        console: [...issues.console],
        pageErrors: [...issues.pageErrors],
        requestFailures: [...issues.requestFailures],
        badResponses: [...issues.badResponses]
      };
    }, issues);
    snapshot.responseStatus = response?.status() ?? null;
    await page.screenshot({ path: `${proofDir}/raw-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: true });
    results.viewports.push(snapshot);
    await context.close();
  }
}

{
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = attachIssues(page);
  const response = await page.goto(raw, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#field');
  await page.waitForTimeout(120);
  const canvas = page.locator('#field');
  const initialCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const initial = await page.evaluate((issues) => ({
    responseStatus: 200,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    stage: document.querySelector('[data-stage]')?.textContent,
    memory: document.querySelector('[data-memory]')?.textContent,
    canvas: Boolean(document.querySelector('#field')),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
    console: [...issues.console],
    pageErrors: [...issues.pageErrors],
    requestFailures: [...issues.requestFailures],
    badResponses: [...issues.badResponses]
  }), issues);
  initial.responseStatus = response?.status() ?? null;
  await canvas.click({ position: { x: 195, y: 420 } });
  await page.waitForTimeout(80);
  const pointerCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const pointer = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, interaction: globalThis.__mutineNaiveV014?.getState()?.interaction }));
  await canvas.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const keyboardCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const keyboard = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, interaction: globalThis.__mutineNaiveV014?.getState()?.interaction }));
  await page.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: true });
  await page.locator('#undo-control').click();
  await page.waitForTimeout(80);
  const afterUndoCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const undo = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, interaction: globalThis.__mutineNaiveV014?.getState()?.interaction }));
  await page.locator('#release-control').click();
  await page.waitForTimeout(80);
  const release = await page.evaluate((issues) => ({
    memory: document.querySelector('[data-memory]')?.textContent,
    stage: document.querySelector('[data-stage]')?.textContent,
    interaction: globalThis.__mutineNaiveV014?.getState()?.interaction,
    console: [...issues.console],
    pageErrors: [...issues.pageErrors],
    requestFailures: [...issues.requestFailures],
    badResponses: [...issues.badResponses]
  }), issues);
  results.interaction = {
    viewport,
    initial,
    initialCanvasChangedAfterPointer: initialCanvas !== pointerCanvas,
    pointer,
    keyboard,
    undo,
    release,
    keyboardCanvasChanged: keyboardCanvas !== pointerCanvas,
    undoRestoredPointerState: afterUndoCanvas === pointerCanvas,
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
  const response = await page.goto(blind, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#field');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${proofDir}/static-blind-390x844.png`, fullPage: true });
  results.blind = await page.evaluate((issues) => {
    const canvas = document.querySelector('#field');
    const rect = canvas.getBoundingClientRect();
    return {
      url: location.href,
      responseStatus: 200,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: { width: rect.width, height: rect.height, visible: Boolean(rect.width && rect.height) },
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      stage: document.querySelector('[data-stage]')?.textContent,
      memory: document.querySelector('[data-memory]')?.textContent,
      console: [...issues.console],
      pageErrors: [...issues.pageErrors],
      requestFailures: [...issues.requestFailures],
      badResponses: [...issues.badResponses]
    };
  }, issues);
  results.blind.responseStatus = response?.status() ?? null;
  await context.close();
}

await browser.close();
await writeFile(`${proofDir}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ viewports: results.viewports.length, interaction: Boolean(results.interaction), blind: Boolean(results.blind) }));
