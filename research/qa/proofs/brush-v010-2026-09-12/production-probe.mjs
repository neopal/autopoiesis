import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const canonical = `${base}/works/brush-2026-09-12/`;
const journal = `${base}/journal/`;
const raw = `${base}/studies/p5-brush/v010/?preview=1&interaction=1`;
const proofDir = 'research/qa/proofs/brush-v010-2026-09-12';
const viewport = { width: 390, height: 844 };
await mkdir(`${proofDir}/production`, { recursive: true });

function hooks(page, log) {
  page.on('console', (message) => log.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => log.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => log.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400) log.httpErrors.push(`${response.status()} ${response.url()}`);
  });
}

async function readRecord() {
  const response = await fetch(`${base}/studio/data/works.json`, { redirect: 'manual' });
  const data = await response.json();
  const matches = data.works.filter((entry) => entry.id === 'brush-2026-09-12');
  return {
    status: response.status,
    matches: matches.length,
    title: matches[0]?.title ?? null,
    rawPath: matches[0]?.rawPath ?? null,
    journalAnchor: matches[0]?.journal?.anchor ?? null
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];

const canonicalContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
const canonicalPage = await canonicalContext.newPage();
const canonicalLog = { route: canonical, viewport: '390x844', reducedMotion: true, console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
hooks(canonicalPage, canonicalLog);
const canonicalResponse = await canonicalPage.goto(canonical, { waitUntil: 'networkidle' });
await canonicalPage.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ timeout: 15000 });
await canonicalPage.locator('.work-inspect__stage iframe').waitFor({ timeout: 15000 });
canonicalLog.status = canonicalResponse?.status() ?? null;
canonicalLog.evidence = await canonicalPage.evaluate(() => {
  const iframe = document.querySelector('.artwork-frame--inspect iframe');
  const heading = document.querySelector('.work-inspect__heading h1');
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tableauFirst: Boolean(iframe && heading && iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top),
    tableauTop: iframe?.getBoundingClientRect().top ?? null,
    headingTop: heading?.getBoundingClientRect().top ?? null,
    title: heading?.textContent.trim() ?? null,
    iframeTitle: iframe?.getAttribute('title') ?? null,
    ready: Boolean(document.querySelector('[data-catalog-work-detail][data-ready="true"]'))
  };
});
await canonicalPage.screenshot({ path: `${proofDir}/production/production-canonical-390x844.png`, fullPage: true });
results.push(canonicalLog);
await canonicalContext.close();

const journalContext = await browser.newContext({ viewport, reducedMotion: 'reduce' });
const journalPage = await journalContext.newPage();
const journalLog = { route: journal, viewport: '390x844', reducedMotion: true, console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
hooks(journalPage, journalLog);
const journalResponse = await journalPage.goto(journal, { waitUntil: 'networkidle' });
await journalPage.locator('[data-catalog="journal"][data-ready="true"]').waitFor({ timeout: 15000 });
journalLog.status = journalResponse?.status() ?? null;
journalLog.evidence = await journalPage.evaluate(() => {
  const entry = document.querySelector('#journal-brush-2026-09-12');
  const link = entry?.querySelector('h3 a');
  return {
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    ready: Boolean(document.querySelector('[data-catalog="journal"][data-ready="true"]')),
    anchor: Boolean(entry),
    title: entry?.querySelector('h3')?.textContent.trim() ?? null,
    workHref: link?.getAttribute('href') ?? null
  };
});
await journalPage.screenshot({ path: `${proofDir}/production/production-journal-390x844.png`, fullPage: true });
results.push(journalLog);
await journalContext.close();

const rawContext = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
const rawPage = await rawContext.newPage();
const rawLog = { route: raw, viewport: '390x844', console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
hooks(rawPage, rawLog);
const rawResponse = await rawPage.goto(raw, { waitUntil: 'networkidle' });
await rawPage.locator('#field').waitFor({ timeout: 15000 });
const initial = await rawPage.locator('[data-memory]').textContent();
const rects = await rawPage.locator('button').evaluateAll((items) => items.map((button) => {
  const box = button.getBoundingClientRect();
  return { label: button.textContent.trim(), width: box.width, height: box.height };
}));
const canvas = rawPage.locator('#field');
await canvas.click({ position: { x: 195, y: 300 } });
const afterPointer = await rawPage.locator('[data-memory]').textContent();
const pointerPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
await canvas.focus();
await canvas.press('Enter');
const afterKeyboard = await rawPage.locator('[data-memory]').textContent();
await rawPage.locator('#lift-hinge-curl').click();
const afterLift = await rawPage.locator('[data-memory]').textContent();
const liftedPng = await canvas.evaluate((node) => node.toDataURL('image/png'));
await rawPage.locator('#release-sequence').click();
const afterRelease = await rawPage.locator('[data-memory]').textContent();
rawLog.status = rawResponse?.status() ?? null;
rawLog.evidence = {
  initial,
  rects,
  afterPointer,
  afterKeyboard,
  afterLift,
  afterRelease,
  reversibleAfterLatestLift: pointerPng === liftedPng,
  outer: await rawPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }))
};
await rawPage.screenshot({ path: `${proofDir}/production/production-raw-interaction-390x844.png`, fullPage: true });
results.push(rawLog);
await rawContext.close();

