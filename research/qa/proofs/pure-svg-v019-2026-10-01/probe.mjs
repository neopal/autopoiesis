import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const proofDir = process.env.MUTINE_QA_PROOF_DIR ? resolve(process.env.MUTINE_QA_PROOF_DIR) : fileURLToPath(new URL('./', import.meta.url));
const port = Number(process.env.MUTINE_QA_PORT ?? 4196);
const base = process.env.MUTINE_QA_BASE_URL ?? `http://127.0.0.1:${port}`;
const executablePath = process.env.CHROME_PATH ?? 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/pure-svg/v019/?preview=1';
const blindPath = '/studies/pure-svg/v019/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-10-01/';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

await mkdir(proofDir, { recursive: true });
const proofFile = (filename) => resolve(proofDir, filename);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', base);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(join(root, pathname.replace(/^\/+/, '')));
    if (!candidate.startsWith(root)) throw new Error('path traversal');
    response.writeHead(200, { 'content-type': mime[extname(candidate)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(await readFile(candidate));
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((done) => server.listen(port, '127.0.0.1', done));

function issuesFor(page) {
  const issues = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`); });
  return issues;
}

function issueList(issues) {
  return Object.values(issues).flat();
}

function snapshotFromDocument() {
  const field = document.querySelector('#field');
  const rect = field?.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: Boolean(field && getComputedStyle(field).display !== 'none'),
    fieldRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    stage: field?.dataset.stage ?? null,
    memory: field?.dataset.memory ?? null,
    pressures: field?.dataset.pressures ?? null,
    apertures: field?.dataset.apertures ?? null,
    order: field?.dataset.order ?? null,
    signature: field?.dataset.signature ?? null,
    interaction: field?.dataset.interaction ?? null,
    notice: field?.dataset.notice ?? null,
    controls: [...document.querySelectorAll('.field-controls button')].map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height, disabled: button.disabled }))
  };
}

async function runRaw(browser, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = issuesFor(page);
  const response = await page.goto(`${base}${rawPath}&cache=raw-${index}-${reduced}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(reduced ? 110 : 180);
  const state = await page.evaluate(snapshotFromDocument);
  const screenshot = proofFile(`raw-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, state, issues, screenshot };
  await context.close();
  return result;
}

async function runCanonical(browser, viewport, reduced, index) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = issuesFor(page);
  const response = await page.goto(`${base}${canonicalPath}?cache=canonical-${index}-${reduced}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.work-inspect__stage iframe');
  await page.waitForTimeout(reduced ? 160 : 220);
  const outer = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v019/'));
  const embedded = frame ? await frame.evaluate(snapshotFromDocument) : null;
  const tableauOrder = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const title = mount?.querySelector('h1');
    return { iframePresent: Boolean(iframe), iframeBeforeTitle: Boolean(iframe && title && (iframe.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)), iframeRect: iframe?.getBoundingClientRect().toJSON() ?? null, titleRect: title?.getBoundingClientRect().toJSON() ?? null };
  });
  const screenshot = proofFile(`canonical-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, outer, embedded, tableauOrder, issues, screenshot };
  await context.close();
  return result;
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = issuesFor(page);
  const response = await page.goto(`${base}/studies/pure-svg/v019/?preview=1&interaction=1&cache=interaction`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  const field = page.locator('#field');
  const initial = await page.evaluate(snapshotFromDocument);
  const box = await field.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(50);
  const pointerTap = await page.evaluate(snapshotFromDocument);
  await page.locator('#pressure-control').click();
  await page.waitForTimeout(70);
  const button = await page.evaluate(snapshotFromDocument);
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
  const screenshot = proofFile('interaction-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = {
    httpStatus: response?.status(), initial, pointerTap, button, keyboard, lifted, released, issues, screenshot,
    pointerTapDidNotCommit: pointerTap.memory === initial.memory && pointerTap.signature === initial.signature,
    pressureCommitted: Number(button.memory) === Number(initial.memory) + 1 && button.interaction === 'order-inversion',
    keyboardCommitted: Number(keyboard.memory) === Number(button.memory) + 1,
    exactLiftRestored: lifted.signature === button.signature && lifted.memory === button.memory,
    releaseClearedMemory: released.memory === '0'
  };
  await context.close();
  return result;
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issuesFor(page);
  const response = await page.goto(`${base}${blindPath}&cache=blind`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(140);
  const state = await page.evaluate(snapshotFromDocument);
  const visibility = await page.evaluate(() => {
    const display = (selector) => { const element = document.querySelector(selector); return element ? getComputedStyle(element).display : 'absent'; };
    return { field: display('#field'), readout: display('.field-readout'), controls: display('.field-controls'), labels: display('.svg-labels'), center: display('.center-label') };
  });
  const screenshot = proofFile('static-blind-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { httpStatus: response?.status(), state, visibility, issues, screenshot };
  await context.close();
  return result;
}

async function runCatalogRoute(browser, path, selector, filename) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issuesFor(page);
  const response = await page.goto(`${base}${path}?cache=${filename}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(260);
  const evidence = await page.evaluate((target) => ({ outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, count: document.querySelectorAll(target).length, title: document.querySelector(target)?.textContent?.trim() ?? null }), selector);
  const screenshot = proofFile(`${filename}-390x844.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const result = { httpStatus: response?.status(), evidence, issues, screenshot };
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
  result.journal = await runCatalogRoute(browser, '/journal/', '#journal-svg-2026-10-01', 'journal');
  result.current = await runCatalogRoute(browser, '/currents/pure-svg/', '[data-catalog-current-header]', 'current');
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}

const allIssues = (entries) => entries.flatMap((entry) => issueList(entry.issues));
const summary = {
  base,
  rawRuns: result.raw.length,
  canonicalRuns: result.canonical.length,
  rawIssues: allIssues(result.raw),
  canonicalIssues: allIssues(result.canonical),
  interactionIssues: issueList(result.interaction.issues),
  blindIssues: issueList(result.blind.issues),
  journalIssues: issueList(result.journal.issues),
  currentIssues: issueList(result.current.issues),
  result
};
await writeFile(proofFile('results.json'), `${JSON.stringify(summary, null, 2)}\n`);
const checks = {
  rawMatrix: result.raw.length === 10 && result.raw.every((entry) => entry.httpStatus === 200 && entry.state.innerWidth === Number(entry.viewport.split('x')[0]) && entry.state.clientWidth === entry.state.scrollWidth && entry.state.fieldVisible && entry.consoleIssues?.length !== 1 && issueList(entry.issues).length === 0),
  canonicalMatrix: result.canonical.length === 10 && result.canonical.every((entry) => entry.httpStatus === 200 && entry.outer.innerWidth === Number(entry.viewport.split('x')[0]) && entry.outer.clientWidth === entry.outer.scrollWidth && entry.embedded?.fieldVisible && entry.tableauOrder?.iframeBeforeTitle && issueList(entry.issues).length === 0),
  interaction: result.interaction.httpStatus === 200 && result.interaction.pointerTapDidNotCommit && result.interaction.pressureCommitted && result.interaction.keyboardCommitted && result.interaction.exactLiftRestored && result.interaction.releaseClearedMemory && issueList(result.interaction.issues).length === 0,
  blind: result.blind.httpStatus === 200 && result.blind.state.memory === '4' && result.blind.state.fieldVisible && result.blind.visibility.readout === 'none' && result.blind.visibility.controls === 'none' && ['none', 'absent'].includes(result.blind.visibility.labels) && ['none', 'absent'].includes(result.blind.visibility.center) && issueList(result.blind.issues).length === 0,
  journal: result.journal.httpStatus === 200 && result.journal.evidence.count === 1 && result.journal.evidence.title?.includes('The valve turns its face.') && result.journal.evidence.outer.clientWidth === result.journal.evidence.outer.scrollWidth && issueList(result.journal.issues).length === 0,
  current: result.current.httpStatus === 200 && result.current.evidence.count === 1 && result.current.evidence.outer.clientWidth === result.current.evidence.outer.scrollWidth && issueList(result.current.issues).length === 0
};
const final = { checks, rawRuns: result.raw.length, canonicalRuns: result.canonical.length, issues: { raw: summary.rawIssues.length, canonical: summary.canonicalIssues.length, interaction: summary.interactionIssues.length, blind: summary.blindIssues.length, journal: summary.journalIssues.length, current: summary.currentIssues.length }, interaction: result.interaction, blind: result.blind, journal: result.journal, current: result.current };
await writeFile(proofFile('summary.json'), `${JSON.stringify(final, null, 2)}\n`);
console.log(JSON.stringify(final, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
