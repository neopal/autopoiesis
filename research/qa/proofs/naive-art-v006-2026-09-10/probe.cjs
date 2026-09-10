const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('C:/Users/ASUS/autopoiesis/node_modules/playwright');

const ROOT = process.env.MUTINE_QA_ROOT || 'http://127.0.0.1:4173';
const CANONICAL = `${ROOT}/works/naive-2026-09-10/`;
const RAW_INTERACTIVE = `${ROOT}/studies/naive-art/v006/?preview=1&interaction=1`;
const RAW_BLIND = `${ROOT}/studies/naive-art/v006/?preview=1&static=1`;
const OUT = path.resolve(process.env.MUTINE_QA_OUT || 'research/qa/proofs/naive-art-v006-2026-09-10');
const VIEWPORTS = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];

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
      reversalDots: child?.querySelectorAll('#field .reversal-dot').length || 0,
      buttonTargets: buttons,
      errorsText: document.querySelector('.catalog-state--error')?.textContent.trim() || null
    };
  });
}

function attachDiagnostics(page, root) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.url().startsWith(root) && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForCanonical(page) {
  await page.goto(CANONICAL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail]')?.dataset.ready === 'true', null, { timeout: 10000 });
  await page.waitForFunction(() => Boolean(document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field')), null, { timeout: 10000 });
}

async function inspectViewport(browser, width, height, reduced) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, ROOT);
  let state;
  let screenshot = null;
  try {
    await waitForCanonical(page);
    state = await readState(page);
    screenshot = path.join(OUT, safeName(width, height, reduced));
    await page.screenshot({ path: screenshot, fullPage: false });
  } catch (error) {
    state = { probeError: String(error) };
  }
  await context.close();
  return { requestedUrl: CANONICAL, width, height, reduced, state, screenshot, ...diagnostics };
}

async function inspectInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, ROOT);
  await waitForCanonical(page);
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v006/'));
  if (!frame) throw new Error('interactive v006 iframe frame not found');
  const state = () => frame.evaluate(() => ({
    stage: document.querySelector('[data-stage]')?.textContent.trim() || null,
    memory: document.querySelector('[data-memory]')?.textContent.trim() || null,
    reversalDots: document.querySelectorAll('.reversal-dot').length,
    route: document.querySelector('.route-kept')?.getAttribute('d') || null,
    buttons: [...document.querySelectorAll('.field-controls button')].map((button) => ({
      id: button.id,
      rect: (() => { const box = button.getBoundingClientRect(); return { width: box.width, height: box.height }; })()
    }))
  }));
  const initial = await state();
  await frame.locator('#field').click({ position: { x: 180, y: 420 } });
  const afterPointer = await state();
  await frame.locator('#field').focus();
  await frame.locator('#field').press('Enter');
  const afterKeyboard = await state();
  await frame.locator('#undo-control').click();
  const afterUndo = await state();
  await frame.locator('#release-control').click();
  const afterRelease = await state();
  const screenshot = path.join(OUT, 'interaction-1280x800.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { initial, afterPointer, afterKeyboard, afterUndo, afterRelease, exactUndoRoute: afterUndo.route === afterPointer.route, releaseCleared: afterRelease.memory === '0 reversals retained', screenshot, ...diagnostics };
}

async function inspectRaw(browser, url, name, reduced, blind = false) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, ROOT);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#field', { timeout: 10000 });
  if (blind) {
    await page.addStyleTag({ content: '#field .panel-label,#field .panel-stage,#field .sequence-mark,#field .memory-bridge,#field .reversal-dot,.field-readout{display:none!important}' });
  }
  const state = await page.evaluate((shouldCheckBlind) => {
    const root = document.documentElement;
    const field = document.querySelector('#field');
    const fieldBox = field.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.field-controls button')].map((button) => {
      const box = button.getBoundingClientRect();
      return { id: button.id, label: button.textContent.trim(), width: box.width, height: box.height, visible: box.width > 0 && box.height > 0 };
    });
    return {
      url: location.href,
      viewport: { innerWidth, innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth },
      previewMode: root.classList.contains('preview-mode'),
      interactivePreview: root.classList.contains('interactive-preview'),
      staticMode: root.classList.contains('static-mode'),
      field: { width: fieldBox.width, height: fieldBox.height },
      buttons,
      stageText: document.querySelector('[data-stage]')?.textContent.trim() || null,
      memoryText: document.querySelector('[data-memory]')?.textContent.trim() || null,
      pathCount: document.querySelectorAll('#field path').length,
      hiddenWitnesses: shouldCheckBlind ? [...document.querySelectorAll('#field .panel-label,#field .panel-stage,#field .sequence-mark,#field .memory-bridge,#field .reversal-dot,.field-readout')].every((node) => getComputedStyle(node).display === 'none') : null
    };
  }, blind);
  const screenshot = path.join(OUT, name);
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { requestedUrl: url, reduced, blind, state, screenshot, ...diagnostics };
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
  const rawInteractive = await inspectRaw(browser, RAW_INTERACTIVE, 'raw-interactive-390x844.png', false, false);
  const rawBlind = await inspectRaw(browser, RAW_BLIND, 'raw-blind-390x844.png', true, true);
  await browser.close();
  const result = { root: ROOT, canonical: CANONICAL, rawInteractive: RAW_INTERACTIVE, rawBlind: RAW_BLIND, viewports, interaction, rawInteractiveResult: rawInteractive, rawBlindResult: rawBlind };
  await fs.writeFile(path.join(OUT, 'results.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
