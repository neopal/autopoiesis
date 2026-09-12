import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'https://autopoiesis-nine.vercel.app';
const PROOF_DIR = path.resolve('research/qa/proofs/svg-v009-2026-09-12');
const failures = [];
const result = { stableAlias: BASE, routes: {}, failures };

function check(condition, message, detail = null) {
  if (!condition) {
    failures.push({ message, detail });
  }
}

function attachIssues(page, bucket) {
  page.on('console', (message) => bucket.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => bucket.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => bucket.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) bucket.httpErrors.push({ url: response.url(), status: response.status() });
  });
}

const issueSummary = (issues) => ({
  console: issues.console,
  pageErrors: issues.pageErrors,
  requestFailures: issues.requestFailures,
  httpErrors: issues.httpErrors
});

async function readJsonRecord() {
  const response = await fetch(`${BASE}/studio/data/works.json`);
  const data = await response.json();
  const matches = data.works.filter((work) => work.id === 'svg-2026-09-12');
  check(response.ok, 'production works.json HTTP 200', response.status);
  check(matches.length === 1, 'production works.json contains exactly one SVG record', matches.length);
  check(matches[0]?.title === 'The animal keeps a pocket.', 'production JSON title matches', matches[0]?.title);
  check(matches[0]?.rawPath === '/studies/pure-svg/v009/', 'production JSON rawPath matches', matches[0]?.rawPath);
  check(matches[0]?.journal?.anchor === 'journal-svg-2026-09-12', 'production JSON Journal anchor matches', matches[0]?.journal?.anchor);
  result.worksJson = { status: response.status, matchCount: matches.length, title: matches[0]?.title, rawPath: matches[0]?.rawPath, journalAnchor: matches[0]?.journal?.anchor };
}

async function canonicalRead() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const response = await page.goto(`${BASE}/works/svg-2026-09-12/`, { waitUntil: 'networkidle' });
  await page.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ timeout: 15000 });
  const outer = await page.evaluate(() => {
    const figure = document.querySelector('.work-inspect__stage .artwork-frame');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauTop: figure?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? null,
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length
    };
  });
  const study = page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v009/'));
  const inner = study ? await study.locator('#field').evaluate((field) => ({
    width: field.getBoundingClientRect().width,
    height: field.getBoundingClientRect().height,
    memory: field.dataset.memory,
    buttons: [...field.parentElement.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  })) : null;
  check(response?.ok(), 'production canonical HTTP 200', response?.status());
  check(outer.tableauTop !== null && outer.headingTop !== null && outer.tableauTop < outer.headingTop, 'production canonical tableau first', outer);
  check(outer.title === 'The animal keeps a pocket.', 'production canonical rendered title matches', outer.title);
  check(outer.iframeCount === 1 && Boolean(study), 'production canonical embeds v009 once', { iframeCount: outer.iframeCount, frame: Boolean(study) });
  check(outer.innerWidth === outer.clientWidth && outer.scrollWidth <= outer.clientWidth, 'production canonical no overflow', outer);
  check(inner?.width > 0 && inner?.height > 0 && inner?.scrollWidth <= inner?.clientWidth, 'production embedded SVG visible and contained', inner);
  check((inner?.buttons ?? []).every((button) => button.height >= 44), 'production embedded controls are touch-sized', inner?.buttons);
  check(issues.console.length === 0, 'production canonical console empty', issues.console);
  check(issues.pageErrors.length === 0, 'production canonical page errors empty', issues.pageErrors);
  check(issues.requestFailures.length === 0, 'production canonical request failures empty', issues.requestFailures);
  check(issues.httpErrors.length === 0, 'production canonical HTTP 400+ empty', issues.httpErrors);
  const screenshot = path.join(PROOF_DIR, 'production-canonical-390x844.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  result.routes.canonical = { status: response?.status(), outer, inner, issues: issueSummary(issues), screenshot };
  await context.close();
  await browser.close();
}

async function journalRead() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const response = await page.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
  await page.locator('[data-catalog="journal"][data-ready="true"]').waitFor({ timeout: 15000 });
  const state = await page.evaluate(() => {
    const entry = document.querySelector('#journal-svg-2026-09-12');
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-svg-2026-09-12').length,
      titleCount: [...document.querySelectorAll('#journal-svg-2026-09-12 *')].filter((node) => node.textContent.trim() === 'The animal keeps a pocket.').length,
      href: entry?.querySelector('a')?.getAttribute('href') ?? null
    };
  });
  check(response?.ok(), 'production Journal HTTP 200', response?.status());
  check(state.anchorCount === 1, 'production Journal has exactly one SVG anchor', state.anchorCount);
  check(state.titleCount >= 1, 'production Journal renders SVG title', state.titleCount);
  check(state.href === '/works/svg-2026-09-12/#journal', 'production Journal link is canonical', state.href);
  check(state.innerWidth === state.clientWidth && state.scrollWidth <= state.clientWidth, 'production Journal no overflow', state);
  check(issues.console.length === 0, 'production Journal console empty', issues.console);
  check(issues.pageErrors.length === 0, 'production Journal page errors empty', issues.pageErrors);
  check(issues.requestFailures.length === 0, 'production Journal request failures empty', issues.requestFailures);
  check(issues.httpErrors.length === 0, 'production Journal HTTP 400+ empty', issues.httpErrors);
  const screenshot = path.join(PROOF_DIR, 'production-journal-390x844.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  result.routes.journal = { status: response?.status(), state, issues: issueSummary(issues), screenshot };
  await browser.close();
}

