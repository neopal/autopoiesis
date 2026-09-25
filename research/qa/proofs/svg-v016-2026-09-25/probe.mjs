import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_QA_BASE_URL ?? 'http://127.0.0.1:4176';
const rawPath = '/studies/pure-svg/v016/?preview=1';
const interactivePath = '/studies/pure-svg/v016/?preview=1&interaction=1';
const blindPath = '/studies/pure-svg/v016/?preview=1&static=1&blind=1';
const canonicalPath = '/works/svg-2026-09-25/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const proofUrl = new URL('./', import.meta.url);
await mkdir(proofUrl, { recursive: true });

function stateSnapshot() {
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
    missing: field?.dataset.missing ?? null,
    echoes: field?.dataset.echoes ?? null,
    signature: field?.dataset.signature ?? null,
    interaction: field?.dataset.interaction ?? null,
    proximity: field?.dataset.proximity ?? null,
    commit: field?.dataset.commit ?? null,
    controls
  };
}

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

async function runRoute(browser, path, label, viewport, reduced) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(reduced ? 120 : 180);
  const outer = await page.evaluate(stateSnapshot);
  let embedded = null;
  let tableauOrder = null;
  if (label === 'canonical') {
    await page.waitForSelector('iframe');
    await page.waitForTimeout(160);
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v016/'));
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
  const result = { label, viewport: `${viewport[0]}x${viewport[1]}`, reduced, httpStatus: response?.status() ?? null, outer, embedded, tableauOrder, ...issues, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${interactivePath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(80);
  const field = page.locator('#field');
  const box = await field.boundingBox();
  if (!box) throw new Error('raw SVG field has no bounding box');
  const initial = await page.evaluate(stateSnapshot);
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.30);
  await page.waitForTimeout(50);
  const pointerMove = await page.evaluate(stateSnapshot);
  await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.68);
  await page.waitForTimeout(70);
  const shortTap = await page.evaluate(stateSnapshot);
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.42);
  await page.mouse.down();
  await page.waitForTimeout(720);
  await page.mouse.up();
  await page.waitForTimeout(70);
  const heldPointer = await page.evaluate(stateSnapshot);
  await field.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(70);
  const keyboard = await page.evaluate(stateSnapshot);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(70);
  const lifted = await page.evaluate(stateSnapshot);
  await page.locator('#release-control').click();
  await page.waitForTimeout(70);
  const released = await page.evaluate(stateSnapshot);
  const screenshot = new URL('./raw-interaction-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = {
    httpStatus: response?.status() ?? null,
    initial,
    pointerMove,
    shortTap,
    heldPointer,
    keyboard,
    lifted,
    released,
    pointerMoveDidNotCommit: pointerMove.memory === initial.memory,
    shortTapDidNotCommit: shortTap.memory === initial.memory,
    heldPointerCommitted: Number(heldPointer.memory) === Number(initial.memory) + 1,
    keyboardCommitted: Number(keyboard.memory) === Number(heldPointer.memory) + 1,
    exactLiftRestored: lifted.signature === heldPointer.signature,
    releaseClearedMemory: released.memory === '0',
    ...issues,
    screenshot: fileURLToPath(screenshot)
  };
  await context.close();
  return result;
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}${blindPath}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
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
      labels: display('.body-label'),
      count: display('.count-label'),
      armed: display('.armed'),
      holdRing: display('.hold-ring')
    };
  });
  const screenshot = new URL('./static-blind-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { httpStatus: response?.status() ?? null, inspection: { state, ...visibility }, ...issues, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runJournal(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
  const response = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(240);
  const evidence = await page.evaluate(() => ({
    outer: { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    count: document.querySelectorAll('#journal-svg-2026-09-25').length,
    title: document.querySelector('#journal-svg-2026-09-25')?.textContent?.trim() ?? null,
    link: document.querySelector('#journal-svg-2026-09-25 a[href="/works/svg-2026-09-25/"]')?.getAttribute('href') ?? null
  }));
  const screenshot = new URL('./journal-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot), fullPage: false });
  const result = { httpStatus: response?.status() ?? null, evidence, ...issues, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runCurrent(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const issues = issueBuffers(page);
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
  const result = { httpStatus: response?.status() ?? null, evidence, ...issues, screenshot: fileURLToPath(screenshot) };
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
  interaction: {
    initial: result.interaction.initial,
    pointerMove: result.interaction.pointerMove,
    shortTap: result.interaction.shortTap,
    heldPointer: result.interaction.heldPointer,
    keyboard: result.interaction.keyboard,
    lifted: result.interaction.lifted,
    released: result.interaction.released,
    pointerMoveDidNotCommit: result.interaction.pointerMoveDidNotCommit,
    shortTapDidNotCommit: result.interaction.shortTapDidNotCommit,
    heldPointerCommitted: result.interaction.heldPointerCommitted,
    keyboardCommitted: result.interaction.keyboardCommitted,
    exactLiftRestored: result.interaction.exactLiftRestored,
    releaseClearedMemory: result.interaction.releaseClearedMemory
  },
  blind: result.blind.inspection,
  journal: result.journal.evidence,
  current: result.current.evidence
}, null, 2));
