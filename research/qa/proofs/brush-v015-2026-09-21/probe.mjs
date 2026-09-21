import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/brush-2026-09-21/`;
const raw = `${base}/studies/p5-brush/v015/?preview=1&interaction=1`;
const blind = `${base}/studies/p5-brush/v015/?preview=1&static=1&blind=1`;
const proofDir = 'research/qa/proofs/brush-v015-2026-09-21';
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

async function waitForTableau(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForSelector('.work-inspect__stage iframe');
  await page.waitForFunction(() => document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field'));
  await page.waitForTimeout(120);
}

async function snapshotCanonical(page, viewport, reduced, issues, response) {
  return page.evaluate(({ viewport, reduced, issues }) => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    const firstElements = mount ? [...mount.querySelectorAll('*')] : [];
    const frameDocument = iframe?.contentDocument;
    const canvas = frameDocument?.querySelector('#field');
    const canvasRect = canvas?.getBoundingClientRect();
    const iframeRect = iframe?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    const frameButtons = frameDocument ? [...frameDocument.querySelectorAll('button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id, width: rect.width, height: rect.height };
    }) : [];
    return {
      url: location.href,
      responseStatus: 200,
      viewport,
      reducedMotion: reduced,
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
        clientWidth: canvasRect.width,
        clientHeight: canvasRect.height,
        visible: Boolean(canvasRect.width && canvasRect.height),
        stage: frameDocument.querySelector('[data-stage]')?.textContent,
        memory: frameDocument.querySelector('[data-memory]')?.textContent
      } : null,
      frameButtons,
      console: [...issues.console],
      pageErrors: [...issues.pageErrors],
      requestFailures: [...issues.requestFailures],
      badResponses: [...issues.badResponses]
    };
  }, { viewport, reduced, issues });
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
    const response = await page.goto(canonical, { waitUntil: 'domcontentloaded' });
    await waitForTableau(page);
    const snapshot = await snapshotCanonical(page, viewport, reduced, issues, response);
    snapshot.responseStatus = response?.status() ?? null;
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
  const response = await page.goto(raw, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#field');
  await page.waitForTimeout(120);
  const initial = await page.evaluate((issues) => ({
    responseStatus: 200,
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
    console: [...issues.console],
    pageErrors: [...issues.pageErrors],
    requestFailures: [...issues.requestFailures],
    badResponses: [...issues.badResponses]
  }), issues);
  initial.responseStatus = response?.status() ?? null;
  const canvas = page.locator('#field');
  const initialCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  await canvas.click({ position: { x: 195, y: 420 } });
  await page.waitForTimeout(80);
  const pointerCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const afterPointer = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent, interaction: globalThis.__MUTINE_STATE?.interaction }));
  await canvas.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const beforeLiftCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const afterKeyboard = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent, interaction: globalThis.__MUTINE_STATE?.interaction }));
  await page.screenshot({ path: `${proofDir}/raw-interaction-390x844.png`, fullPage: true });
  await page.locator('#lift-basin').click();
  await page.waitForTimeout(80);
  const afterLiftCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const afterLift = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, stage: document.querySelector('[data-stage]')?.textContent, interaction: globalThis.__MUTINE_STATE?.interaction }));
  await page.locator('#release-sequence').click();
  await page.waitForTimeout(80);
  const afterRelease = await page.evaluate((issues) => ({
    memory: document.querySelector('[data-memory]')?.textContent,
    stage: document.querySelector('[data-stage]')?.textContent,
    interaction: globalThis.__MUTINE_STATE?.interaction,
    console: [...issues.console],
    pageErrors: [...issues.pageErrors],
    requestFailures: [...issues.requestFailures],
    badResponses: [...issues.badResponses]
  }), issues);
  results.interaction = {
    viewport,
    url: page.url(),
    initial,
    initialCanvasChangedAfterPointer: initialCanvas !== pointerCanvas,
    pointer: afterPointer,
    keyboard: afterKeyboard,
    lifted: afterLift,
    released: afterRelease,
    keyboardCanvasChanged: beforeLiftCanvas !== pointerCanvas,
    liftRestoredPointerState: afterLiftCanvas === pointerCanvas,
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
      innerWidth: window.innerWidth,
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
