import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'research/qa/proofs/typography-v008-2026-09-12';
const BASE = 'https://autopoiesis-nine.vercel.app';
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1161/chrome-win/chrome.exe';
const failures = [];
await mkdir(`${ROOT}/captures`, { recursive: true });

function fail(label, detail) { failures.push({ label, detail }); }

async function eventsFor(page, url, label) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  return { label, url, consoleMessages, pageErrors, requestFailures, badResponses };
}

const browser = await chromium.launch({ headless: true, executablePath });
const result = { stableAlias: BASE, observedWith: { browser: 'Playwright + Chromium headless', executablePath }, failures };
try {
  const canonicalPage = await browser.newPage({ deviceScaleFactor: 1 });
  const canonicalEvents = await eventsFor(canonicalPage, '/works/typography-2026-09-12/', 'canonical');
  await canonicalPage.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true');
  const canonicalFrame = canonicalPage.frames().find((frame) => frame.url().includes('/studies/handwriting/v008/'));
  const canonical = await canonicalPage.evaluate(() => {
    const root = document.documentElement;
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    return {
      status: document.readyState,
      title: document.title,
      innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      tableauBeforeTitle: Boolean(iframe && mount.innerHTML.indexOf('<iframe') < mount.innerHTML.indexOf('<h1')),
      iframeCount: document.querySelectorAll('iframe').length,
      workId: document.body.dataset.workId,
      tableauState: null
    };
  });
  canonical.tableauState = canonicalFrame ? await canonicalFrame.evaluate(() => window.__mutineHandwritingV008?.getState?.() ?? null) : null;
  await canonicalPage.screenshot({ path: `${ROOT}/captures/production-canonical-390x844.png`, fullPage: true });
  result.canonical = { ...canonical, ...canonicalEvents };
  if (!canonical.tableauBeforeTitle || canonical.iframeCount !== 1 || canonical.workId !== 'typography-2026-09-12' || !canonical.tableauState) fail('production canonical structure', canonical);
  if (canonical.innerWidth !== 390 || canonical.clientWidth !== 390 || canonical.scrollWidth !== 390) fail('production canonical overflow', canonical);
  if (canonicalEvents.consoleMessages.length || canonicalEvents.pageErrors.length || canonicalEvents.requestFailures.length || canonicalEvents.badResponses.length) fail('production canonical browser issues', canonicalEvents);
  await canonicalPage.close();

  const journalPage = await browser.newPage({ deviceScaleFactor: 1 });
  const journalEvents = await eventsFor(journalPage, '/journal/', 'journal');
  await journalPage.waitForFunction(() => document.querySelector('[data-catalog="journal"]')?.dataset.ready === 'true');
  const journal = await journalPage.evaluate(() => {
    const entry = document.querySelector('#journal-typography-2026-09-12');
    return {
      status: document.readyState,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-typography-2026-09-12').length,
      titlePresent: document.body.textContent.includes('The break walks the sentence.'),
      href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null
    };
  });
  await journalPage.screenshot({ path: `${ROOT}/captures/production-journal-390x844.png`, fullPage: true });
  result.journal = { ...journal, ...journalEvents };
  if (journal.anchorCount !== 1 || !journal.titlePresent || journal.href !== '/works/typography-2026-09-12/#journal') fail('production Journal content', journal);
  if (journal.innerWidth !== 390 || journal.clientWidth !== 390 || journal.scrollWidth !== 390) fail('production Journal overflow', journal);
  if (journalEvents.consoleMessages.length || journalEvents.pageErrors.length || journalEvents.requestFailures.length || journalEvents.badResponses.length) fail('production Journal browser issues', journalEvents);
  await journalPage.close();

  const rawPage = await browser.newPage({ deviceScaleFactor: 1 });
  const rawEvents = await eventsFor(rawPage, '/studies/handwriting/v008/?preview=1&interaction=1', 'raw-preview');
  await rawPage.waitForFunction(() => Boolean(window.__mutineHandwritingV008));
  const raw = await rawPage.evaluate(() => ({
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineHandwritingV008.getState(),
    controls: [...document.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height }))
  }));
  await rawPage.locator('#piece').click({ position: { x: 130, y: 260 } });
  const pointerState = await rawPage.evaluate(() => window.__mutineHandwritingV008.getState());
  const pointerSignature = await rawPage.evaluate(() => window.__mutineHandwritingV008.getFrameSignature());
  await rawPage.locator('#piece').focus();
  await rawPage.locator('#piece').press('Enter');
  const keyboardState = await rawPage.evaluate(() => window.__mutineHandwritingV008.getState());
  await rawPage.locator('#lift-relay').click();
  const liftedState = await rawPage.evaluate(() => window.__mutineHandwritingV008.getState());
  const liftedSignature = await rawPage.evaluate(() => window.__mutineHandwritingV008.getFrameSignature());
  await rawPage.locator('#release-sequence').click();
  const releasedState = await rawPage.evaluate(() => window.__mutineHandwritingV008.getState());
  raw.interaction = { pointerState, keyboardState, liftedState, releasedState, liftRestoredPointerFrame: liftedSignature === pointerSignature };
  await rawPage.screenshot({ path: `${ROOT}/captures/production-raw-interaction-390x844.png` });
  result.raw = { ...raw, ...rawEvents };
  if (raw.state.memory !== 0 || pointerState.memory !== 1 || keyboardState.memory !== 2 || liftedState.memory !== 1 || !raw.interaction.liftRestoredPointerFrame || releasedState.memory !== 0) fail('production raw interaction', raw);
  if (raw.innerWidth !== 390 || raw.clientWidth !== 390 || raw.scrollWidth !== 390) fail('production raw overflow', raw);
  if (!raw.controls.every((control) => control.height >= 44)) fail('production raw touch targets', raw.controls);
  if (rawEvents.consoleMessages.length || rawEvents.pageErrors.length || rawEvents.requestFailures.length || rawEvents.badResponses.length) fail('production raw browser issues', rawEvents);
  await rawPage.close();
} finally {
  await browser.close();
}

result.status = failures.length ? 'held / failed production readback' : 'stable alias readback passed / CLI deployment provenance unavailable';
await writeFile(`${ROOT}/production-results.json`, JSON.stringify(result, null, 2));
process.stdout.write(JSON.stringify({ status: result.status, failures: failures.length, canonical: result.canonical, journal: result.journal, raw: result.raw }, null, 2));
if (failures.length) process.exitCode = 1;
