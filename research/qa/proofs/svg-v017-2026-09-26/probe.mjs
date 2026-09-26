import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const proofDir = fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.MUTINE_QA_PORT ?? 4187);
const base = process.env.MUTINE_QA_BASE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.CHROME_PATH ?? 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v017/?preview=1';
const blindPath = '/studies/pure-svg/v017/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-09-26/';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

await mkdir(proofDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', base);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(join(root, pathname.replace(/^\/+/, '')));
    if (!candidate.startsWith(root)) throw new Error('path traversal');
    const body = await readFile(candidate);
    response.writeHead(200, { 'content-type': mime[extname(candidate)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});

await new Promise((resolveServer) => server.listen(port, '127.0.0.1', resolveServer));

function issueBuffers(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, requestFailures, badResponses };
}

function snapshotFromDocument() {
  const field = document.querySelector('#field');
  const controls = [...document.querySelectorAll('.field-controls button')].map((button) => {
    const box = button.getBoundingClientRect();
    return { label: button.textContent.trim(), width: box.width, height: box.height, disabled: button.disabled };
  });
  const rect = field?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    field: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    stage: field?.dataset.stage ?? null,
    memory: field?.dataset.memory ?? null,
    cuts: field?.dataset.cuts ?? null,
    bridges: field?.dataset.bridges ?? null,
    signature: field?.dataset.signature ?? null,
    interaction: field?.dataset.interaction ?? null,
    notice: field?.dataset.notice ?? null,
    controls
  };
}

