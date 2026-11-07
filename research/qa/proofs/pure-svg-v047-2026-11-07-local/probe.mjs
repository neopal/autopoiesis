import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4387';
const proofDir = 'research/qa/proofs/pure-svg-v047-2026-11-07-local';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const rawPath = '/studies/pure-svg/v047/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-11-07/';
const results = [];
const diagnostics = [];
await mkdir(proofDir, { recursive: true });

function attachDiagnostics(page, label) {
  page.on('console', (message) => diagnostics.push({ label, kind: 'console', type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => diagnostics.push({ label, kind: 'pageerror', text: String(error) }));
  page.on('requestfailed', (request) => diagnostics.push({ label, kind: 'requestfailed', url: request.url(), text: request.failure()?.errorText ?? 'failed' }));
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(base).origin) {
      diagnostics.push({ label, kind: 'http', status: response.status(), url: response.url() });
    }
  });
}

async function waitReady(page, selector = '#field') {
  await page.waitForFunction((wanted) => Boolean(window._mutineReady) || Boolean(document.querySelector(wanted)), selector, { timeout: 15000 });
  await page.waitForTimeout(40);
}

async function measure(page, selector = '#field') {
  return page.evaluate((wanted) => {
    const root = document.documentElement;
    const target = document.querySelector(wanted);
    const rect = target?.getBoundingClientRect() ?? null;
    const controls = [...document.querySelectorAll('button, a')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    return {
      innerWidth: window.innerWidth,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      targetRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      visibleControlCount: controls.length,
      minVisibleControlHeight: controls.length ? Math.min(...controls.map((element) => element.getBoundingClientRect().height)) : null,
      fieldReady: Boolean(document.querySelector('#field[data-ready="true"]')),
      memory: document.querySelector('#field')?.dataset.memory ?? null
    };
  }, selector);
}

async function runRoute(path, viewport, reducedMotion, label, selector = '#field') {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachDiagnostics(page, label);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await waitReady(page, selector);
  const evidence = await measure(page, selector);
  const screenshot = `${proofDir}/${label}-${viewport.width}x${viewport.height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ label, path, viewport, reducedMotion, status: response?.status() ?? null, evidence, screenshot });
  await context.close();
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
for (const reducedMotion of [false, true]) {
  for (const viewport of viewports) {
    await runRoute(rawPath, viewport, reducedMotion, 'raw');
    await runRoute(canonicalPath, viewport, reducedMotion, 'canonical', '[data-catalog-work-detail]');
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
const interactionPage = await interactionContext.newPage();
attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${base}${rawPath}`, { waitUntil: 'networkidle', timeout: 30000 });
await waitReady(interactionPage);
const field = interactionPage.locator('#field');
const box = await field.boundingBox();
if (!box) throw new Error('field bounding box unavailable');
const point0 = { x: box.x + box.width * (410 / 1200), y: box.y + box.height * (260 / 760) };
await interactionPage.mouse.move(point0.x, point0.y);
await interactionPage.waitForTimeout(120);
await interactionPage.mouse.move(box.x + box.width * 0.04, box.y + box.height * 0.04);
await interactionPage.waitForTimeout(80);
const quickGlanceMemory = await field.getAttribute('data-memory');
await interactionPage.mouse.move(point0.x, point0.y);
await interactionPage.waitForTimeout(650);
await interactionPage.mouse.move(box.x + box.width * 0.04, box.y + box.height * 0.04);
await interactionPage.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1');
const pointerMemory = await field.getAttribute('data-memory');
await field.focus();
await interactionPage.keyboard.press('ArrowRight');
await interactionPage.keyboard.press('Enter');
await interactionPage.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '2');
const keyboardMemory = await field.getAttribute('data-memory');
await interactionPage.keyboard.press('Delete');
await interactionPage.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '1');
await interactionPage.keyboard.press('Escape');
await interactionPage.waitForFunction(() => document.querySelector('#field')?.dataset.memory === '0');
const interactionEvidence = {
  quickGlanceMemory,
  pointerMemory,
  keyboardMemory,
  afterLiftMemory: await field.getAttribute('data-memory'),
  afterReleaseInteraction: await field.getAttribute('data-interaction'),
  evidence: await measure(interactionPage)
};
await interactionPage.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: true });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const blindPage = await blindContext.newPage();
attachDiagnostics(blindPage, 'blind');
await blindPage.goto(`${base}${rawPath}&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
await waitReady(blindPage);
const blindEvidence = {
  evidence: await measure(blindPage),
  memory: await blindPage.locator('#field').getAttribute('data-memory'),
  readoutVisible: await blindPage.locator('.field-readout').isVisible().catch(() => false),
  controlsVisible: await blindPage.locator('.field-controls').isVisible().catch(() => false),
  annotationsVisible: await blindPage.locator('.work-annotations').isVisible().catch(() => false)
};
await blindPage.screenshot({ path: `${proofDir}/blind-390x844-reduced.png`, fullPage: true });
await blindContext.close();

const journalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const journalPage = await journalContext.newPage();
attachDiagnostics(journalPage, 'journal');
const journalResponse = await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
await journalPage.locator('#journal-svg-2026-11-07').waitFor({ timeout: 15000 });
const journalText = await journalPage.locator('body').textContent();
const journalEvidence = {
  status: journalResponse?.status() ?? null,
  anchorCount: await journalPage.locator('#journal-svg-2026-11-07').count(),
  titlePresent: journalText.includes('The glyph answers after you leave.'),
  evidence: await measure(journalPage, '#journal-svg-2026-11-07')
};
await journalPage.screenshot({ path: `${proofDir}/journal-390x844-reduced.png`, fullPage: true });
await journalContext.close();

await browser.close();
const matrixFailures = results.filter((result) => result.status !== 200 || result.evidence.innerWidth !== result.viewport.width || result.evidence.clientWidth !== result.viewport.width || result.evidence.scrollWidth > result.viewport.width || (result.label === 'raw' && !result.evidence.fieldReady));
const canonicalFailures = results.filter((result) => result.label === 'canonical' && (result.evidence.targetRect === null || result.evidence.scrollWidth > result.viewport.width));
const summary = {
  base,
  proofDir,
  matrixRuns: results.length,
  rawRuns: results.filter((result) => result.label === 'raw').length,
  canonicalRuns: results.filter((result) => result.label === 'canonical').length,
  matrixFailures,
  canonicalFailures,
  diagnostics,
  interactionEvidence,
  blindEvidence,
  journalEvidence,
  allDiagnosticsOk: diagnostics.length === 0,
  allReadbacksOk: journalEvidence.status === 200 && journalEvidence.anchorCount === 1 && journalEvidence.titlePresent
};
await writeFile(`${proofDir}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  matrixRuns: summary.matrixRuns,
  rawRuns: summary.rawRuns,
  canonicalRuns: summary.canonicalRuns,
  matrixFailures: summary.matrixFailures.length,
  canonicalFailures: summary.canonicalFailures.length,
  diagnostics: summary.diagnostics.length,
  interactionEvidence: summary.interactionEvidence,
  blind: summary.blindEvidence,
  journal: summary.journalEvidence,
  proofDir: summary.proofDir
}, null, 2));
if (summary.matrixFailures.length || summary.canonicalFailures.length || summary.diagnostics.length || !summary.allReadbacksOk) process.exitCode = 1;
