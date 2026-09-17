import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = 'https://autopoiesis-nine.vercel.app';
const out = new URL('file:///C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v013-2026-09-17/');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
await mkdir(out, { recursive: true });
const results = { stableAlias: root, deployment: 'https://autopoiesis-nhjgkhe4k-lairpa-hotmailfrs-projects.vercel.app', canonical: [], raw: null, journal: null, favicon: null, worksJson: null };

const jsonResponse = await fetch(`${root}/studio/data/works.json?cachebust=naive-v013-2026-09-17`);
results.worksJson = { status: jsonResponse.status, contentType: jsonResponse.headers.get('content-type') };
const register = await jsonResponse.json();
const records = register.works.filter((work) => work.id === 'naive-2026-09-17');
results.worksJson.recordCount = records.length;
results.worksJson.record = records[0] ? { id: records[0].id, title: records[0].title, rawPath: records[0].rawPath, journal: records[0].journal?.anchor } : null;

const favicon = await fetch(`${root}/studio/favicon.svg?cachebust=naive-v013-2026-09-17`);
results.favicon = { status: favicon.status, contentType: favicon.headers.get('content-type') };

async function diagnosticsFor(page) {
  const diagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => diagnostics.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function canonicalRun(viewport, reducedMotion) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = await diagnosticsFor(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${root}/works/naive-2026-09-17/?cachebust=naive-v013-2026-09-17`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-ready="true"]');
  const evidence = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, top: box.top, bottom: box.bottom };
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeCount: document.querySelectorAll('iframe').length,
      iframe: rect('iframe'),
      heading: rect('h1'),
      journalLink: document.querySelector('a[href="/journal/#journal-naive-2026-09-17"]')?.getAttribute('href') ?? null
    };
  });
  results.canonical.push({ viewport, reducedMotion, ...evidence, ...diagnostics });
  await context.close();
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) await canonicalRun(viewport, reducedMotion);
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = await diagnosticsFor(page);
  await page.goto(`${root}/studies/naive-art/v013/?preview=1&interaction=1&cachebust=naive-v013-2026-09-17`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas#field');
  const initial = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const box = await page.locator('canvas#field').boundingBox();
  await page.mouse.click(box.x + box.width * 0.23, box.y + box.height * 0.72);
  const pointer = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const pointerCanvas = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.locator('canvas#field').focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineNaiveV013.getState());
  await page.locator('#undo-control').click();
  const undo = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const undoCanvas = await page.evaluate(() => document.querySelector('canvas').toDataURL());
  await page.locator('#release-control').click();
  const release = await page.evaluate(() => window.__mutineNaiveV013.getState());
  const layout = await page.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })) }));
  results.raw = { initial, pointer, keyboard, undo, release, canvasRestored: pointerCanvas === undoCanvas, layout, ...diagnostics };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const diagnostics = await diagnosticsFor(page);
  await page.goto(`${root}/journal/?cachebust=naive-v013-2026-09-17`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#journal-naive-2026-09-17');
  results.journal = {
    innerWidth: await page.evaluate(() => innerWidth),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    anchorCount: await page.locator('#journal-naive-2026-09-17').count(),
    title: await page.locator('#journal-naive-2026-09-17 h3').innerText(),
    href: await page.locator('#journal-naive-2026-09-17 h3 a').getAttribute('href'),
    ...diagnostics
  };
  await context.close();
}

await writeFile(new URL('production-results.json', out), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
await browser.close();
