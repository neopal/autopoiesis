const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/ASUS/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const ROOT = process.env.MUTINE_QA_ROOT || 'http://127.0.0.1:4173';
const CANONICAL = `${ROOT}/works/naive-2026-09-08/`;
const OUT = path.resolve(process.env.MUTINE_QA_OUT || 'research/qa/proofs/naive-art-v005');
const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

function safeName(width, height, reduced) {
  return `canonical-${width}x${height}-${reduced ? 'reduced' : 'normal'}.png`;
}

async function readState(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const mount = document.querySelector('[data-catalog-work-detail]');
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box && { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const child = iframe?.contentDocument;
    const field = child?.querySelector('#field');
    const buttons = [...(child?.querySelectorAll('.field-controls button') ?? [])].map((button) => ({
      id: button.id,
      label: button.textContent.trim(),
      rect: rect(button)
    }));
    return {
      url: location.href,
      title: document.title,
      viewport: { innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
      mountReady: mount?.dataset.ready || null,
      firstMainChild: document.querySelector('.studio-main')?.firstElementChild?.className || null,
      iframe: rect(iframe),
      iframeLoaded: Boolean(field),
      iframePreviewMode: child?.documentElement.classList.contains('preview-mode') || false,
      iframeInteractivePreview: child?.documentElement.classList.contains('interactive-preview') || false,
      field: rect(field),
      stageText: child?.querySelector('[data-stage]')?.textContent.trim() || null,
      memoryText: child?.querySelector('[data-memory]')?.textContent.trim() || null,
      svgPathCount: child?.querySelectorAll('#field path').length || 0,
      buttonTargets: buttons,
      errorsText: document.querySelector('.catalog-state--error')?.textContent.trim() || null
    };
  });
}

async function inspectViewport(browser, width, height, reduced) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.url().startsWith(ROOT) && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  let state;
  let screenshot = null;
  try {
    await page.goto(CANONICAL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true', null, { timeout: 10000 });
    await page.waitForFunction(() => Boolean(document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field')), null, { timeout: 10000 });
    state = await readState(page);
    const file = path.join(OUT, safeName(width, height, reduced));
    await page.screenshot({ path: file, fullPage: false });
    screenshot = file;
  } catch (error) {
    state = { probeError: String(error) };
  }
  await context.close();
  return {
    requestedUrl: CANONICAL,
    width,
    height,
    reduced,
    state,
    screenshot,
    consoleMessages,
    pageErrors,
    failedRequests,
    badResponses
  };
}

async function inspectInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.url().startsWith(ROOT) && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  await page.goto(CANONICAL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true', null, { timeout: 10000 });
  await page.waitForFunction(() => Boolean(document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field')), null, { timeout: 10000 });
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v005/'));
  if (!frame) throw new Error('interactive v005 iframe frame not found');
  const initial = await frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    turnPaths: document.querySelectorAll('.route-turn').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null,
    buttonRects: [...document.querySelectorAll('.field-controls button')].map((button) => ({ id: button.id, rect: (() => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; })() }))
  }));
  await frame.locator('#turn-control').click();
  const afterButton = await frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    turnPaths: document.querySelectorAll('.route-turn').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null
  }));
  await frame.locator('#field').focus();
  await frame.locator('#field').press('Enter');
  const afterKeyboard = await frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    turnPaths: document.querySelectorAll('.route-turn').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null
  }));
  await frame.locator('#undo-control').click();
  const afterUndo = await frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    turnPaths: document.querySelectorAll('.route-turn').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null
  }));
  await frame.locator('#release-control').click();
  const afterRelease = await frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    turnPaths: document.querySelectorAll('.route-turn').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null
  }));
  await context.close();
  return { initial, afterButton, afterKeyboard, afterUndo, afterRelease, consoleMessages, pageErrors, failedRequests, badResponses };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu'] });
  const viewports = [];
  for (const [width, height] of VIEWPORTS) {
    viewports.push(await inspectViewport(browser, width, height, false));
    viewports.push(await inspectViewport(browser, width, height, true));
  }
  const interaction = await inspectInteraction(browser);
  await browser.close();
  const result = { root: ROOT, canonical: CANONICAL, viewports, interaction };
  await fs.writeFile(path.join(OUT, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
