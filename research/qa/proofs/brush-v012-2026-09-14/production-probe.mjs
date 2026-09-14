import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const outDirUrl = new URL('./production/', import.meta.url);
const outDir = fileURLToPath(outDirUrl);
const base = 'https://autopoiesis-nine.vercel.app';
const workId = 'brush-2026-09-14';
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: 'no-preference' });
const results = { base, workId, json: null, canonical: null, journal: null, raw: null, favicon: null, issues: [] };

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

const jsonResponse = await fetch(`${base}/studio/data/works.json`);
const json = await jsonResponse.json();
const record = json.works.find((entry) => entry.id === workId);
results.json = {
  status: jsonResponse.status,
  schema: json.schema,
  matchCount: json.works.filter((entry) => entry.id === workId).length,
  title: record?.title,
  rawPath: record?.rawPath,
  journalAnchor: record?.journal?.anchor,
  statusLabel: record?.status
};

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'production-canonical-390x844');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/works/${workId}/`, { waitUntil: 'networkidle' });
  await page.locator('.work-inspect__stage iframe').waitFor();
  const frame = page.locator('.work-inspect__stage iframe').contentFrame();
  await frame.locator('#field').waitFor();
  const evidence = await page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeBeforeHeading: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim(),
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length
    };
  });
  await page.screenshot({ path: join(outDir, 'canonical-390x844.png'), fullPage: true });
  results.canonical = { ...evidence, issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses } };
  await page.close();
}

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'production-journal-390x844');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(() => {
    const entries = [...document.querySelectorAll('#journal-brush-2026-09-14')];
    const entry = entries[0];
    return {
      innerWidth: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      matchCount: entries.length,
      title: entry?.querySelector('h3')?.textContent?.trim(),
      href: entry?.querySelector('a')?.getAttribute('href')
    };
  });
  await page.screenshot({ path: join(outDir, 'journal-390x844.png'), fullPage: true });
  results.journal = { ...evidence, issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses } };
  await page.close();
}

{
  const page = await context.newPage();
  const issues = attachIssues(page, 'production-raw-interaction-390x844');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/studies/p5-brush/v012/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const canvas = page.locator('#field');
  const lift = page.locator('#lift-wake');
  const release = page.locator('#release-sequence');
  await canvas.waitFor();
  const initial = await page.locator('[data-memory]').textContent();
  const initialImage = await canvas.evaluate((node) => node.toDataURL());
  await canvas.click({ position: { x: 140, y: 180 } });
  await page.waitForTimeout(40);
  const afterPointer = await page.locator('[data-memory]').textContent();
  const pointerImage = await canvas.evaluate((node) => node.toDataURL());
  await canvas.press('Enter');
  await page.waitForTimeout(40);
  const afterKeyboard = await page.locator('[data-memory]').textContent();
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
  const evidence = await page.evaluate(() => ({
    innerWidth: innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    buttonHeights: [...document.querySelectorAll('.field-controls button')].map((node) => node.getBoundingClientRect().height)
  }));
  await page.screenshot({ path: join(outDir, 'raw-interaction-390x844.png'), fullPage: true });
  results.raw = {
    initial, afterPointer, afterKeyboard, afterLift, afterSecondLift, afterRelease,
    changedAfterPointer: pointerImage !== initialImage,
    liftedMatchesPointer: liftedImage === pointerImage,
    ...evidence,
    issues: { console: issues.console, pageErrors: issues.pageErrors, requestFailures: issues.requestFailures, badResponses: issues.badResponses }
  };
  await page.close();
}

const faviconResponse = await fetch(`${base}/studio/favicon.svg`);
results.favicon = { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type') };
await context.close();
await browser.close();
await writeFile(new URL('results.json', outDirUrl), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