const faviconContext = await browser.newContext({ viewport });
const faviconPage = await faviconContext.newPage();
const faviconLog = { route: `${base}/favicon.ico`, viewport: '390x844', console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
hooks(faviconPage, faviconLog);
const faviconResponse = await faviconPage.goto(`${base}/favicon.ico`, { waitUntil: 'domcontentloaded' });
faviconLog.status = faviconResponse?.status() ?? null;
faviconLog.contentType = faviconResponse?.headers()['content-type'] ?? null;
results.push(faviconLog);
await faviconContext.close();

await browser.close();
const record = await readRecord();
const failures = results.filter((result) => result.status !== 200 || result.console.length || result.pageErrors.length || result.requestFailures.length || result.httpErrors.length);
const rawResult = results.find((result) => result.route === raw);
const canonicalResult = results.find((result) => result.route === canonical);
const journalResult = results.find((result) => result.route === journal);
const report = {
  generatedAt: new Date().toISOString(),
  target: 'brush-2026-09-12',
  stableAlias: base,
  record,
  results,
  assertions: {
    recordExactlyOnce: record.status === 200 && record.matches === 1 && record.title === 'The brush keeps a hinge.' && record.rawPath === '/studies/p5-brush/v010/' && record.journalAnchor === 'journal-brush-2026-09-12',
    canonical: canonicalResult?.status === 200 && canonicalResult.evidence.ready && canonicalResult.evidence.tableauFirst && canonicalResult.evidence.innerWidth === canonicalResult.evidence.clientWidth && canonicalResult.evidence.scrollWidth <= canonicalResult.evidence.innerWidth,
    journal: journalResult?.status === 200 && journalResult.evidence.ready && journalResult.evidence.anchor && journalResult.evidence.title === 'The brush keeps a hinge.' && journalResult.evidence.workHref === '/works/brush-2026-09-12/#journal',
    raw: rawResult?.status === 200 && rawResult.evidence.reversibleAfterLatestLift && rawResult.evidence.outer.innerWidth === rawResult.evidence.outer.clientWidth && rawResult.evidence.outer.scrollWidth <= rawResult.evidence.outer.innerWidth && rawResult.evidence.rects.every((rect) => rect.height >= 44),
    noConsoleOrNetworkFailures: failures.length === 0
  }
};
await writeFile(`${proofDir}/production/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  record,
  resultCount: results.length,
  failures: failures.length,
  assertions: report.assertions,
  raw: rawResult?.evidence,
  canonical: canonicalResult?.evidence,
  journal: journalResult?.evidence,
  proofDir: `${proofDir}/production`
}, null, 2));
if (!report.assertions.recordExactlyOnce || !report.assertions.canonical || !report.assertions.journal || !report.assertions.raw || failures.length) process.exitCode = 1;
