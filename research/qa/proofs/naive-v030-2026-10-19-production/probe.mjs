import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-v030-2026-10-19-production');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawRoute = '/studies/naive-art/v030/?preview=1&interaction=1';
const canonicalRoute = '/works/naive-2026-10-19/';
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function diagnostics(page) {
  const value = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => value.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => value.pageErrors.push(error.message));
  page.on('requestfailed', (request) => value.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) value.badResponses.push(`${response.status()} ${response.url()}`); });
  return value;
}

async function waitRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV030), null, { timeout: 30000 });
  await page.waitForSelector('#pressure-svg', { timeout: 30000 });
  await sleep(100);
}

async function waitCanonical(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 30000 });
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/naive-art/v030/'));
  if (!frame) throw new Error('v030 embedded frame missing');
  await frame.waitForFunction(() => Boolean(window.__mutineNaiveV030), null, { timeout: 30000 });
  await sleep(250);
}

async function inspect(browser, route, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
  if (route === rawRoute) await waitRaw(page); else await waitCanonical(page);
  const evidence = await page.evaluate(({ isCanonical }) => {
    const tableau = isCanonical ? document.querySelector('.work-inspect__stage iframe') : document.querySelector('#pressure-svg');
    const heading = document.querySelector('h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauTop: tableau?.getBoundingClientRect().top ?? null,
      tableauVisible: Boolean(tableau && getComputedStyle(tableau).display !== 'none'),
      headingTop: heading?.getBoundingClientRect().top ?? null,
      title: heading?.textContent?.trim() ?? null
    };
  }, { isCanonical: route === canonicalRoute });
  await page.screenshot({ path: resolve(proofDir, `${route === rawRoute ? 'raw' : 'canonical'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { route: route === rawRoute ? 'raw' : 'canonical', viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = [];
  for (const reducedMotion of [false, true]) {
    for (const route of [rawRoute, canonicalRoute]) {
      for (const viewport of viewports) matrix.push(await inspect(browser, route, viewport, reducedMotion));
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interactionDiagnostics = diagnostics(page);
  await page.goto(`${base}${rawRoute}`, { waitUntil: 'networkidle', timeout: 60000 });
  await waitRaw(page);
  const initial = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, signature: window.__mutineNaiveV030.geometrySignature() }));
  const box = await page.locator('#pressure-svg').boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.48);
  const shallow = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction }));
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.48);
  await page.mouse.down();
  await sleep(700);
  await page.mouse.up();
  const held = await page.evaluate(() => { const state = window.__mutineNaiveV030.getState(); return { memory: state.memory.length, interaction: state.interaction, changedBoundaryIds: state.surface.changedBoundaryIds, remoteZone: state.surface.remoteZone, signature: window.__mutineNaiveV030.geometrySignature() }; });
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction, signature: window.__mutineNaiveV030.geometrySignature() }));
  await page.locator('[data-gesture="load"]').click();
  const button = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction }));
  await page.locator('#slab-field').focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction }));
  await page.keyboard.press('Delete');
  const keyboardLifted = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction }));
  await page.locator('[data-gesture="release"]').click();
  const released = await page.evaluate(() => ({ memory: window.__mutineNaiveV030.getState().memory.length, interaction: window.__mutineNaiveV030.getState().interaction }));
  const touchTargets = await page.evaluate(() => [...document.querySelectorAll('.slab-controls button')].map((node) => ({ text: node.textContent.trim(), height: node.getBoundingClientRect().height })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const blindDiagnostics = diagnostics(blind);
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`${base}/studies/naive-art/v030/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await waitRaw(blind);
  const blindEvidence = await blind.evaluate(() => ({
    svgVisible: getComputedStyle(document.querySelector('#pressure-svg')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.slab-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.slab-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.slab-hint')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineNaiveV030.getState().memory.length
  }));
  await blind.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await blind.close();

  const journal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiagnostics = diagnostics(journal);
  await journal.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 60000 });
  await journal.waitForSelector('#journal-naive-2026-10-19', { timeout: 30000 });
  const journalEvidence = await journal.evaluate(() => ({
    count: document.querySelectorAll('#journal-naive-2026-10-19').length,
    title: document.querySelector('#journal-naive-2026-10-19 h3')?.textContent?.trim() ?? null,
    canonicalHref: document.querySelector('#journal-naive-2026-10-19 h3 a')?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await journal.screenshot({ path: resolve(proofDir, 'journal-390x844.png'), fullPage: true });
  await journal.close();

  const current = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const currentDiagnostics = diagnostics(current);
  await current.goto(`${base}/currents/naive-art/`, { waitUntil: 'networkidle', timeout: 60000 });
  await current.waitForSelector('[data-catalog-current-header][data-ready="true"]', { timeout: 30000 });
  await current.waitForSelector('[data-work-id="naive-2026-10-19"]', { timeout: 30000 });
  const currentEvidence = await current.evaluate(() => ({
    header: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null,
    targetCount: document.querySelectorAll('[data-work-id="naive-2026-10-19"]').length,
    targetTitle: document.querySelector('[data-work-id="naive-2026-10-19"] h3')?.textContent?.trim() ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await current.screenshot({ path: resolve(proofDir, 'current-390x844.png'), fullPage: true });
  await current.close();
  await browser.close();

  const diagnosticsList = [...matrix.flatMap((entry) => Object.values(entry.diagnostics)), ...Object.values(interactionDiagnostics), ...Object.values(blindDiagnostics), ...Object.values(journalDiagnostics), ...Object.values(currentDiagnostics)];
  const failures = matrix.filter((entry) => { const target = Number(entry.viewport.split('x')[0]); return entry.evidence.innerWidth !== target || entry.evidence.clientWidth !== target || entry.evidence.scrollWidth > target || !entry.evidence.tableauVisible || (entry.route === 'canonical' && entry.evidence.tableauTop >= entry.evidence.headingTop) || Object.values(entry.diagnostics).some((items) => items.length); });
  const summary = {
    matrixRuns: matrix.length,
    matrixFailures: failures,
    diagnosticCount: diagnosticsList.reduce((sum, items) => sum + items.length, 0),
    overflowCount: matrix.filter((entry) => entry.evidence.scrollWidth > Number(entry.viewport.split('x')[0])).length,
    interaction: { initial: { memory: initial.memory }, shallow, held: { memory: held.memory, interaction: held.interaction, changedBoundaryIds: held.changedBoundaryIds, remoteZone: held.remoteZone, signatureChanged: held.signature !== initial.signature }, lifted: { memory: lifted.memory, interaction: lifted.interaction, exactRestore: lifted.signature === initial.signature }, button, keyboard, keyboardLifted, released, touchTargets, diagnostics: interactionDiagnostics },
    blindEvidence,
    journalEvidence,
    currentEvidence,
    productionAlias: base
  };
  await writeFile(resolve(proofDir, 'matrix.json'), JSON.stringify(matrix, null, 2));
  await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || summary.diagnosticCount || summary.overflowCount || !summary.journalEvidence.count || !summary.currentEvidence.targetCount) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
