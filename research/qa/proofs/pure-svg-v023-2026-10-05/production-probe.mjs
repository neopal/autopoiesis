import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/pure-svg-v023-2026-10-05');
const raw = '/studies/pure-svg/v023/?preview=1&interaction=1';
const canonical = '/works/svg-2026-10-05/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function open(page, path, isCanonical) {
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  if (isCanonical) {
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._mutineReady));
    return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v023/'));
  }
  await page.waitForFunction(() => Boolean(window._mutineReady));
  return page;
}

async function matrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [name, path] of [['raw', raw], ['canonical', canonical]]) {
      for (const [width, height] of viewports) {
        const page = await browser.newPage({ viewport: { width, height } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        const frame = await open(page, path, name === 'canonical');
        const shell = await page.evaluate(({ isCanonical }) => {
          const iframe = document.querySelector('.work-inspect__stage iframe');
          const heading = document.querySelector('.work-inspect__heading h1');
          return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, iframeTop: iframe?.getBoundingClientRect().top ?? null, headingTop: heading?.getBoundingClientRect().top ?? null, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)) };
        }, { isCanonical: name === 'canonical' });
        const tableau = await frame.evaluate(() => {
          const field = document.querySelector('#field');
          return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, width: field?.getBoundingClientRect().width ?? null, height: field?.getBoundingClientRect().height ?? null, memory: Number(field?.dataset.memory ?? -1), dryingCount: Number(field?.dataset.dryingCount ?? -1), chamberCount: document.querySelectorAll('.chamber').length, controls: [...document.querySelectorAll('.field-controls button')].map((node) => ({ text: node.textContent, height: node.getBoundingClientRect().height })) };
        });
        const routeKey = `${name}-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}`;
        await page.screenshot({ path: resolve(proofDir, `production-${routeKey}.png`), fullPage: true });
        results.push({ name, viewport: `${width}x${height}`, reducedMotion, shell, tableau, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function interaction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const frame = await open(page, raw, false);
  const state = () => frame.evaluate(() => { const field = document.querySelector('#field'); return { memory: Number(field.dataset.memory), signature: field.dataset.signature, interaction: field.dataset.interaction, notice: field.dataset.notice }; });
  const initial = await state();
  await frame.locator('#field').click({ position: { x: 120, y: 220 } });
  const tap = await state();
  await frame.locator('#field').focus();
  await frame.keyboard.press('1');
  const selected = await state();
  await frame.keyboard.press('Enter');
  const keyboard = await state();
  await frame.keyboard.press('Delete');
  const lifted = await state();
  await frame.keyboard.press('r');
  const released = await state();
  const box = await frame.locator('#field').boundingBox();
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.36);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  const realHold = await state();
  await frame.locator('#field').focus();
  await frame.keyboard.press('Delete');
  const afterHoldLift = await state();
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.up();
  const shortHold = await state();
  const buttons = await frame.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: resolve(proofDir, 'production-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, tap, selected, keyboard, lifted, released, realHold, afterHoldLift, shortHold, buttons, diagnostics: diag };
}

async function blind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const frame = await open(page, `${raw}&static=1&blind=1`, false);
  const evidence = await frame.evaluate(() => {
    const display = (selector) => {
      const node = document.querySelector(selector);
      return node ? getComputedStyle(node).display : 'absent';
    };
    const field = document.querySelector('#field');
    return { fieldVisible: Boolean(field) && getComputedStyle(field).display !== 'none', chamberCount: document.querySelectorAll('.chamber').length, dryingCount: Number(field?.dataset.dryingCount ?? -1), readoutDisplay: display('.field-readout'), controlsDisplay: display('.field-controls'), labelsDisplay: display('.svg-labels'), holdMarkDisplay: display('.hold-mark'), innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: resolve(proofDir, 'production-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function readback(browser, path, marker) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, recordAnchor: Boolean(document.querySelector('#journal-svg-2026-10-05, [data-work-id="svg-2026-10-05"]')), titlePresent: document.body.textContent.includes('The sheet refuses a quick touch.') }));
  await page.close();
  return { evidence, diagnostics: diag };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
await mkdir(proofDir, { recursive: true });
const matrixResults = await matrix(browser);
const interactionResult = await interaction(browser);
const blindResult = await blind(browser);
const journalResult = await readback(browser, '/journal/', '#journal-svg-2026-10-05');
const currentResult = await readback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-05"]');
await browser.close();
const diagnosticsOk = [...matrixResults.map((item) => item.diagnostics), interactionResult.diagnostics, blindResult.diagnostics, journalResult.diagnostics, currentResult.diagnostics].every((item) => !item.consoleMessages.length && !item.pageErrors.length && !item.failedRequests.length && !item.badResponses.length);
const matrixFailures = matrixResults.filter((item) => item.shell.innerWidth !== Number(item.viewport.split('x')[0]) || item.shell.scrollWidth > item.shell.innerWidth || item.tableau.scrollWidth > item.tableau.innerWidth || item.tableau.chamberCount !== 5 || item.tableau.controls.some((button) => button.height < 44) || (item.name === 'canonical' && !item.shell.tableauFirst));
const interactionOk = interactionResult.tap.memory === 0 && interactionResult.selected.memory === 0 && interactionResult.keyboard.memory === 1 && interactionResult.lifted.memory === 0 && interactionResult.released.memory === 0 && interactionResult.realHold.memory === 1 && interactionResult.afterHoldLift.memory === 0 && interactionResult.shortHold.memory === 0 && interactionResult.buttons.every((button) => button.height >= 44);
const hidden = (value) => value === 'none' || value === 'absent';
const blindOk = blindResult.evidence.fieldVisible && blindResult.evidence.chamberCount === 5 && blindResult.evidence.dryingCount >= 4 && hidden(blindResult.evidence.readoutDisplay) && hidden(blindResult.evidence.controlsDisplay) && hidden(blindResult.evidence.labelsDisplay) && hidden(blindResult.evidence.holdMarkDisplay) && blindResult.evidence.innerWidth === blindResult.evidence.clientWidth && blindResult.evidence.scrollWidth <= blindResult.evidence.innerWidth;
const summary = { base, matrixRuns: matrixResults.length, matrixFailures, interaction: interactionResult, blind: blindResult, journal: journalResult, current: currentResult, diagnosticsOk, interactionOk, blindOk, proofDir };
await writeFile(resolve(proofDir, 'production-results.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ matrixRuns: summary.matrixRuns, matrixFailures: summary.matrixFailures, diagnosticsOk, interactionOk, blindOk, journal: journalResult.evidence, current: currentResult.evidence }, null, 2));
if (matrixFailures.length || !diagnosticsOk || !interactionOk || !blindOk || !journalResult.evidence.recordAnchor || !currentResult.evidence.recordAnchor) process.exitCode = 1;
