import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.MUTINE_PROD_BASE ?? 'https://autopoiesis-nine.vercel.app';
const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const proofDir = resolve(ROOT, 'research/qa/proofs/naive-art-v025-2026-10-07-production');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v025/?preview=1&interaction=1',
  canonical: '/works/naive-2026-10-07/'
};
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function embeddedFrame(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV025));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/naive-art/v025/'));
}

async function inspect(page, label, viewport, reduced, route) {
  const measurements = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: rect('#pressure-sheet'),
      intro: rect('.work-opening'),
      firstArtwork: rect('.artwork-frame'),
      controls: [...document.querySelectorAll('.pressure-controls button')].map((node) => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, visible: getComputedStyle(node).display !== 'none' };
      }),
      state: window.__mutineNaiveV025?.getState?.() ?? null,
      wideNodes: [...document.querySelectorAll('*')].map((node) => {
        const box = node.getBoundingClientRect();
        return { selector: node.tagName.toLowerCase(), left: box.left, right: box.right, scrollWidth: node.scrollWidth };
      }).filter((node) => node.left < -0.5 || node.right > window.innerWidth + 0.5).slice(0, 20)
    };
  });
  if (label === 'canonical') {
    const frame = await embeddedFrame(page);
    measurements.embedded = await frame.evaluate(() => {
      const field = document.querySelector('#pressure-sheet');
      const box = field?.getBoundingClientRect();
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fieldVisible: Boolean(field && getComputedStyle(field).display !== 'none'),
        fieldRect: box ? { left: box.left, top: box.top, width: box.width, height: box.height } : null,
        state: window.__mutineNaiveV025?.getState?.() ?? null,
        controls: [...document.querySelectorAll('.pressure-controls button')].map((node) => {
          const button = node.getBoundingClientRect();
          return { width: button.width, height: button.height, visible: getComputedStyle(node).display !== 'none' };
        })
      };
    });
  }
  const file = `${proofDir}/${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`;
  await page.screenshot({ path: file, fullPage: false });
  return { label, viewport: { width: viewport[0], height: viewport[1] }, reduced, route, measurements, screenshot: file };
}

for (const [label, route] of Object.entries(routes)) {
  for (const viewport of viewports) {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      const failed = [];
      const consoleMessages = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
      page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
      const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__mutineNaiveV025 || [...document.querySelectorAll('iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV025));
      await page.waitForTimeout(reduced ? 160 : 120);
      const entry = await inspect(page, label, viewport, reduced, route);
      entry.httpStatus = response?.status() ?? null;
      entry.pageErrors = errors;
      entry.failedRequests = failed;
      entry.consoleMessages = consoleMessages;
      results.push(entry);
      await context.close();
    }
  }
}

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const interactionErrors = [];
const interactionFailed = [];
const interactionConsole = [];
page.on('pageerror', (error) => interactionErrors.push(String(error)));
page.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
page.on('console', (message) => interactionConsole.push(`${message.type()}: ${message.text()}`));
await page.goto(`${BASE}${routes.raw}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__mutineNaiveV025);
const initial = await page.evaluate(() => window.__mutineNaiveV025.getState());
const fieldBox = await page.locator('#pressure-sheet').boundingBox();
await page.mouse.click(fieldBox.x + fieldBox.width * .5, fieldBox.y + fieldBox.height * .5);
const afterTap = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.mouse.move(fieldBox.x + fieldBox.width * .72, fieldBox.y + fieldBox.height * .36);
await page.mouse.down();
await page.waitForTimeout(190);
await page.mouse.up();
const afterPress = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.locator('#pressure-sheet').focus();
await page.keyboard.press('Enter');
const afterEnter = await page.evaluate(() => window.__mutineNaiveV025.getState());
const enterSignature = afterEnter.geometrySignature;
await page.keyboard.press('Delete');
const afterDelete = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.keyboard.press('r');
const afterRelease = await page.evaluate(() => window.__mutineNaiveV025.getState());
await page.getByRole('button', { name: 'press the sheet' }).click();
const afterButton = await page.evaluate(() => window.__mutineNaiveV025.getState());
const touchTargets = await page.evaluate(() => [...document.querySelectorAll('.pressure-controls button')].map((node) => {
  const box = node.getBoundingClientRect();
  return { width: box.width, height: box.height };
}));
await page.screenshot({ path: `${proofDir}/interaction-390x844.png`, fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blind = await blindContext.newPage();
const blindErrors = [];
const blindFailed = [];
const blindConsole = [];
blind.on('pageerror', (error) => blindErrors.push(String(error)));
blind.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
blind.on('console', (message) => blindConsole.push(`${message.type()}: ${message.text()}`));
const blindResponse = await blind.goto(`${BASE}/studies/naive-art/v025/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await blind.waitForFunction(() => window.__mutineNaiveV025);
const blindEvidence = await blind.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#pressure-sheet')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.pressure-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.pressure-controls')).display !== 'none',
  canvasVisible: Boolean(document.querySelector('#naive-sheet-stage')),
  state: window.__mutineNaiveV025.getState()
}));
await blind.screenshot({ path: `${proofDir}/blind-390x844.png`, fullPage: false });

