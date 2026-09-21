import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const canonical = `${base}/works/naive-2026-09-21/`;
const raw = `${base}/studies/naive-art/v014/?preview=1&interaction=1`;
const blind = `${base}/studies/naive-art/v014/?preview=1&static=1&blind=1`;
const journal = `${base}/journal/`;
const worksJson = `${base}/studio/data/works.json`;
const favicon = `${base}/studio/favicon.svg`;
const proofDir = 'research/qa/proofs/naive-art-v014-2026-09-21/production';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = { viewports: [], interaction: null, blind: null, json: null, journal: null, favicon: null };

function attachIssues(page) {
  const issues = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`); });
  return issues;
}

for (const viewport of viewports) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const issues = attachIssues(page);
    const response = await page.goto(canonical, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForSelector('.work-inspect__stage iframe');
    await page.waitForFunction(() => document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field'));
    await page.waitForTimeout(120);
    const snapshot = await page.evaluate(({ viewport, reduced, issues }) => {
      const mount = document.querySelector('[data-catalog-work-detail]');
      const iframe = mount?.querySelector('iframe');
      const heading = mount?.querySelector('h1');
      const firstElements = mount ? [...mount.querySelectorAll('*')] : [];
      const frameDocument = iframe?.contentDocument;
      const canvas = frameDocument?.querySelector('#field');
      const canvasRect = canvas?.getBoundingClientRect();
      const iframeRect = iframe?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const frameButtons = frameDocument ? [...frameDocument.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })) : [];
      return {
        url: location.href,
        viewport,
        reducedMotion: reduced,
        responseStatus: 200,
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
        tableauFirst: iframe && heading ? firstElements.indexOf(iframe) < firstElements.indexOf(heading) : false,
        iframeVisible: Boolean(iframeRect?.width && iframeRect?.height),
        headingVisible: Boolean(headingRect?.width && headingRect?.height),
        frameCanvas: canvas ? { width: canvasRect.width, height: canvasRect.height, visible: Boolean(canvasRect.width && canvasRect.height), stage: frameDocument.querySelector('[data-stage]')?.textContent, memory: frameDocument.querySelector('[data-memory]')?.textContent } : null,
        frameButtons,
        console: [...issues.console],
        pageErrors: [...issues.pageErrors],
        requestFailures: [...issues.requestFailures],
        badResponses: [...issues.badResponses]
      };
    }, { viewport, reduced, issues });
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
  const canvas = page.locator('#field');
  const initialCanvas = await canvas.evaluate((node) => node.toDataURL('image/png'));
  const initial = await page.evaluate((issues) => ({
    url: location.href,
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
    url: page.url(),
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

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = attachIssues(page);
  const response = await page.goto(worksJson, { waitUntil: 'domcontentloaded' });
  const body = await page.evaluate(() => document.body.textContent);
  const payload = JSON.parse(body);
  const matches = payload.works.filter((work) => work.id === 'naive-2026-09-21');
  results.json = {
    url: page.url(),
    responseStatus: response?.status() ?? null,
    contentType: response?.headers()['content-type'] ?? null,
    matchingRecords: matches.length,
    title: matches[0]?.title,
    rawPath: matches[0]?.rawPath,
    journalAnchor: matches[0]?.journal?.anchor,
    console: issues.console,
    pageErrors: issues.pageErrors,
    requestFailures: issues.requestFailures,
    badResponses: issues.badResponses
  };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const issues = attachIssues(page);
  const response = await page.goto(journal, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#journal-naive-2026-09-21');
  await page.waitForTimeout(120);
  results.journal = await page.evaluate((issues) => {
    const entry = document.querySelectorAll('#journal-naive-2026-09-21');
    const link = document.querySelector('a[href="/works/naive-2026-09-21/#journal"]');
    return {
      url: location.href,
      responseStatus: 200,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      matchingAnchors: entry.length,
      titleCount: [...document.querySelectorAll('h2,h3,h4')].filter((node) => node.textContent.includes('The mistake refuses a room.')).length,
      canonicalLink: Boolean(link),
      console: [...issues.console],
      pageErrors: [...issues.pageErrors],
      requestFailures: [...issues.requestFailures],
      badResponses: [...issues.badResponses]
    };
  }, issues);
  results.journal.responseStatus = response?.status() ?? null;
  await page.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const response = await context.request.get(favicon);
  results.favicon = { status: response.status(), contentType: response.headers()['content-type'] ?? null, url: favicon };
  await context.close();
}

await browser.close();
await writeFile(`${proofDir}/results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ viewports: results.viewports.length, interaction: Boolean(results.interaction), blind: Boolean(results.blind), json: results.json?.matchingRecords, journal: results.journal?.matchingAnchors, favicon: results.favicon?.status }));
