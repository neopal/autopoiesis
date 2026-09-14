import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const proofDir = new URL('./', import.meta.url);
const base = 'https://autopoiesis-nine.vercel.app';
const targetId = 'typography-2026-09-15';
const targetTitle = 'The sentence keeps a stutter.';
const targetRawPath = '/studies/handwriting/v011/';
const result = { base, targetId, targetTitle, targetRawPath, status: null, json: null, canonical: null, journal: null, rawPreview: null, favicon: null, browserIssues: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function events(page) {
  const browserIssues = [];
  page.on('console', (message) => browserIssues.push(`console: ${message.type()} ${message.text()}`));
  page.on('pageerror', (error) => browserIssues.push(`pageerror: ${error}`));
  page.on('requestfailed', (request) => browserIssues.push(`requestfailed: ${request.url()}`));
  page.on('response', (response) => { if (response.status() >= 400) browserIssues.push(`http-${response.status()}: ${response.url()}`); });
  return browserIssues;
}

async function responseFor(path) {
  const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}probe=${Date.now()}`);
  return { status: response.status, contentType: response.headers.get('content-type'), body: await response.text() };
}

await mkdir(proofDir, { recursive: true });
const jsonResponse = await responseFor('/studio/data/works.json');
let json;
try { json = JSON.parse(jsonResponse.body); } catch (error) { json = { parseError: String(error) }; }
const records = Array.isArray(json?.works) ? json.works.filter((work) => work.id === targetId) : [];
result.json = {
  status: jsonResponse.status,
  contentType: jsonResponse.contentType,
  bytes: jsonResponse.body.length,
  matchingRecords: records.length,
  containsTitle: jsonResponse.body.includes(targetTitle),
  containsRawPath: jsonResponse.body.includes(targetRawPath),
  recordStatus: records[0]?.status ?? null,
  journalAnchor: records[0]?.journal?.anchor ?? null
};
assert(jsonResponse.status === 200 && records.length === 1 && records[0].title === targetTitle && records[0].rawPath === targetRawPath, 'production JSON record mismatch');

const browser = await chromium.launch({ headless: true });
try {
  const canonicalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  let issueList = events(canonicalPage);
  const canonicalResponse = await canonicalPage.goto(`${base}/works/${targetId}/?probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  assert(canonicalResponse?.ok(), `canonical returned ${canonicalResponse?.status()}`);
  await canonicalPage.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
  await canonicalPage.waitForSelector('[data-catalog-work-detail] .work-inspect__stage iframe');
  const frameLocator = canonicalPage.locator('[data-catalog-work-detail] .work-inspect__stage iframe').contentFrame();
  await frameLocator.locator('#piece').waitFor({ state: 'attached' });
  const canonicalFrame = canonicalPage.frames().find((frame) => frame.url().includes('/studies/handwriting/v011/'));
  assert(canonicalFrame, 'production v011 iframe did not load');
  await canonicalFrame.waitForFunction(() => Boolean(window.__mutineHandwritingV011));
  result.canonical = await canonicalPage.evaluate(({ responseStatus, expectedTitle }) => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('.work-inspect__heading');
    return {
      status: responseStatus,
      ready: mount?.dataset.ready === 'true',
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauFirst: Boolean(iframe && heading && (iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)),
      iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
      workId: document.body.dataset.workId,
      titlePresent: document.body.textContent.includes(expectedTitle),
      capture: 'production-canonical-390x844.png'
    };
  }, { responseStatus: canonicalResponse?.status() ?? null, expectedTitle: targetTitle });
  result.canonical.tableauState = await canonicalFrame.evaluate(() => window.__mutineHandwritingV011.getState());
  result.canonical.issues = issueList;
  assert(result.canonical.status === 200 && result.canonical.ready && result.canonical.tableauFirst && result.canonical.iframeCount === 1 && result.canonical.workId === targetId && result.canonical.titlePresent, 'production canonical shell mismatch');
  assert(result.canonical.innerWidth === result.canonical.clientWidth && result.canonical.scrollWidth <= result.canonical.innerWidth, 'production canonical overflow');
  assert(result.canonical.tableauState.stage === 0 && result.canonical.tableauState.memory.length === 0, 'production canonical initial state mismatch');
  await canonicalPage.screenshot({ path: fileURLToPath(new URL('production-canonical-390x844.png', proofDir)), fullPage: true });
  await canonicalPage.close();

  const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  issueList = events(journalPage);
  const journalResponse = await journalPage.goto(`${base}/journal/?probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  assert(journalResponse?.ok(), `Journal returned ${journalResponse?.status()}`);
  await journalPage.waitForFunction(() => document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true');
  result.journal = await journalPage.evaluate(({ responseStatus, expectedTitle }) => {
    const entry = document.querySelector('#journal-typography-2026-09-15');
    return {
      status: responseStatus,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-typography-2026-09-15').length,
      titlePresent: document.body.textContent.includes(expectedTitle),
      href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null,
      capture: 'production-journal-390x844.png',
      issues: []
    };
  }, { responseStatus: journalResponse?.status() ?? null, expectedTitle: targetTitle });
  result.journal.issues = issueList;
  assert(result.journal.status === 200 && result.journal.anchorCount === 1 && result.journal.titlePresent && result.journal.href === `/works/${targetId}/#journal`, 'production Journal mismatch');
  assert(result.journal.innerWidth === result.journal.clientWidth && result.journal.scrollWidth <= result.journal.innerWidth, 'production Journal overflow');
  await journalPage.screenshot({ path: fileURLToPath(new URL('production-journal-390x844.png', proofDir)), fullPage: true });
  await journalPage.close();

  const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  issueList = events(rawPage);
  const rawResponse = await rawPage.goto(`${base}/studies/handwriting/v011/?preview=1&interaction=1&probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  assert(rawResponse?.ok(), `raw preview returned ${rawResponse?.status()}`);
  await rawPage.waitForFunction(() => Boolean(window.__mutineHandwritingV011));
  const rawInitial = await rawPage.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineHandwritingV011.getState(),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: Math.round(button.getBoundingClientRect().height), disabled: button.disabled })),
    signature: document.querySelector('#piece').toDataURL()
  }));
  assert(rawInitial.innerWidth === rawInitial.clientWidth && rawInitial.scrollWidth <= rawInitial.innerWidth, 'production raw preview overflow before gesture');
  assert(rawInitial.controls.length === 3 && rawInitial.controls.every((control) => control.height >= 44), 'production raw controls below 44px');
  const canvas = rawPage.locator('#piece');
  const box = await canvas.boundingBox();
  assert(box, 'production raw canvas has no bounds');
  await rawPage.mouse.move(box.x + box.width * .56, box.y + box.height * .42);
  await rawPage.mouse.click(box.x + box.width * .56, box.y + box.height * .42);
  const rawPointer = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV011.getState(), signature: document.querySelector('#piece').toDataURL() }));
  await canvas.focus();
  await rawPage.keyboard.press('Enter');
  const rawKeyboard = await rawPage.evaluate(() => window.__mutineHandwritingV011.getState());
  await rawPage.locator('#lift-stutter').click();
  const rawLift = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV011.getState(), signature: document.querySelector('#piece').toDataURL() }));
  await rawPage.locator('#release-sequence').click();
  const rawRelease = await rawPage.evaluate(() => window.__mutineHandwritingV011.getState());
  const geometryAfter = await rawPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  result.rawPreview = {
    status: rawResponse.status(),
    initialState: rawInitial.state,
    pointerState: rawPointer.state,
    keyboardState: rawKeyboard,
    liftState: rawLift.state,
    releaseState: rawRelease,
    controls: rawInitial.controls,
    geometryAfter,
    liftRestoredPointerField: rawLift.signature === rawPointer.signature,
    capture: 'production-raw-interaction-390x844.png',
    issues: issueList
  };
  assert(rawPointer.state.memory.length === 1 && rawPointer.state.paused && rawPointer.state.stutteredRoutes >= 3, 'production pointer interaction mismatch');
  assert(rawKeyboard.memory.length === 2 && rawKeyboard.stutteredRoutes >= 3, 'production keyboard interaction mismatch');
  assert(rawLift.state.memory.length === 1 && result.rawPreview.liftRestoredPointerField, 'production lift mismatch');
  assert(rawRelease.memory.length === 0 && rawRelease.stage === 0 && !rawRelease.paused, 'production release mismatch');
  assert(geometryAfter.innerWidth === geometryAfter.clientWidth && geometryAfter.scrollWidth <= geometryAfter.innerWidth, 'production raw preview overflow after gesture');
  await rawPage.screenshot({ path: fileURLToPath(new URL('production-raw-interaction-390x844.png', proofDir)), fullPage: true });
  await rawPage.close();
} finally {
  await browser.close();
}

const favicon = await responseFor('/studio/favicon.svg');
result.favicon = { status: favicon.status, contentType: favicon.contentType, bytes: favicon.body.length };
result.browserIssues = [
  ...(result.canonical?.issues ?? []),
  ...(result.journal?.issues ?? []),
  ...(result.rawPreview?.issues ?? [])
];
assert(result.favicon.status === 200 && result.favicon.contentType?.includes('image/svg+xml'), 'production favicon mismatch');
assert(result.browserIssues.length === 0, `production browser issues: ${result.browserIssues.join('; ')}`);
result.status = 'stable alias contains typography v011 candidate';
await writeFile(new URL('production-results.json', proofDir), JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify({ status: result.status, jsonRecord: result.json.matchingRecords, canonical: result.canonical.titlePresent, journalAnchors: result.journal.anchorCount, interactionMemory: [result.rawPreview.initialState.memory.length, result.rawPreview.pointerState.memory.length, result.rawPreview.keyboardState.memory.length, result.rawPreview.liftState.memory.length, result.rawPreview.releaseState.memory.length], liftRestored: result.rawPreview.liftRestoredPointerField, favicon: result.favicon.status, browserIssues: result.browserIssues.length, captures: 3 }, null, 2));
