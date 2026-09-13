import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'https://autopoiesis-nine.vercel.app';
const PROOF_DIR = path.resolve('research/qa/proofs/svg-v010-2026-09-13/production');
const failures = [];
const pages = [];
function check(condition, message, detail = null) { if (!condition) failures.push({ message, detail }); }
function attachIssues(page, bucket) {
  page.on('console', (message) => bucket.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => bucket.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => bucket.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) bucket.httpErrors.push({ url: response.url(), status: response.status() }); });
}
function issueSnapshot(page, bucket) { return { console: bucket.console, pageErrors: bucket.pageErrors, requestFailures: bucket.requestFailures, httpErrors: bucket.httpErrors, url: page.url() }; }
function cleanIssues(issues, label) {
  check(issues.console.length === 0, `${label} console empty`, issues.console);
  check(issues.pageErrors.length === 0, `${label} page errors empty`, issues.pageErrors);
  check(issues.requestFailures.length === 0, `${label} request failures empty`, issues.requestFailures);
  check(issues.httpErrors.length === 0, `${label} HTTP 400+ empty`, issues.httpErrors);
}

await mkdir(PROOF_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const dataPage = await context.newPage();
  const dataIssues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(dataPage, dataIssues);
  const dataResponse = await dataPage.goto(`${BASE}/studio/data/works.json`, { waitUntil: 'networkidle' });
  const data = await dataPage.evaluate(() => JSON.parse(document.body.innerText));
  const records = data.works.filter((work) => work.id === 'svg-2026-09-13');
  check(Boolean(dataResponse && dataResponse.ok()), 'production works JSON HTTP 200', dataResponse?.status());
  check(records.length === 1, 'production works JSON contains exactly one SVG v010 record', records.length);
  check(records[0]?.rawPath === '/studies/pure-svg/v010/', 'production record rawPath', records[0]?.rawPath);
  check(records[0]?.journal?.anchor === 'journal-svg-2026-09-13', 'production record Journal anchor', records[0]?.journal?.anchor);
  pages.push({ kind: 'works-json', response: dataResponse?.status(), recordCount: records.length, title: records[0]?.title, issues: issueSnapshot(dataPage, dataIssues) });
  await context.close();

  const canonicalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const canonical = await canonicalContext.newPage();
  const canonicalIssues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(canonical, canonicalIssues);
  const canonicalResponse = await canonical.goto(`${BASE}/works/svg-2026-09-13/`, { waitUntil: 'networkidle' });
  await canonical.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ timeout: 15000 });
  const canonicalState = await canonical.evaluate(() => {
    const figure = document.querySelector('.work-inspect__stage .artwork-frame');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauTop: figure?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? null,
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
      frameSrc: document.querySelector('.work-inspect__stage iframe')?.src ?? null
    };
  });
  check(Boolean(canonicalResponse && canonicalResponse.ok()), 'production canonical HTTP 200', canonicalResponse?.status());
  check(canonicalState.title === 'The animal keeps a counterweight.', 'production canonical title', canonicalState.title);
  check(canonicalState.iframeCount === 1 && canonicalState.frameSrc.includes('/studies/pure-svg/v010/'), 'production canonical v010 tableau', canonicalState.frameSrc);
  check(canonicalState.tableauTop < canonicalState.headingTop, 'production canonical tableau first', canonicalState);
  check(canonicalState.innerWidth === canonicalState.clientWidth && canonicalState.scrollWidth <= canonicalState.clientWidth, 'production canonical no overflow', canonicalState);
  const canonicalPath = path.join(PROOF_DIR, 'canonical-390x844.png');
  await canonical.screenshot({ path: canonicalPath, animations: 'disabled' });
  const canonicalIssueSnapshot = issueSnapshot(canonical, canonicalIssues);
  cleanIssues(canonicalIssueSnapshot, 'production canonical');
  pages.push({ kind: 'canonical', response: canonicalResponse?.status(), state: canonicalState, issues: canonicalIssueSnapshot, screenshot: canonicalPath });
  await canonicalContext.close();

  const journalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const journal = await journalContext.newPage();
  const journalIssues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(journal, journalIssues);
  const journalResponse = await journal.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
  const journalState = await journal.evaluate(() => {
    const entry = document.querySelector('#journal-svg-2026-09-13');
    return { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, count: document.querySelectorAll('#journal-svg-2026-09-13').length, title: entry?.querySelector('h3')?.textContent?.trim() ?? null, href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null };
  });
  check(Boolean(journalResponse && journalResponse.ok()), 'production Journal HTTP 200', journalResponse?.status());
  check(journalState.count === 1, 'production Journal has exactly one SVG v010 anchor', journalState.count);
  check(journalState.title === 'The animal keeps a counterweight.', 'production Journal title', journalState.title);
  check(journalState.href === '/works/svg-2026-09-13/#journal', 'production Journal canonical href', journalState.href);
  check(journalState.innerWidth === journalState.clientWidth && journalState.scrollWidth <= journalState.clientWidth, 'production Journal no overflow', journalState);
  const journalPath = path.join(PROOF_DIR, 'journal-390x844.png');
  await journal.screenshot({ path: journalPath, animations: 'disabled' });
  const journalIssueSnapshot = issueSnapshot(journal, journalIssues);
  cleanIssues(journalIssueSnapshot, 'production Journal');
  pages.push({ kind: 'journal', response: journalResponse?.status(), state: journalState, issues: journalIssueSnapshot, screenshot: journalPath });
  await journalContext.close();

  const rawContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const raw = await rawContext.newPage();
  const rawIssues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(raw, rawIssues);
  const rawResponse = await raw.goto(`${BASE}/studies/pure-svg/v010/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const field = raw.locator('#field');
  await field.waitFor({ timeout: 15000 });
  const initial = await raw.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, overflow: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth } }));
  check(Boolean(rawResponse && rawResponse.ok()), 'production raw HTTP 200', rawResponse?.status());
  check(initial.memory === '0', 'production raw initial memory zero', initial);
  const fieldBox = await field.boundingBox();
  await field.click({ position: { x: (fieldBox?.width ?? 300) * .72, y: (fieldBox?.height ?? 220) * .42 } });
  await raw.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1');
  const afterPointer = await raw.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, signature: window.__mutinePureSvgV010?.getFrameSignature() }));
  await field.focus();
  await raw.keyboard.press('Enter');
  await raw.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '2');
  const afterKeyboard = await raw.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, signature: window.__mutinePureSvgV010?.getFrameSignature() }));
  await raw.locator('#lift-control').click();
  await raw.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1' && document.querySelector('#field')?.dataset.weightState === 'unweighted');
  const afterLift = await raw.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, signature: window.__mutinePureSvgV010?.getFrameSignature() }));
  await raw.locator('#release-control').click();
  await raw.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '0');
  const afterRelease = await raw.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, state: document.querySelector('#field')?.dataset.weightState, overflow: { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })) }));
  check(afterPointer.memory === '1', 'production pointer adds one weight', afterPointer);
  check(afterKeyboard.memory === '2' && afterKeyboard.signature !== afterPointer.signature, 'production keyboard adds a second structural weight', { afterPointer, afterKeyboard });
  check(afterLift.memory === '1' && afterLift.signature === afterPointer.signature, 'production lift restores exact prior geometry', { afterPointer, afterLift });
  check(afterRelease.memory === '0', 'production release clears memory', afterRelease);
  check(afterRelease.overflow.innerWidth === afterRelease.overflow.clientWidth && afterRelease.overflow.scrollWidth <= afterRelease.overflow.clientWidth, 'production raw no overflow', afterRelease.overflow);
  check(afterRelease.buttons.every((button) => button.height >= 44), 'production raw controls are touch-sized', afterRelease.buttons);
  const rawPath = path.join(PROOF_DIR, 'raw-interaction-390x844.png');
  await raw.screenshot({ path: rawPath, animations: 'disabled' });
  const rawIssueSnapshot = issueSnapshot(raw, rawIssues);
  cleanIssues(rawIssueSnapshot, 'production raw');
  pages.push({ kind: 'raw-interaction', response: rawResponse?.status(), initial, afterPointer, afterKeyboard, afterLift, afterRelease, issues: rawIssueSnapshot, screenshot: rawPath });
  await rawContext.close();

  const faviconContext = await browser.newContext();
  const favicon = await faviconContext.newPage();
  const faviconResponse = await favicon.goto(`${BASE}/studio/favicon.svg`, { waitUntil: 'networkidle' });
  check(Boolean(faviconResponse && faviconResponse.ok()), 'production favicon HTTP 200', faviconResponse?.status());
  pages.push({ kind: 'favicon', response: faviconResponse?.status(), url: favicon.url() });
  await faviconContext.close();
} finally {
  await browser.close();
}

const result = { passed: failures.length === 0, failureCount: failures.length, failures, pages, generatedAt: new Date().toISOString() };
await writeFile(path.join(PROOF_DIR, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, failureCount: result.failureCount, pages: result.pages.map((page) => ({ kind: page.kind, response: page.response, state: page.state, issues: page.issues })), failures: result.failures }, null, 2));
if (!result.passed) process.exitCode = 1;
