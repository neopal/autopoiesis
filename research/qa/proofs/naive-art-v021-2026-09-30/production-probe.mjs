import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-art-v021-2026-09-30');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/naive-art/v021/?preview=1&interaction=1',
  canonical: '/works/naive-2026-09-30/'
};
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

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

async function waitForRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV021), null, { timeout: 20000 });
  await page.waitForSelector('#map-field', { timeout: 20000 });
  await sleep(100);
}

async function waitForCanonical(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 20000 });
  const frame = page.frameLocator('.work-inspect__stage iframe');
  await frame.locator('#map-field').waitFor({ state: 'visible', timeout: 20000 });
  await sleep(220);
}

async function inspect(browser, route, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diagnosticState = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  if (route === routes.raw) await waitForRaw(page);
  else await waitForCanonical(page);
  const isRaw = route === routes.raw;
  const evidence = await page.evaluate((rawRoute) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const frameDocument = iframe?.contentDocument;
    const svg = rawRoute ? document.querySelector('#map-field') : frameDocument?.querySelector('#map-field');
    const heading = document.querySelector('h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      svgVisible: Boolean(svg && getComputedStyle(svg).display !== 'none'),
      svgWidth: svg?.getBoundingClientRect().width ?? null,
      tableauTag: svg?.tagName?.toLowerCase() ?? null,
      iframeTop: iframe?.getBoundingClientRect().top ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      title: heading?.textContent?.trim() ?? null
    };
  }, isRaw);
  await page.screenshot({ path: `${proofDir}/production-${route === routes.raw ? 'raw' : 'canonical'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`, fullPage: true });
  await page.close();
  return { route: route === routes.raw ? 'raw' : 'canonical', viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diagnosticState };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const route of Object.values(routes)) {
      for (const viewport of viewports) results.push(await inspect(browser, route, viewport, reducedMotion));
    }
  }

  const interaction = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interactionDiagnostics = diagnostics(interaction);
  await interaction.emulateMedia({ reducedMotion: 'no-preference' });
  await interaction.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForRaw(interaction);
  const initial = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  const svg = interaction.locator('#map-field');
  const box = await svg.boundingBox();
  await interaction.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.24);
  const moved = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  const touchTargets = await interaction.evaluate(() => [...document.querySelectorAll('.map-controls button')].map((button) => ({ id: button.id, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
  await interaction.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.24);
  const clicked = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await svg.focus();
  await interaction.keyboard.press('Enter');
  const keyboard = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.keyboard.press('Delete');
  const lifted = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.keyboard.press('r');
  const released = await interaction.evaluate(() => window.__mutineNaiveV021.getState());
  await interaction.screenshot({ path: `${proofDir}/production-interaction-390x844.png`, fullPage: true });
  await interaction.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const blindDiagnostics = diagnostics(blind);
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`${base}/studies/naive-art/v021/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForRaw(blind);
  const blindEvidence = await blind.evaluate(() => ({
    svgVisible: getComputedStyle(document.querySelector('#map-field')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.map-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.map-controls')).display,
    annotationsDisplay: getComputedStyle(document.querySelector('.map-annotations')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    state: window.__mutineNaiveV021.getState()
  }));
  await blind.screenshot({ path: `${proofDir}/production-blind-390x844.png`, fullPage: true });
  await blind.close();

  const journal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiagnostics = diagnostics(journal);
  await journal.goto(`${base}/journal/`, { waitUntil: 'networkidle' });
  await journal.waitForSelector('#journal-naive-2026-09-30', { timeout: 20000 });
  const journalEvidence = await journal.evaluate(() => ({
    count: document.querySelectorAll('#journal-naive-2026-09-30').length,
    title: document.querySelector('#journal-naive-2026-09-30 h3')?.textContent?.trim() ?? null,
    canonicalHref: document.querySelector('#journal-naive-2026-09-30 h3 a')?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await journal.screenshot({ path: `${proofDir}/production-journal-390x844.png`, fullPage: true });
  await journal.close();

  const current = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const currentDiagnostics = diagnostics(current);
  await current.goto(`${base}/currents/naive-art/`, { waitUntil: 'networkidle' });
  await current.waitForSelector('[data-catalog-current-header][data-ready="true"]', { timeout: 20000 });
  await current.waitForSelector('.catalog-card--work', { timeout: 20000 });
  const currentEvidence = await current.evaluate(() => ({
    header: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null,
    firstWork: document.querySelector('.catalog-card--work h3')?.textContent?.trim() ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await current.screenshot({ path: `${proofDir}/production-current-390x844.png`, fullPage: true });
  await current.close();
  await browser.close();

  const allDiagnostics = [
    ...results.flatMap((entry) => Object.values(entry.diagnostics)),
    ...Object.values(interactionDiagnostics),
    ...Object.values(blindDiagnostics),
    ...Object.values(journalDiagnostics),
    ...Object.values(currentDiagnostics)
  ];
  const failures = results.filter((entry) => entry.evidence.innerWidth !== Number(entry.viewport.split('x')[0]) || entry.evidence.scrollWidth > entry.evidence.innerWidth || !entry.evidence.svgVisible || (entry.route === 'canonical' && !(entry.evidence.iframeTop < entry.evidence.headingTop)) || Object.values(entry.diagnostics).some((items) => items.length));
  const summary = {
    base,
    matrixRuns: results.length,
    matrixFailures: failures,
    diagnosticCount: allDiagnostics.reduce((sum, items) => sum + items.length, 0),
    interaction: { initial, moved, clicked, keyboard, lifted, released, touchTargets, diagnostics: interactionDiagnostics },
    blindEvidence,
    journalEvidence,
    currentEvidence
  };
  await writeFile(`${proofDir}/production-results.json`, JSON.stringify(results, null, 2));
  await writeFile(`${proofDir}/production-summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || summary.diagnosticCount) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
