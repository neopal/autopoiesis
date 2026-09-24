import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_QA_BASE_URL ?? 'http://127.0.0.1:4176';
const rawPath = '/studies/pure-svg/v015/?preview=1';
const interactivePath = '/studies/pure-svg/v015/?preview=1&interaction=1';
const blindPath = '/studies/pure-svg/v015/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-09-24/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const proofUrl = new URL('./', import.meta.url);
await mkdir(proofUrl, { recursive: true });

function stateSnapshot() {
  const field = document.querySelector('#field');
  const controls = [...document.querySelectorAll('.field-controls button')].map((button) => {
    const box = button.getBoundingClientRect();
    return { label: button.textContent.trim(), width: box.width, height: box.height };
  });
  const rect = field?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    stage: field?.dataset.stage ?? null,
    memory: field?.dataset.memory ?? null,
    holes: field?.dataset.holes ?? null,
    closedVoids: field?.dataset.closedVoids ?? null,
    topology: field?.dataset.topology ?? null,
    interaction: field?.dataset.interaction ?? null,
    signature: field ? `${field.dataset.stage}|${field.dataset.memory}|${field.dataset.holes}|${field.dataset.closedVoids}|${field.dataset.topology}` : null,
    controls
  };
}

async function runRoute(browser, path, label, viewport, reduced) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(reduced ? 120 : 180);
  const outer = await page.evaluate(stateSnapshot);
  let embedded = null;
  let tableauOrder = null;
  if (label === 'canonical') {
    await page.waitForSelector('iframe');
    await page.waitForTimeout(160);
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v015/'));
    embedded = frame ? await frame.evaluate(stateSnapshot) : null;
    tableauOrder = await page.evaluate(() => {
      const mount = document.querySelector('[data-catalog-work-detail]');
      const iframe = mount?.querySelector('iframe');
      const title = mount?.querySelector('h1');
      return {
        iframePresent: Boolean(iframe),
        iframeBeforeTitle: Boolean(iframe && title && (iframe.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)),
        iframeRect: iframe?.getBoundingClientRect().toJSON() ?? null,
        titleRect: title?.getBoundingClientRect().toJSON() ?? null
      };
    });
  }
  const screenshot = new URL(`./${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`, proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { label, viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, outer, embedded, tableauOrder, consoleMessages, pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(`${base}${interactivePath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  const field = page.locator('#field');
  const box = await field.boundingBox();
  if (!box) throw new Error('raw SVG field has no bounding box');
  const initial = await page.evaluate(stateSnapshot);
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.30);
  await page.waitForTimeout(50);
  const pointerMove = await page.evaluate(stateSnapshot);
  await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.68);
  await page.waitForTimeout(50);
  const pointer = await page.evaluate(stateSnapshot);
  await field.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  const keyboard = await page.evaluate(stateSnapshot);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(50);
  const lifted = await page.evaluate(stateSnapshot);
  await page.locator('#release-control').click();
  await page.waitForTimeout(50);
  const released = await page.evaluate(stateSnapshot);
  const screenshot = new URL('./raw-interaction-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = {
    httpStatus: response?.status() ?? null,
    initial,
    pointerMove,
    pointer,
    keyboard,
    lifted,
    released,
    exactLiftRestored: lifted.signature === pointer.signature,
    releaseClearedMemory: released.memory === '0',
    consoleMessages,
    pageErrors,
    requestFailures,
    badResponses,
    screenshot: fileURLToPath(screenshot)
  };
  await context.close();
  return result;
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(`${base}${blindPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(90);
  const state = await page.evaluate(stateSnapshot);
  const visibility = await page.evaluate(() => {
    const display = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : 'absent';
    };
    return {
      svgVisible: display('#field') !== 'none' && display('#field') !== 'absent',
      readout: display('.field-readout'),
      controls: display('.field-controls'),
      voidMarks: display('.void-mark'),
      attentionMarks: display('.attention-mark'),
      labels: display('.artwork-label'),
      count: display('.count-label')
    };
  });
  const inspection = { state, ...visibility };
  const screenshot = new URL('./static-blind-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { httpStatus: response?.status() ?? null, inspection, consoleMessages, pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runJournal(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll('#journal-svg-2026-09-24').length,
    title: document.querySelector('#journal-svg-2026-09-24')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-svg-2026-09-24 a[href="/works/svg-2026-09-24/"]')?.getAttribute('href') ?? null
  }));
  const screenshot = new URL('./journal-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { httpStatus: response?.status() ?? null, evidence, consoleMessages, pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runCurrent(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(`${base}/currents/pure-svg/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    currentHeaders: document.querySelectorAll('[data-catalog-current-header]').length,
    firstArtwork: Boolean(document.querySelector('.catalog-card__art, iframe')),
    title: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null
  }));
  const screenshot = new URL('./current-pure-svg-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { httpStatus: response?.status() ?? null, evidence, consoleMessages, pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath });
const result = { raw: [], canonical: [], interaction: null, blind: null, journal: null, current: null };
try {
  for (const reduced of [false, true]) for (const viewport of viewports) result.raw.push(await runRoute(browser, rawPath, 'raw', viewport, reduced));
  result.interaction = await runInteraction(browser);
  result.blind = await runBlind(browser);
  for (const reduced of [false, true]) for (const viewport of viewports) result.canonical.push(await runRoute(browser, canonicalPath, 'canonical', viewport, reduced));
  result.journal = await runJournal(browser);
  result.current = await runCurrent(browser);
} finally {
  await browser.close();
}
const allRuns = [...result.raw, ...result.canonical, result.interaction, result.blind, result.journal, result.current];
const summary = {
  base,
  rawRuns: result.raw.length,
  canonicalRuns: result.canonical.length,
  rawIssues: result.raw.flatMap((run) => [...run.consoleMessages, ...run.pageErrors, ...run.requestFailures, ...run.badResponses]),
  canonicalIssues: result.canonical.flatMap((run) => [...run.consoleMessages, ...run.pageErrors, ...run.requestFailures, ...run.badResponses]),
  interactionIssues: [...result.interaction.consoleMessages, ...result.interaction.pageErrors, ...result.interaction.requestFailures, ...result.interaction.badResponses],
  blindIssues: [...result.blind.consoleMessages, ...result.blind.pageErrors, ...result.blind.requestFailures, ...result.blind.badResponses],
  journalIssues: [...result.journal.consoleMessages, ...result.journal.pageErrors, ...result.journal.requestFailures, ...result.journal.badResponses],
  currentIssues: [...result.current.consoleMessages, ...result.current.pageErrors, ...result.current.requestFailures, ...result.current.badResponses],
  result
};
await writeFile(new URL('./results.json', proofUrl), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  rawRuns: summary.rawRuns,
  canonicalRuns: summary.canonicalRuns,
  rawIssues: summary.rawIssues.length,
  canonicalIssues: summary.canonicalIssues.length,
  interactionIssues: summary.interactionIssues.length,
  blindIssues: summary.blindIssues.length,
  journalIssues: summary.journalIssues.length,
  currentIssues: summary.currentIssues.length,
  interaction: { initial: result.interaction.initial, pointerMove: result.interaction.pointerMove, pointer: result.interaction.pointer, keyboard: result.interaction.keyboard, lifted: result.interaction.lifted, released: result.interaction.released, exactLiftRestored: result.interaction.exactLiftRestored, releaseClearedMemory: result.interaction.releaseCleared },
  blind: result.blind.inspection,
  journal: result.journal.evidence,
  current: result.current.evidence
}, null, 2));
