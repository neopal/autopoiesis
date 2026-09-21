import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const workId = 'brush-2026-09-21';
const proofDir = 'research/qa/proofs/brush-v015-2026-09-21/production';
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = { base, workId, json: null, journal: null, canonical: null, raw: null, favicon: null, issues: [] };

function attachIssues(page, label) {
  const issues = { label, console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`); });
  return issues;
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });

{
  const response = await context.request.get(`${base}/studio/data/works.json`);
  const data = await response.json();
  const matches = data.works.filter((work) => work.id === workId);
  results.json = { status: response.status(), matchCount: matches.length, title: matches[0]?.title, rawPath: matches[0]?.rawPath, journalAnchor: matches[0]?.journal?.anchor };
}

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'journal');
  const response = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate((workId) => {
    const entries = [...document.querySelectorAll(`#journal-${workId}`)];
    const entry = entries[0];
    return {
      matchCount: entries.length,
      title: entry?.querySelector('h3')?.textContent?.trim() ?? entry?.textContent?.trim(),
      href: entry?.querySelector('a')?.getAttribute('href') ?? null,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  }, workId);
  results.journal = { status: response?.status() ?? null, ...evidence, issues };
  await page.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: true });
  await page.close();
}

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'canonical');
  const response = await page.goto(`${base}/works/${workId}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForSelector('.work-inspect__stage iframe');
  await page.waitForFunction(() => document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field'));
  const evidence = await page.evaluate((workId) => {
    const mount = document.querySelector(`[data-catalog-work-detail="${workId}"]`);
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return {
      bodyWorkId: document.body.dataset.workId,
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      iframeBeforeHeading: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      title: heading?.textContent?.trim(),
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  }, workId);
  results.canonical = { status: response?.status() ?? null, ...evidence, issues };
  await page.close();
}

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'raw');
  const response = await page.goto(`${base}/studies/p5-brush/v015/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#field');
  const canvas = page.locator('#field');
  await canvas.click({ position: { x: 195, y: 420 } });
  await page.keyboard.press('Enter');
  const beforeLift = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, interaction: globalThis.__MUTINE_STATE?.interaction }));
  await page.locator('#lift-basin').click();
  const afterLift = await page.evaluate(() => ({ memory: document.querySelector('[data-memory]')?.textContent, interaction: globalThis.__MUTINE_STATE?.interaction }));
  results.raw = { status: response?.status() ?? null, beforeLift, afterLift, innerWidth: await page.evaluate(() => innerWidth), clientWidth: await page.evaluate(() => document.documentElement.clientWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), canvasVisible: await canvas.isVisible(), issues };
  await page.close();
}

{
  const response = await context.request.get(`${base}/studio/favicon.svg`);
  results.favicon = { status: response.status(), contentType: response.headers()['content-type'] ?? null };
}

await context.close();
await browser.close();
await writeFile(`${proofDir}/readback-results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ json: results.json, journal: results.journal, canonical: results.canonical, raw: results.raw, favicon: results.favicon }));
