import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v018-2026-09-25-production');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v018/?preview=1&interaction=1',
  canonical: '/works/naive-2026-09-25/'
};

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

async function sleep(ms) { return new Promise((resolveSleep) => setTimeout(resolveSleep, ms)); }

async function tableauFrame(page) {
  const frame = page.frames().find((entry) => entry.url().includes('/studies/naive-art/v018/'));
  if (frame) await frame.waitForFunction(() => Boolean(window.__mutineNaiveV018), null, { timeout: 10000 });
  return frame ?? null;
}

async function probePage(browser, routeName, path, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const diagnostic = diagnostics(page);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  if (routeName === 'raw') {
    await page.waitForFunction(() => Boolean(window.__mutineNaiveV018));
  } else {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-catalog-work-detail][data-ready="true"]')), null, { timeout: 10000 });
  }
  await sleep(120);
  const frame = await tableauFrame(page);
  const evidence = await page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframe: iframe ? { top: iframe.getBoundingClientRect().top, height: iframe.getBoundingClientRect().height, src: iframe.src } : null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      tableauFirst: Boolean(iframe && heading && iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top),
      mountReady: mount?.dataset.ready ?? null,
      canvasVisible: Boolean(document.querySelector('canvas'))
    };
  });
  evidence.iframeState = frame ? await frame.evaluate(() => window.__mutineNaiveV018.getState()) : null;
  await page.screenshot({ path: join(proofDir, `${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { routeName, path, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diagnostic };
}

async function focusedInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const diagnostic = diagnostics(page);
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV018));
  const initial = await page.evaluate(() => window.__mutineNaiveV018.getState());
  const canvas = page.locator('#field');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width * .48, box.y + box.height * .46);
  const shortClick = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await page.mouse.move(box.x + box.width * .20, box.y + box.height * .40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .78, box.y + box.height * .56, { steps: 4 });
  await page.mouse.up();
  const dragged = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await canvas.focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await page.locator('#release-control').click();
  const released = await page.evaluate(() => window.__mutineNaiveV018.getState());
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, shortClick, dragged, keyboard, lifted, released, restoredDragged: lifted.foldSignature === dragged.foldSignature, diagnostics: diagnostic };
}

async function focusedBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostic = diagnostics(page);
  await page.goto(`${base}/studies/naive-art/v018/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV018));
  const evidence = await page.evaluate(() => ({
    canvasVisible: getComputedStyle(document.querySelector('canvas')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineNaiveV018.getState()
  }));
  await page.screenshot({ path: join(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diagnostic };
}

async function catalogReadback(browser, path, selector, evidenceFn, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostic = diagnostics(page);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction((value) => Boolean(document.querySelector(value)?.dataset.ready === 'true'), selector, { timeout: 10000 });
  const evidence = await page.evaluate(evidenceFn);
  await page.screenshot({ path: join(proofDir, filename), fullPage: true });
  await page.close();
  return { path, evidence, diagnostics: diagnostic };
}

async function httpReadback() {
  const paths = ['/studio/data/works.json', '/journal/', '/works/naive-2026-09-25/', '/studies/naive-art/v018/?preview=1&interaction=1', '/studio/favicon.svg'];
  const checks = [];
  for (const path of paths) {
    const response = await fetch(`${base}${path}`);
    const text = await response.text();
    checks.push({ path, status: response.status, bytes: text.length, hasRecord: text.includes('naive-2026-09-25'), hasTitle: text.includes('The picture forgets the hinge.'), hasJournal: text.includes('journal-naive-2026-09-25'), hasTableauPath: text.includes('/studies/naive-art/v018/') });
  }
  const works = await (await fetch(`${base}/studio/data/works.json`)).json();
  const matches = works.works.filter((work) => work.id === 'naive-2026-09-25');
  return { checks, recordCount: matches.length, record: matches[0] ? { id: matches[0].id, title: matches[0].title, rawPath: matches[0].rawPath, journalAnchor: matches[0].journal.anchor, status: matches[0].status } : null };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, path] of Object.entries(routes)) {
      for (const viewport of viewports) matrix.push(await probePage(browser, routeName, path, viewport, reducedMotion));
    }
  }
  const interaction = await focusedInteraction(browser);
  const blind = await focusedBlind(browser);
  const journal = await catalogReadback(browser, '/journal/', '[data-catalog="journal"]', () => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    anchorCount: document.querySelectorAll('#journal-naive-2026-09-25').length,
    titleCount: [...document.querySelectorAll('#journal-naive-2026-09-25 h3')].filter((node) => node.textContent.includes('The picture forgets the hinge.')).length,
    canonicalLinkCount: [...document.querySelectorAll('#journal-naive-2026-09-25 a')].filter((node) => node.getAttribute('href') === '/works/naive-2026-09-25/#journal').length
  }), 'journal-390x844.png');
  const current = await catalogReadback(browser, '/currents/naive-art/', '[data-catalog-current-header]', () => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    currentHeaderCount: document.querySelectorAll('[data-catalog-current-header] #current-title').length,
    currentHeader: document.querySelector('[data-catalog-current-header] #current-title')?.textContent ?? null,
    firstWorkCount: document.querySelectorAll('[data-work-id="naive-2026-09-25"]').length,
    firstWorkTitle: document.querySelector('[data-work-id="naive-2026-09-25"] h3')?.textContent ?? null
  }), 'current-naive-390x844.png');
  await browser.close();
  const http = await httpReadback();
  const failures = matrix.filter((result) => {
    const width = Number(result.viewport.split('x')[0]);
    return result.evidence.innerWidth !== width || result.evidence.scrollWidth > result.evidence.innerWidth || (result.routeName === 'canonical' && !result.evidence.tableauFirst) || Object.values(result.diagnostics).some((items) => items.length);
  });
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, http };
  await writeFile(join(proofDir, 'results.json'), `${JSON.stringify({ matrix, ...summary }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
