import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('research/qa/proofs/webgpu-v015-2026-09-24');
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 }
];
const canonicalPath = '/works/webgpu-2026-09-24/';
const rawPath = '/studies/webgpu/v015/?preview=1&interaction=1';
const blindPath = '/studies/webgpu/v015/?preview=1&static=1&blind=1';

const diagnostics = (page) => {
  const output = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => output.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => output.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => output.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) output.badResponses.push(`${response.status()} ${response.url()}`); });
  return output;
};

const outerSnapshot = (page) => page.evaluate(() => {
  const box = (selector) => { const element = document.querySelector(selector); const rect = element?.getBoundingClientRect(); return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null; };
  return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframe: box('iframe'), heading: box('h1') };
});

const stateSnapshot = (frame) => frame.locator('body').evaluate(() => {
  const canvas = document.querySelector('#field');
  const rect = canvas?.getBoundingClientRect();
  const runtime = window.__MUTINE_STATE__;
  return {
    stage: document.querySelector('[data-stage]')?.textContent ?? null,
    memory: document.querySelector('[data-memory]')?.textContent ?? null,
    renderer: document.querySelector('[data-renderer]')?.textContent ?? null,
    canvas: rect ? { width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 } : null,
    runtime: runtime ? { stage: runtime.frame.stage, memory: runtime.frame.memory.length, signature: runtime.signature, aggregate: runtime.frame.aggregate } : null
  };
});

const waitForFrame = async (page) => {
  const iframe = page.locator('iframe').first();
  if (await iframe.count()) {
    await iframe.waitFor({ state: 'visible' });
    const frame = iframe.contentFrame();
    await frame.locator('#field').waitFor({ state: 'visible' });
    return frame;
  }
  await page.locator('#field').waitFor({ state: 'visible' });
  return page;
};

const issues = (run) => [...run.diagnostics.consoleMessages, ...run.diagnostics.pageErrors, ...run.diagnostics.failedRequests, ...run.diagnostics.badResponses];

async function runMatrix(browser, path, kind, viewport, reduced) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const frame = await waitForFrame(page);
  const snapshot = await stateSnapshot(frame);
  const outer = await outerSnapshot(page);
  const tableau = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return { iframeCount: mount?.querySelectorAll('iframe').length ?? 0, tableauFirst: Boolean(iframe && heading && iframe.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING), iframeVisible: Boolean(iframe?.getBoundingClientRect().width && iframe?.getBoundingClientRect().height) };
  });
  await context.close();
  return { kind, viewport: viewport.name, motion: reduced ? 'reduced' : 'normal', httpStatus: response?.status() ?? null, snapshot, outer, tableau, diagnostics: diag };
}

