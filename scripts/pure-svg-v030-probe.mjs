import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.MUTINE_BASE_URL ?? 'http://127.0.0.1:4283';
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v030-2026-10-13');
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
const rawPath = '/studies/pure-svg/v030/?preview=1&interaction=1';
const canonicalPath = '/works/svg-2026-10-13/';
const waitForReady = async (page) => {
  await page.waitForFunction(() => window._mutineReady === true || document.querySelector('[data-ready="true"]'), null, { timeout: 10000 });
  await page.waitForTimeout(80);
};
const frameForWork = (page) => page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v030/'));

async function measurePage(page, url, width, height, reduced, route) {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const diagnostics = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => {
    if (diagnostics.console.length < 12) diagnostics.console.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    if (diagnostics.pageErrors.length < 12) diagnostics.pageErrors.push(String(error));
  });
  page.on('requestfailed', (request) => {
    if (diagnostics.failedRequests.length < 12) diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && diagnostics.badResponses.length < 12) diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle' });
  await waitForReady(page);
  const main = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    title: document.title,
    fieldVisible: Boolean(document.querySelector('#field')),
    intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
    firstArtwork: document.querySelector('.work-inspect__stage iframe, #field')?.getBoundingClientRect().toJSON() ?? null
  }));
  const workFrame = frameForWork(page);
  let embedded = null;
  if (workFrame) {
    await workFrame.waitForFunction(() => window._mutineReady === true, null, { timeout: 10000 });
    embedded = await workFrame.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
      memory: document.querySelector('#field')?.dataset.memory ?? null,
      interaction: document.querySelector('#field')?.dataset.interaction ?? null
    }));
  } else {
    embedded = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: document.querySelector('#field')?.getBoundingClientRect().toJSON() ?? null,
      memory: document.querySelector('#field')?.dataset.memory ?? null,
      interaction: document.querySelector('#field')?.dataset.interaction ?? null
    }));
  }
  return { route, width, height, reduced, main, embedded, diagnostics };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  const matrix = [];
  for (const reduced of [false, true]) {
    for (const [width, height] of viewports) {
      matrix.push(await measurePage(page, rawPath, width, height, reduced, 'raw'));
      matrix.push(await measurePage(page, canonicalPath, width, height, reduced, 'canonical'));
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await waitForReady(page);
  const field = page.locator('#field');
  const box = await field.boundingBox();
  if (!box) throw new Error('v030 field has no bounding box');
  const point = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const before = await field.getAttribute('data-signature');
  const start = point(0.19, 0.26);
  const end = point(0.81, 0.73);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const armed = await field.getAttribute('data-memory');
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const after = await field.getAttribute('data-signature');
  const interaction = {
    drag: {
      armedMemory: Number(armed),
      committedMemory: Number(await field.getAttribute('data-memory')),
      state: await field.getAttribute('data-interaction'),
      changedGeometry: before !== after,
      source: await field.getAttribute('data-source'),
      target: await field.getAttribute('data-target'),
      relay: await field.getAttribute('data-relay')
    }
  };
  await page.screenshot({ path: join(proofDir, 'interaction-drag-390.png'), fullPage: true });

  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'networkidle' });
  await waitForReady(page);
  const sameBox = await page.locator('#field').boundingBox();
  const samePoint = { x: sameBox.x + sameBox.width * 0.19, y: sameBox.y + sameBox.height * 0.26 };
  await page.mouse.click(samePoint.x, samePoint.y);
  await page.mouse.click(samePoint.x, samePoint.y);
  interaction.sameGate = {
    memory: Number(await page.locator('#field').getAttribute('data-memory')),
    state: await page.locator('#field').getAttribute('data-interaction')
  };

  const keyboardField = page.locator('#field');
  await keyboardField.focus();
  await keyboardField.press('Enter');
  const keyboardArmed = Number(await keyboardField.getAttribute('data-memory'));
  await keyboardField.press('Enter');
  const keyboardCommitted = Number(await keyboardField.getAttribute('data-memory'));
  await keyboardField.press('Delete');
  const keyboardLifted = Number(await keyboardField.getAttribute('data-memory'));
  await keyboardField.press('r');
  interaction.keyboard = { armed: keyboardArmed, committed: keyboardCommitted, lifted: keyboardLifted, released: Number(await keyboardField.getAttribute('data-memory')) };

  await page.goto(`${baseUrl}/studies/pure-svg/v030/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForReady(page);
  const blind = await page.evaluate(() => {
    const field = document.querySelector('#field');
    const readout = document.querySelector('.field-readout');
    const controls = document.querySelector('.field-controls');
    const annotations = document.querySelector('.work-annotations');
    return {
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0 && field.getBoundingClientRect().height > 0),
      readoutHidden: getComputedStyle(readout).display === 'none',
      controlsHidden: getComputedStyle(controls).display === 'none',
      annotationsHidden: getComputedStyle(annotations).display === 'none',
      memory: field?.dataset.memory,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: join(proofDir, 'blind-static-390.png'), fullPage: true });

  const readbacks = {};
  for (const [name, url, selector] of [
    ['journal', '/journal/', '#journal-svg-2026-10-13'],
    ['current', '/currents/pure-svg/', '[data-work-id="svg-2026-10-13"]'],
    ['canonical', canonicalPath, '[data-catalog-work-detail="svg-2026-10-13"]']
  ]) {
    await page.goto(`${baseUrl}${url}`, { waitUntil: 'networkidle' });
    await waitForReady(page);
    readbacks[name] = { visible: await page.locator(selector).count() > 0, title: await page.title(), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), innerWidth: await page.evaluate(() => window.innerWidth) };
  }
  await page.screenshot({ path: join(proofDir, 'canonical-390.png'), fullPage: true });

  await browser.close();
  const allDiagnostics = matrix.flatMap((entry) => Object.values(entry.diagnostics).flat());
  const overflow = matrix.filter((entry) => entry.main.scrollWidth > entry.main.innerWidth || entry.embedded.scrollWidth > entry.embedded.innerWidth);
  const result = {
    baseUrl,
    proofDir,
    viewports,
    matrixRuns: matrix.length,
    matrix,
    overflowCount: overflow.length,
    diagnostics: allDiagnostics,
    interaction,
    blind,
    readbacks,
    screenshotCount: 3,
    generatedAt: new Date().toISOString()
  };
  await writeFile(join(proofDir, 'qa-summary.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  const report = `# Pure SVG v030 QA — 2026-10-13\n\n- Base URL: ${baseUrl}\n- Matrix: ${matrix.length}/20 raw/canonical runs across 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and reduced-motion modes.\n- Overflow: ${overflow.length} failing runs; all recorded innerWidth/clientWidth/scrollWidth values are in qa-summary.json.\n- Diagnostics: ${allDiagnostics.length} console/page-error/request/HTTP-400+ entries.\n- Drag: armed memory ${interaction.drag.armedMemory}; committed memory ${interaction.drag.committedMemory}; state ${interaction.drag.state}; changed geometry ${interaction.drag.changedGeometry}.\n- Same gate: memory ${interaction.sameGate.memory}; state ${interaction.sameGate.state}.\n- Keyboard: Enter armed ${interaction.keyboard.armed}, committed ${interaction.keyboard.committed}; Delete ${interaction.keyboard.lifted}; R ${interaction.keyboard.released}.\n- Blind preview: field visible ${blind.fieldVisible}; readout hidden ${blind.readoutHidden}; controls hidden ${blind.controlsHidden}; annotations hidden ${blind.annotationsHidden}; overflow ${blind.scrollWidth <= blind.innerWidth}.\n- Readbacks: ${Object.entries(readbacks).map(([key, value]) => `${key}=${value.visible}`).join(', ')}.\n- Captures: interaction-drag-390.png, blind-static-390.png, canonical-390.png.\n`;
  await writeFile(join(proofDir, 'README.md'), report, 'utf8');
  console.log(JSON.stringify({ matrixRuns: matrix.length, overflowCount: overflow.length, diagnostics: allDiagnostics.length, interaction, blind, readbacks, proofDir }, null, 2));
}

await main();
