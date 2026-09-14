import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const proofDir = new URL('./', import.meta.url);
const base = 'https://autopoiesis-nine.vercel.app';
const targetId = 'typography-2026-09-14';
const targetTitle = 'The sentence grows a hinge.';
const result = { base, targetId, targetTitle, status: null, json: null, canonical: null, journal: null, rawPreview: null, favicon: null, browserIssues: [] };

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
result.json = {
  status: jsonResponse.status,
  contentType: jsonResponse.contentType,
  bytes: jsonResponse.body.length,
  matchingRecords: Array.isArray(json?.works) ? json.works.filter((work) => work.id === targetId).length : 0,
  containsTitle: jsonResponse.body.includes(targetTitle),
  containsRawPath: jsonResponse.body.includes('/studies/handwriting/v010/')
};

const browser = await chromium.launch({ headless: true });
try {
  const canonicalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  let issues = events(canonicalPage);
  const canonicalResponse = await canonicalPage.goto(`${base}/works/${targetId}/?probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await canonicalPage.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
  await canonicalPage.waitForSelector('[data-catalog-work-detail] .work-inspect__stage iframe');
  const canonicalFrame = canonicalPage.frames().find((frame) => frame.url().includes('/studies/handwriting/v010/'));
  await canonicalFrame?.waitForFunction(() => Boolean(window.__mutineHandwritingV010));
  result.canonical = await canonicalPage.evaluate((responseStatus) => {
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
      titlePresent: document.body.textContent.includes('The sentence grows a hinge.'),
      capture: 'production-canonical-390x844.png'
    };
  }, canonicalResponse?.status() ?? null);
  result.canonical.tableauState = canonicalFrame ? await canonicalFrame.evaluate(() => window.__mutineHandwritingV010.getState()) : null;
  result.canonical.issues = issues;
  await canonicalPage.screenshot({ path: fileURLToPath(new URL('production-canonical-390x844.png', proofDir)), fullPage: true });
  await canonicalPage.close();

  const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  issues = events(journalPage);
  const journalResponse = await journalPage.goto(`${base}/journal/?probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await journalPage.waitForFunction(() => document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true');
  result.journal = await journalPage.evaluate((responseStatus) => ({
    status: responseStatus,
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    anchorCount: document.querySelectorAll('#journal-typography-2026-09-14').length,
    titlePresent: document.body.textContent.includes('The sentence grows a hinge.'),
    capture: 'production-journal-390x844.png',
    issues: []
  }), journalResponse?.status() ?? null);
  result.journal.issues = issues;
  await journalPage.screenshot({ path: fileURLToPath(new URL('production-journal-390x844.png', proofDir)), fullPage: true });
  await journalPage.close();

  const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  issues = events(rawPage);
  const rawResponse = await rawPage.goto(`${base}/studies/handwriting/v010/?preview=1&interaction=1&probe=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await rawPage.waitForFunction(() => Boolean(window.__mutineHandwritingV010));
  const rawInitial = await rawPage.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineHandwritingV010.getState(),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: Math.round(button.getBoundingClientRect().height), disabled: button.disabled })),
    signature: document.querySelector('#piece').toDataURL()
  }));
  const canvas = rawPage.locator('#piece');
  const box = await canvas.boundingBox();
  if (box) {
    await rawPage.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.42);
    await rawPage.mouse.click(box.x + box.width * 0.56, box.y + box.height * 0.42);
  }
  const rawPointer = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV010.getState(), signature: document.querySelector('#piece').toDataURL() }));
  await canvas.focus();
  await rawPage.keyboard.press('Enter');
  const rawKeyboard = await rawPage.evaluate(() => window.__mutineHandwritingV010.getState());
  await rawPage.locator('#lift-hinge').click();
  const rawLift = await rawPage.evaluate(() => ({ state: window.__mutineHandwritingV010.getState(), signature: document.querySelector('#piece').toDataURL() }));
  await rawPage.locator('#release-sequence').click();
  const rawRelease = await rawPage.evaluate(() => window.__mutineHandwritingV010.getState());
  result.rawPreview = {
    status: rawResponse?.status() ?? null,
    innerWidth: rawInitial.innerWidth,
    clientWidth: rawInitial.clientWidth,
    scrollWidth: rawInitial.scrollWidth,
    state: rawInitial.state,
    controls: rawInitial.controls,
    pointerState: rawPointer.state,
    keyboardState: rawKeyboard,
    liftState: rawLift.state,
    releaseState: rawRelease,
    liftRestoredPointerField: rawLift.signature === rawPointer.signature,
    hasCanvas: Boolean(box),
    capture: 'production-raw-interaction-390x844.png',
    issues
  };
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
result.status = result.json.matchingRecords === 1
  && result.canonical.status === 200
  && result.canonical.ready
  && result.canonical.tableauFirst
  && result.canonical.iframeCount === 1
  && result.canonical.workId === targetId
  && result.canonical.titlePresent
  && result.canonical.tableauState?.stage === 0
  && result.canonical.tableauState?.memory?.length === 0
  && result.journal.anchorCount === 1
  && result.journal.titlePresent
  && result.rawPreview.status === 200
  && result.rawPreview.hasCanvas
  && result.rawPreview.pointerState.memory.length === 1
  && result.rawPreview.keyboardState.memory.length === 2
  && result.rawPreview.liftState.memory.length === 1
  && result.rawPreview.releaseState.memory.length === 0
  && result.rawPreview.liftRestoredPointerField
  && result.browserIssues.length === 0
  ? 'stable alias contains v010'
  : 'blocked / stable alias does not contain v010';
await writeFile(new URL('production-results.json', proofDir), JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify(result, null, 2));