async function runInteraction(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${rawPath}`, { waitUntil: 'networkidle' });
  const frame = await waitForFrame(page);
  const canvas = frame.locator('#field');
  const initial = await stateSnapshot(frame);
  const beforeImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('production raw canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.24, box.y + box.height * 0.24);
  const armed = await stateSnapshot(frame);
  await page.mouse.down();
  await page.mouse.up();
  const witnessed = await stateSnapshot(frame);
  const witnessedImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.focus();
  await canvas.press('Enter');
  const keyboard = await stateSnapshot(frame);
  const keyboardImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await canvas.press('Delete');
  const lifted = await stateSnapshot(frame);
  const liftedImage = await canvas.evaluate((element) => element.toDataURL('image/png'));
  await frame.locator('[data-gesture="release"]').click();
  const released = await stateSnapshot(frame);
  const controls = await frame.locator('.cavity-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  const outer = await outerSnapshot(page);
  await page.screenshot({ path: resolve(proofDir, 'production-raw-interaction-390x844.png'), fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, initial, armed, witnessed, keyboard, lifted, released, controls, outer, changedOnWitness: beforeImage !== witnessedImage, changedOnKeyboard: witnessedImage !== keyboardImage, liftRestoredWitness: liftedImage === witnessedImage, releaseCleared: released.runtime?.memory === 0, diagnostics: diag };
}

async function runBlind(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${blindPath}`, { waitUntil: 'networkidle' });
  const frame = await waitForFrame(page);
  const evidence = await frame.locator('body').evaluate(() => {
    const styles = (selector) => getComputedStyle(document.querySelector(selector)).display;
    const canvas = document.querySelector('#field').getBoundingClientRect();
    return { canvasVisible: canvas.width > 0 && canvas.height > 0, canvasWidth: canvas.width, canvasHeight: canvas.height, readout: styles('.cavity-readout'), controls: styles('.cavity-controls'), caption: styles('figcaption'), header: styles('.studio-header'), annotations: styles('.cavity-notes'), innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, state: window.__MUTINE_STATE__ ? { stage: window.__MUTINE_STATE__.frame.stage, memory: window.__MUTINE_STATE__.frame.memory.length } : null };
  });
  await page.screenshot({ path: resolve(proofDir, 'production-static-blind-390x844.png'), fullPage: false });
  await context.close();
  return { httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runRoute(browser, path, selector, file) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.locator(selector).waitFor({ state: 'visible' });
  const evidence = await page.evaluate((target) => ({ count: document.querySelectorAll(target).length, text: document.querySelector(target)?.textContent?.trim() ?? null, innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }), selector);
  await page.screenshot({ path: resolve(proofDir, file), fullPage: false });
  await context.close();
  return { path, httpStatus: response?.status() ?? null, evidence, diagnostics: diag };
}

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const matrix = [];
  const rawMatrix = [];
  for (const viewport of viewports) {
    matrix.push(await runMatrix(browser, canonicalPath, 'canonical', viewport, false));
    matrix.push(await runMatrix(browser, canonicalPath, 'canonical', viewport, true));
    rawMatrix.push(await runMatrix(browser, rawPath, 'raw', viewport, false));
    rawMatrix.push(await runMatrix(browser, rawPath, 'raw', viewport, true));
  }
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runRoute(browser, '/journal/', '#journal-webgpu-2026-09-24', 'production-journal-390x844.png');
  const current = await runRoute(browser, '/currents/webgpu/', '[data-catalog-current-header="webgpu"]', 'production-current-webgpu-390x844.png');
  const allRuns = [...matrix, ...rawMatrix];
  const overflow = allRuns.filter((run) => run.outer.scrollWidth > run.outer.innerWidth).length;
  const allIssues = [...allRuns, interaction, blind, journal, current].flatMap(issues);
  const summary = {
    base,
    canonicalRuns: matrix.length,
    rawRuns: rawMatrix.length,
    viewportOverflow: overflow,
    issueCount: allIssues.length,
    tableauFirstCount: matrix.filter((run) => run.tableau.tableauFirst).length,
    interaction: { initial: interaction.initial.runtime, armed: interaction.armed.runtime, witnessed: interaction.witnessed.runtime, keyboard: interaction.keyboard.runtime, lifted: interaction.lifted.runtime, released: interaction.released.runtime, changedOnWitness: interaction.changedOnWitness, changedOnKeyboard: interaction.changedOnKeyboard, liftRestoredWitness: interaction.liftRestoredWitness, releaseCleared: interaction.releaseCleared, controls: interaction.controls, outer: interaction.outer },
    blind: blind.evidence,
    journal: journal.evidence,
    current: current.evidence,
    issues: allIssues
  };
  await writeFile(resolve(proofDir, 'production-results.json'), `${JSON.stringify({ matrix, rawMatrix, interaction, blind, journal, current }, null, 2)}\n`);
  await writeFile(resolve(proofDir, 'production-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.issueCount || summary.viewportOverflow || summary.tableauFirstCount !== matrix.length || !interaction.changedOnWitness || !interaction.changedOnKeyboard || !interaction.liftRestoredWitness || !interaction.releaseCleared) process.exitCode = 1;
} finally {
  await browser.close();
}