async function runRaw(browser, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${rawPath}&cache=raw-${index}-${reduced}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(reduced ? 120 : 180);
  const state = await page.evaluate(snapshotFromDocument);
  const screenshot = fileURLToPath(new URL(`./raw-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`, import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, state, ...issues, screenshot };
  await context.close();
  return result;
}

async function runCanonical(browser, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${canonicalPath}?cache=canonical-${index}-${reduced}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.work-inspect__stage iframe');
  await page.waitForTimeout(reduced ? 150 : 220);
  const outer = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v017/'));
  const embedded = frame ? await frame.evaluate(snapshotFromDocument) : null;
  const tableauOrder = await page.evaluate(() => {
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
  const screenshot = fileURLToPath(new URL(`./canonical-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`, import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, outer, embedded, tableauOrder, ...issues, screenshot };
  await context.close();
  return result;
}

async function anchorClick(page, index) {
  const box = await page.evaluate((anchorIndex) => {
    const element = document.querySelector(`[data-anchor="${anchorIndex}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, index);
  if (!box) throw new Error(`anchor ${index} has no bounding box`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}/studies/pure-svg/v017/?preview=1&interaction=1&cache=interaction`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(90);
  const field = page.locator('#field');
  const initial = await page.evaluate(snapshotFromDocument);
  await page.mouse.move(195, 310);
  const moved = await page.evaluate(snapshotFromDocument);
  await page.mouse.down();
  await page.mouse.move(300, 420, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  const drag = await page.evaluate(snapshotFromDocument);
  await anchorClick(page, 0);
  await page.waitForTimeout(50);
  const firstPoint = await page.evaluate(snapshotFromDocument);
  await anchorClick(page, 0);
  await page.waitForTimeout(50);
  const samePoint = await page.evaluate(snapshotFromDocument);
  await anchorClick(page, 4);
  await page.waitForTimeout(70);
  const relayed = await page.evaluate(snapshotFromDocument);
  await field.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(70);
  const keyboard = await page.evaluate(snapshotFromDocument);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(70);
  const lifted = await page.evaluate(snapshotFromDocument);
  await page.locator('#release-control').click();
  await page.waitForTimeout(70);
  const released = await page.evaluate(snapshotFromDocument);
  const screenshot = fileURLToPath(new URL('./raw-interaction-390x844.png', import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = {
    httpStatus: response?.status() ?? null,
    initial,
    moved,
    drag,
    firstPoint,
    samePoint,
    relayed,
    keyboard,
    lifted,
    released,
    pointerMoveDidNotCommit: moved.memory === initial.memory,
    dragDidNotCommit: drag.memory === initial.memory,
    firstPointOnlyArmed: firstPoint.memory === initial.memory && firstPoint.interaction === 'armed',
    samePointRefused: samePoint.memory === initial.memory && samePoint.notice === 'same-point-refused',
    relayCommitted: Number(relayed.memory) === Number(initial.memory) + 1 && Number(relayed.cuts) === 1 && Number(relayed.bridges) === 1,
    keyboardCommitted: Number(keyboard.memory) === Number(relayed.memory) + 1,
    exactLiftRestored: lifted.signature === relayed.signature,
    releaseClearedMemory: released.memory === '0',
    ...issues,
    screenshot
  };
  await context.close();
  return result;
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${blindPath}&cache=blind`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const state = await page.evaluate(snapshotFromDocument);
  const visibility = await page.evaluate(() => {
    const display = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : 'absent';
    };
    return {
      svgVisible: display('#field') !== 'none' && display('#field') !== 'absent',
      readout: display('.field-readout'),
      controls: display('.field-controls'),
      labels: display('.svg-labels'),
      center: display('.center-label'),
      selection: display('.selection-ring')
    };
  });
  const screenshot = fileURLToPath(new URL('./static-blind-390x844.png', import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { httpStatus: response?.status() ?? null, state, visibility, ...issues, screenshot };
  await context.close();
  return result;
}

async function runJournal(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}/journal/?cache=journal`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll('#journal-svg-2026-09-26').length,
    title: document.querySelector('#journal-svg-2026-09-26')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-svg-2026-09-26 a[href="/works/svg-2026-09-26/#journal"]')?.getAttribute('href') ?? null
  }));
  const screenshot = fileURLToPath(new URL('./journal-390x844.png', import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { httpStatus: response?.status() ?? null, evidence, ...issues, screenshot };
  await context.close();
  return result;
}

async function runCurrent(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}/currents/pure-svg/?cache=current`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    currentHeaders: document.querySelectorAll('[data-catalog-current-header]').length,
    firstArtwork: Boolean(document.querySelector('.catalog-card__art, iframe')),
    title: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null
  }));
  const screenshot = fileURLToPath(new URL('./current-pure-svg-390x844.png', import.meta.url));
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { httpStatus: response?.status() ?? null, evidence, ...issues, screenshot };
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true, executablePath });
const result = { raw: [], canonical: [], interaction: null, blind: null, journal: null, current: null };
try {
  let index = 0;
  for (const reduced of [false, true]) for (const viewport of viewports) result.raw.push(await runRaw(browser, viewport, reduced, index++));
  result.interaction = await runInteraction(browser);
  result.blind = await runBlind(browser);
  index = 0;
  for (const reduced of [false, true]) for (const viewport of viewports) result.canonical.push(await runCanonical(browser, viewport, reduced, index++));
  result.journal = await runJournal(browser);
  result.current = await runCurrent(browser);
} finally {
  await browser.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

const issueList = (entry) => [...entry.consoleMessages, ...entry.pageErrors, ...entry.requestFailures, ...entry.badResponses];
const summary = {
  base,
  rawRuns: result.raw.length,
  canonicalRuns: result.canonical.length,
  rawIssues: result.raw.flatMap(issueList),
  canonicalIssues: result.canonical.flatMap(issueList),
  interactionIssues: issueList(result.interaction),
  blindIssues: issueList(result.blind),
  journalIssues: issueList(result.journal),
  currentIssues: issueList(result.current),
  result
};
await writeFile(new URL('./results.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
const checks = {
  rawMatrix: result.raw.length === 10 && result.raw.every((entry) => entry.httpStatus === 200 && entry.state.innerWidth === Number(entry.viewport.split('x')[0]) && entry.state.clientWidth === entry.state.scrollWidth && entry.consoleMessages.length === 0 && entry.pageErrors.length === 0 && entry.requestFailures.length === 0 && entry.badResponses.length === 0),
  canonicalMatrix: result.canonical.length === 10 && result.canonical.every((entry) => entry.httpStatus === 200 && entry.outer.innerWidth === Number(entry.viewport.split('x')[0]) && entry.outer.clientWidth === entry.outer.scrollWidth && entry.embedded?.field && entry.tableauOrder?.iframeBeforeTitle && entry.consoleMessages.length === 0 && entry.pageErrors.length === 0 && entry.requestFailures.length === 0 && entry.badResponses.length === 0),
  interaction: result.interaction.pointerMoveDidNotCommit && result.interaction.dragDidNotCommit && result.interaction.firstPointOnlyArmed && result.interaction.samePointRefused && result.interaction.relayCommitted && result.interaction.keyboardCommitted && result.interaction.exactLiftRestored && result.interaction.releaseClearedMemory,
  blind: result.blind.httpStatus === 200 && result.blind.state.memory === '4' && result.blind.visibility.svgVisible && result.blind.visibility.readout === 'none' && result.blind.visibility.controls === 'none' && ['none', 'absent'].includes(result.blind.visibility.labels) && ['none', 'absent'].includes(result.blind.visibility.center) && ['none', 'absent'].includes(result.blind.visibility.selection) && summary.blindIssues.length === 0,
  journal: result.journal.httpStatus === 200 && result.journal.evidence.count === 1 && result.journal.evidence.title?.includes('The loop misremembers a turn.') && result.journal.evidence.link === '/works/svg-2026-09-26/#journal' && result.journal.evidence.outer.clientWidth === result.journal.evidence.outer.scrollWidth && summary.journalIssues.length === 0,
  current: result.current.httpStatus === 200 && result.current.evidence.currentHeaders === 1 && result.current.evidence.firstArtwork && result.current.evidence.outer.clientWidth === result.current.evidence.outer.scrollWidth && summary.currentIssues.length === 0
};
const final = { checks, rawRuns: result.raw.length, canonicalRuns: result.canonical.length, issues: { raw: summary.rawIssues.length, canonical: summary.canonicalIssues.length, interaction: summary.interactionIssues.length, blind: summary.blindIssues.length, journal: summary.journalIssues.length, current: summary.currentIssues.length }, interaction: result.interaction, blind: result.blind, journal: result.journal, current: result.current };
await writeFile(new URL('./summary.json', import.meta.url), `${JSON.stringify(final, null, 2)}\n`);
console.log(JSON.stringify(final, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