const journal = await browser.newPage();
const journalErrors = [];
const journalFailed = [];
journal.on('pageerror', (error) => journalErrors.push(String(error)));
journal.on('requestfailed', (request) => journalFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
const journalResponse = await journal.goto(`${BASE}/journal/`, { waitUntil: 'networkidle' });
await journal.waitForSelector('[data-catalog="journal"][data-ready="true"]');
const journalEvidence = await journal.evaluate(() => ({
  anchorCount: document.querySelectorAll('#journal-naive-2026-10-07').length,
  titleCount: [...document.querySelectorAll('#journal-naive-2026-10-07 h3')].filter((node) => node.textContent.includes('The picture swallows the pressure.')).length,
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await journal.screenshot({ path: `${proofDir}/journal-390x844.png`, fullPage: false });

const current = await browser.newPage();
const currentResponse = await current.goto(`${BASE}/currents/naive-art/`, { waitUntil: 'networkidle' });
await current.waitForSelector('[data-catalog-current="naive"][data-ready="true"]');
const currentEvidence = await current.evaluate(() => ({
  cardCount: document.querySelectorAll('[data-work-id="naive-2026-10-07"]').length,
  titleCount: [...document.querySelectorAll('[data-work-id="naive-2026-10-07"] h3')].filter((node) => node.textContent.includes('The picture swallows the pressure.')).length,
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await current.screenshot({ path: `${proofDir}/current-390x844.png`, fullPage: false });

const worksResponse = await fetch(`${BASE}/studio/data/works.json`);
assert.equal(worksResponse.status, 200);
const works = await worksResponse.json();
const matchingRecords = works.works.filter((work) => work.id === 'naive-2026-10-07');
const faviconResponse = await fetch(`${BASE}/studio/favicon.svg`);

assert.equal(journalResponse?.status(), 200);
assert.equal(currentResponse?.status(), 200);
assert.equal(matchingRecords.length, 1);
assert.equal(matchingRecords[0].rawPath, '/studies/naive-art/v025/');
assert.equal(faviconResponse.status, 200);
assert.equal(afterTap.memory, initial.memory);
assert.equal(afterTap.interaction, 'short-press-refused');
assert.equal(afterPress.memory, initial.memory + 1);
assert.equal(afterEnter.memory, afterPress.memory + 1);
assert.equal(afterDelete.memory, afterEnter.memory - 1);
assert.equal(afterDelete.geometrySignature, afterPress.geometrySignature);
assert.equal(afterRelease.memory, 0);
assert.equal(afterButton.memory, 1);
assert.notEqual(enterSignature, afterPress.geometrySignature);
assert.ok(touchTargets.every((target) => target.height >= 44));
assert.equal(blindEvidence.fieldVisible, true);
assert.equal(blindEvidence.canvasVisible, true);
assert.equal(blindEvidence.readoutVisible, false);
assert.equal(blindEvidence.controlsVisible, false);
assert.equal(journalEvidence.anchorCount, 1);
assert.equal(journalEvidence.titleCount, 1);
assert.equal(currentEvidence.cardCount, 1);
assert.equal(currentEvidence.titleCount, 1);
assert.equal(results.flatMap((entry) => entry.pageErrors).length, 0);
assert.equal(results.flatMap((entry) => entry.failedRequests).length, 0);
assert.equal(results.flatMap((entry) => entry.consoleMessages).length, 0);
assert.equal(interactionErrors.length + interactionFailed.length + interactionConsole.length + blindErrors.length + blindFailed.length + blindConsole.length + journalErrors.length + journalFailed.length, 0);
assert.equal(results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length, 0);
assert.equal(results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth || entry.measurements.embedded?.scrollWidth > entry.measurements.embedded?.innerWidth).length, 0);

const output = {
  status: 'production-headless-browser-probe',
  base: BASE,
  routes,
  deployment: 'dpl_Fu2nPP83cxhif1iPa8UJqmeBfyM1',
  viewportRuns: results,
  interaction: { initial, afterTap, afterPress, afterEnter, afterDelete, afterRelease, afterButton, touchTargets, pageErrors: interactionErrors, failedRequests: interactionFailed, consoleMessages: interactionConsole },
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blindEvidence, pageErrors: blindErrors, failedRequests: blindFailed, consoleMessages: blindConsole },
  journal: { httpStatus: journalResponse?.status() ?? null, evidence: journalEvidence, pageErrors: journalErrors, failedRequests: journalFailed },
  current: { httpStatus: currentResponse?.status() ?? null, evidence: currentEvidence },
  register: { httpStatus: worksResponse.status, matchingRecordCount: matchingRecords.length, rawPath: matchingRecords[0].rawPath },
  favicon: { httpStatus: faviconResponse.status, contentType: faviconResponse.headers.get('content-type') },
  counts: {
    viewportRuns: results.length,
    httpFailures: results.filter((entry) => entry.httpStatus >= 400 || entry.httpStatus === null).length,
    overflowFailures: results.filter((entry) => entry.measurements.scrollWidth > entry.measurements.innerWidth || entry.measurements.embedded?.scrollWidth > entry.measurements.embedded?.innerWidth).length,
    diagnosticRuns: results.filter((entry) => entry.pageErrors.length || entry.failedRequests.length || entry.consoleMessages.length).length,
    screenshotCount: results.length + 4
  }
};
await writeFile(`${proofDir}/results.json`, JSON.stringify(output, null, 2));
await blindContext.close();
await context.close();
await journal.close();
await current.close();
await browser.close();
console.log(JSON.stringify(output.counts));