async function rawInteractionRead() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const response = await page.goto(`${BASE}/studies/pure-svg/v009/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const field = page.locator('#field');
  await field.waitFor({ timeout: 15000 });
  const initial = await page.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, overflow: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth } }));
  check(response?.ok(), 'production raw HTTP 200', response?.status());
  check(initial.memory === '0', 'production raw initial memory zero', initial);
  const box = await field.boundingBox();
  await field.click({ position: { x: (box?.width ?? 300) * .72, y: (box?.height ?? 220) * .42 } });
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1');
  await field.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '2');
  await page.locator('#unfold-control').click();
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1' && document.querySelector('#field')?.dataset.foldState === 'unfolded');
  await page.locator('#release-control').click();
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '0');
  const final = await page.evaluate(() => ({
    memory: document.querySelector('#field')?.dataset.memory,
    state: document.querySelector('#field')?.dataset.foldState,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height }))
  }));
  check(final.memory === '0' && final.state === 'sequence', 'production raw release returns to zero', final);
  check(final.innerWidth === final.clientWidth && final.scrollWidth <= final.clientWidth, 'production raw no overflow', final);
  check(final.buttons.every((button) => button.height >= 44), 'production raw controls touch-sized', final.buttons);
  check(issues.console.length === 0, 'production raw console empty', issues.console);
  check(issues.pageErrors.length === 0, 'production raw page errors empty', issues.pageErrors);
  check(issues.requestFailures.length === 0, 'production raw request failures empty', issues.requestFailures);
  check(issues.httpErrors.length === 0, 'production raw HTTP 400+ empty', issues.httpErrors);
  const screenshot = path.join(PROOF_DIR, 'production-raw-interaction-390x844.png');
  await page.screenshot({ path: screenshot, animations: 'disabled' });
  result.routes.raw = { status: response?.status(), initial, final, issues: issueSummary(issues), screenshot, sequence: ['0 → 1 pointer', '1 → 2 Enter', '2 → 1 unfold latest', '1 → 0 release'] };
  await browser.close();
}

await mkdir(PROOF_DIR, { recursive: true });
await readJsonRecord();
await canonicalRead();
await journalRead();
await rawInteractionRead();
result.passed = failures.length === 0;
await writeFile(path.join(PROOF_DIR, 'production-results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, failureCount: failures.length, routes: result.routes, worksJson: result.worksJson, failures }, null, 2));
if (!result.passed) process.exitCode = 1;
