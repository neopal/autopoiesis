import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4173';
const PROOF_DIR = path.resolve('research/qa/proofs/svg-v009-2026-09-12');
const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

const failures = [];
const runs = [];
const interaction = {};

function check(condition, message, detail = null) {
  if (!condition) failures.push({ message, detail });
}

function attachIssues(page, bucket) {
  page.on('console', (message) => bucket.console.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => bucket.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => bucket.requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) bucket.httpErrors.push({ url: response.url(), status: response.status() });
  });
}

async function issueSnapshot(page, bucket) {
  return {
    console: bucket.console,
    pageErrors: bucket.pageErrors,
    requestFailures: bucket.requestFailures,
    httpErrors: bucket.httpErrors,
    url: page.url()
  };
}

async function canonicalRun(browser, width, height, reducedMotion) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const url = `${BASE}/works/svg-2026-09-12/`;
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('[data-catalog-work-detail][data-ready="true"]').waitFor({ timeout: 10000 });
  const outer = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('*')].map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: typeof element.className === 'string' ? element.className : '',
      right: element.getBoundingClientRect().right,
      width: element.getBoundingClientRect().width
    })).filter((entry) => entry.right > window.innerWidth + 1 || entry.width > window.innerWidth + 1).slice(0, 8);
    const figure = document.querySelector('.work-inspect__stage .artwork-frame');
    const heading = document.querySelector('.work-inspect__heading');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowElements: rects,
      tableauTop: figure?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      iframeCount: document.querySelectorAll('.work-inspect__stage iframe').length,
      title: document.querySelector('.work-inspect__heading h1')?.textContent?.trim() ?? null
    };
  });
  const study = page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v009/'));
  check(Boolean(response && response.ok()), `canonical HTTP ${width}x${height} ${reducedMotion ? 'reduced' : 'normal'}`, response?.status());
  check(Boolean(study), `canonical iframe frame present ${width}x${height} ${reducedMotion ? 'reduced' : 'normal'}`);
  const inner = study ? await study.locator('#field').evaluate((field) => ({
    svgWidth: field.getBoundingClientRect().width,
    svgHeight: field.getBoundingClientRect().height,
    stage: field.dataset.stage,
    memory: field.dataset.memory,
    buttons: [...field.parentElement.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  })) : null;
  check(outer.innerWidth === outer.clientWidth, `canonical client width ${width}x${height}`);
  check(outer.scrollWidth <= outer.clientWidth, `canonical no overflow ${width}x${height}`, outer);
  check(outer.tableauTop !== null && outer.headingTop !== null && outer.tableauTop < outer.headingTop, `canonical tableau first ${width}x${height}`, outer);
  check(outer.iframeCount === 1, `canonical has one study iframe ${width}x${height}`);
  check(inner?.svgWidth > 0 && inner?.svgHeight > 0, `embedded SVG visible ${width}x${height}`, inner);
  check(inner?.scrollWidth <= inner?.clientWidth, `embedded study no overflow ${width}x${height}`, inner);
  check((inner?.buttons ?? []).every((button) => button.height >= 44), `embedded controls are touch-sized ${width}x${height}`, inner?.buttons);
  const issuesResult = await issueSnapshot(page, issues);
  check(issuesResult.console.length === 0, `canonical console empty ${width}x${height}`, issuesResult.console);
  check(issuesResult.pageErrors.length === 0, `canonical page errors empty ${width}x${height}`, issuesResult.pageErrors);
  check(issuesResult.requestFailures.length === 0, `canonical request failures empty ${width}x${height}`, issuesResult.requestFailures);
  check(issuesResult.httpErrors.length === 0, `canonical HTTP 400+ empty ${width}x${height}`, issuesResult.httpErrors);
  const capture = path.join(PROOF_DIR, `canonical-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: capture, animations: 'disabled' });
  runs.push({ kind: 'canonical', width, height, reducedMotion, outer, inner, issues: issuesResult, screenshot: capture });
  await context.close();
}

async function rawInteractionRun(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const response = await page.goto(`${BASE}/studies/pure-svg/v009/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const field = page.locator('#field');
  await field.waitFor();
  const initial = await page.evaluate(() => ({
    memory: document.querySelector('#field')?.dataset.memory,
    stage: document.querySelector('#field')?.dataset.stage,
    overflow: { innerWidth: innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }
  }));
  check(Boolean(response && response.ok()), 'raw interactive HTTP 200', response?.status());
  check(initial.memory === '0', 'raw initial memory is zero', initial);
  check(initial.overflow.innerWidth === initial.overflow.clientWidth && initial.overflow.scrollWidth <= initial.overflow.clientWidth, 'raw initial no overflow', initial.overflow);
  const initialCapture = path.join(PROOF_DIR, 'raw-interaction-initial-390x844.png');
  await page.screenshot({ path: initialCapture, animations: 'disabled' });

  const fieldBox = await field.boundingBox();
  await field.click({ position: { x: (fieldBox?.width ?? 300) * .72, y: (fieldBox?.height ?? 220) * .42 } });
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1');
  const afterPointer = await page.evaluate(() => document.querySelector('#field')?.dataset.memory);
  check(afterPointer === '1', 'pointer adds one fold', afterPointer);

  await field.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '2');
  const afterKeyboard = await page.evaluate(() => document.querySelector('#field')?.dataset.memory);
  check(afterKeyboard === '2', 'keyboard adds second fold', afterKeyboard);

  await page.locator('#unfold-control').click();
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1' && document.querySelector('#field')?.dataset.foldState === 'unfolded');
  const afterUnfold = await page.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, state: document.querySelector('#field')?.dataset.foldState }));
  check(afterUnfold.memory === '1' && afterUnfold.state === 'unfolded', 'unfold removes latest fold', afterUnfold);

  await page.locator('#release-control').click();
  await page.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '0');
  const afterRelease = await page.evaluate(() => ({ memory: document.querySelector('#field')?.dataset.memory, state: document.querySelector('#field')?.dataset.foldState }));
  check(afterRelease.memory === '0', 'release returns memory to zero', afterRelease);

  const postInteraction = await page.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    svg: { width: document.querySelector('#field')?.getBoundingClientRect().width, height: document.querySelector('#field')?.getBoundingClientRect().height },
    buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height }))
  }));
  check(postInteraction.innerWidth === postInteraction.clientWidth && postInteraction.scrollWidth <= postInteraction.clientWidth, 'raw post-interaction no overflow', postInteraction);
  check(postInteraction.buttons.every((button) => button.height >= 44), 'raw controls are touch-sized', postInteraction.buttons);
  const afterCapture = path.join(PROOF_DIR, 'raw-interaction-after-release-390x844.png');
  await page.screenshot({ path: afterCapture, animations: 'disabled' });
  const issuesResult = await issueSnapshot(page, issues);
  check(issuesResult.console.length === 0, 'raw console empty', issuesResult.console);
  check(issuesResult.pageErrors.length === 0, 'raw page errors empty', issuesResult.pageErrors);
  check(issuesResult.requestFailures.length === 0, 'raw request failures empty', issuesResult.requestFailures);
  check(issuesResult.httpErrors.length === 0, 'raw HTTP 400+ empty', issuesResult.httpErrors);
  interaction.initial = initial;
  interaction.sequence = { afterPointer, afterKeyboard, afterUnfold, afterRelease, postInteraction, issues: issuesResult, screenshots: [initialCapture, afterCapture] };
  await context.close();
}

