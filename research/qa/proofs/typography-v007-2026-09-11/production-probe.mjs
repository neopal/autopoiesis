import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = 'research/qa/proofs/typography-v007-2026-09-11';
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const consoleMessages = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];

function listen(page) {
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text(), url: page.url() }));
  page.on('pageerror', (error) => pageErrors.push({ error: String(error), url: page.url() }));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), failure: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
}

const canonicalPage = await context.newPage();
listen(canonicalPage);
await canonicalPage.goto(`${base}/works/typography-2026-09-11/`, { waitUntil: 'networkidle' });
await canonicalPage.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
await canonicalPage.waitForTimeout(150);
const canonical = await canonicalPage.evaluate(() => {
  const iframe = document.querySelector('iframe');
  const title = document.querySelector('h1');
  return {
    workId: document.body.dataset.workId,
    title: title?.textContent.trim(),
    rawPath: iframe?.getAttribute('src'),
    tableauFirst: (iframe?.getBoundingClientRect().top ?? Infinity) < (title?.getBoundingClientRect().top ?? -Infinity),
    innerWidth: innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    iframeCount: document.querySelectorAll('iframe').length
  };
});
assert.equal(canonical.workId, 'typography-2026-09-11');
assert.equal(canonical.title, 'The sentence stutters together.');
assert.match(canonical.rawPath, /studies\/handwriting\/v007/);
assert.equal(canonical.tableauFirst, true);
assert.equal(canonical.innerWidth, 390);
assert.equal(canonical.clientWidth, 390);
assert.equal(canonical.scrollWidth, 390);
assert.equal(canonical.iframeCount, 1);
await canonicalPage.screenshot({ path: `${proofDir}/production-canonical-390x844.png`, fullPage: true });

const journalPage = await context.newPage();
listen(journalPage);
await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
await journalPage.waitForSelector('[data-catalog="journal"][data-ready="true"]');
await journalPage.waitForTimeout(150);
const journal = await journalPage.evaluate(() => {
  const entry = document.querySelector('#journal-typography-2026-09-11');
  return {
    anchorCount: document.querySelectorAll('#journal-typography-2026-09-11').length,
    title: entry?.querySelector('h3')?.textContent.trim(),
    href: entry?.querySelector('h3 a')?.getAttribute('href'),
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
});
assert.equal(journal.anchorCount, 1);
assert.equal(journal.title, 'The sentence stutters together.');
assert.equal(journal.href, '/works/typography-2026-09-11/#journal');
assert.equal(journal.innerWidth, 390);
assert.equal(journal.clientWidth, 390);
assert.equal(journal.scrollWidth, 390);
await journalPage.screenshot({ path: `${proofDir}/production-journal-390x844.png`, fullPage: true });

const rawPage = await context.newPage();
listen(rawPage);
await rawPage.goto(`${base}/studies/handwriting/v007/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
await rawPage.waitForSelector('#piece');
await rawPage.waitForTimeout(150);
const initial = await rawPage.evaluate(() => window.__mutineHandwritingV007.getState());
const rect = await rawPage.locator('#piece').boundingBox();
assert.ok(rect);
await rawPage.mouse.click(rect.x + rect.width * 0.46, rect.y + rect.height * 0.42);
const afterPointer = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
await rawPage.locator('#piece').focus();
await rawPage.keyboard.press('Enter');
const afterKeyboard = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
await rawPage.locator('#lift-stutter').click();
const afterLift = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV007.getState(), signature: window.__mutineHandwritingV007.getFrameSignature() }));
assert.equal(initial.memory, 0);
assert.equal(afterPointer.state.memory, 1);
assert.equal(afterKeyboard.state.memory, 2);
assert.equal(afterLift.state.memory, 1);
assert.equal(afterLift.signature, afterPointer.signature);
assert.ok((await rawPage.locator('button').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))));
await rawPage.screenshot({ path: `${proofDir}/production-raw-interaction-390x844.png`, fullPage: true });

const faviconResponse = await fetch(`${base}/favicon.ico`);
assert.equal(faviconResponse.status, 200);
const results = {
  status: 'passed',
  stableAlias: base,
  canonical,
  journal,
  rawInteraction: { initial, afterPointer: afterPointer.state, afterKeyboard: afterKeyboard.state, afterLift: afterLift.state },
  favicon: { status: faviconResponse.status },
  consoleMessages,
  pageErrors,
  requestFailures,
  badResponses,
  providerRevision: 'not verified: stable alias content was observed, but the Vercel CLI deploy was blocked by scope access and missing local credentials'
};
assert.equal(consoleMessages.length, 0);
assert.equal(pageErrors.length, 0);
assert.equal(requestFailures.length, 0);
assert.equal(badResponses.length, 0);
await writeFile(`${proofDir}/production-results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
await browser.close();