async function staticBlindRun(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  attachIssues(page, issues);
  const response = await page.goto(`${BASE}/studies/pure-svg/v009/?preview=1&static=1`, { waitUntil: 'networkidle' });
  await page.locator('#field').waitFor();
  const state = await page.evaluate(() => {
    const hidden = ['.field-readout', '.field-controls', '.artwork-label', '.fold-witness', '.fold-thread', '.pocket-seam'].map((selector) => [selector, getComputedStyle(document.querySelector(selector)).display]);
    const svg = document.querySelector('#field')?.getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svg: { width: svg?.width, height: svg?.height },
      hidden
    };
  });
  check(Boolean(response && response.ok()), 'static blind HTTP 200', response?.status());
  check(state.svg.width > 0 && state.svg.height > 0, 'static blind SVG visible', state.svg);
  check(state.innerWidth === state.clientWidth && state.scrollWidth <= state.clientWidth, 'static blind no overflow', state);
  check(state.hidden.every(([, display]) => display === 'none'), 'static blind hides editorial witnesses and controls', state.hidden);
  const capture = path.join(PROOF_DIR, 'raw-static-blind-390x844.png');
  await page.screenshot({ path: capture, animations: 'disabled' });
  const issuesResult = await issueSnapshot(page, issues);
  check(issuesResult.console.length === 0, 'static blind console empty', issuesResult.console);
  check(issuesResult.pageErrors.length === 0, 'static blind page errors empty', issuesResult.pageErrors);
  check(issuesResult.requestFailures.length === 0, 'static blind request failures empty', issuesResult.requestFailures);
  check(issuesResult.httpErrors.length === 0, 'static blind HTTP 400+ empty', issuesResult.httpErrors);
  runs.push({ kind: 'static-blind', width: 390, height: 844, state, issues: issuesResult, screenshot: capture });
  await context.close();
}

await mkdir(PROOF_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of VIEWPORTS) {
    await canonicalRun(browser, width, height, false);
    await canonicalRun(browser, width, height, true);
  }
  await rawInteractionRun(browser);
  await staticBlindRun(browser);
} finally {
  await browser.close();
}

const result = {
  passed: failures.length === 0,
  failureCount: failures.length,
  failures,
  runs,
  interaction,
  generatedAt: new Date().toISOString()
};
await writeFile(path.join(PROOF_DIR, 'results.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, failureCount: result.failureCount, runCount: runs.length, interaction: result.interaction.sequence, failures: result.failures }, null, 2));
if (!result.passed) process.exitCode = 1;
