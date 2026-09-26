import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:4189';
const outputDir = process.argv[3] || 'research/qa/proofs/brush-v020-2026-09-26';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const executablePath = process.env.CHROME_PATH || 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const results = { base, matrix: [], focused: {}, diagnostics: [], overflowCount: 0, failed: false };

async function inspect(page, route, viewport, reduced, label, screenshotName) {
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1300);
  const data = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const coil = document.querySelector('#coil');
    const iframe = document.querySelector('iframe');
    const rect = (node) => node ? (() => { const box = node.getBoundingClientRect(); return { top: box.top, left: box.left, width: box.width, height: box.height, right: box.right, bottom: box.bottom }; })() : null;
    const canvasEvidence = canvas ? {
      width: canvas.width,
      height: canvas.height,
      cssWidth: Math.round(canvas.getBoundingClientRect().width),
      cssHeight: Math.round(canvas.getBoundingClientRect().height),
      dataTail: canvas.toDataURL('image/png').slice(-96)
    } : null;
    return {
      href: location.href,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      ready: document.querySelector('[data-ready="true"]') !== null || Boolean(iframe) || Boolean(canvas),
      iframeCount: document.querySelectorAll('iframe').length,
      canvasCount: document.querySelectorAll('canvas').length,
      canvasEvidence,
      coilRect: rect(coil),
      iframeRect: rect(iframe),
      memory: coil?.dataset.memory ?? null,
      seams: coil?.dataset.seams ?? null,
      interaction: coil?.dataset.interaction ?? null,
      hiddenReadout: document.querySelector('.coil-readout') ? getComputedStyle(document.querySelector('.coil-readout')).display === 'none' : null,
      hiddenControls: document.querySelector('.coil-controls') ? getComputedStyle(document.querySelector('.coil-controls')).display === 'none' : null,
      buttonHeights: [...document.querySelectorAll('button')].map((button) => Math.round(button.getBoundingClientRect().height)),
      navLabels: [...document.querySelector('nav[aria-label="Studio navigation"]')?.querySelectorAll('a') ?? []].map((anchor) => anchor.textContent.trim())
    };
  });
  const iframeCanvasCount = await Promise.all(page.frames().filter((frame) => frame !== page.mainFrame()).map((frame) => frame.evaluate(() => document.querySelectorAll('canvas').length).catch(() => 0))).then((counts) => counts.reduce((total, count) => total + count, 0));
  const entry = { label, route, viewport, reduced, status: response?.status() ?? null, iframeCanvasCount, ...data, screenshot: screenshotName };
  results.matrix.push(entry);
  if (entry.scrollWidth > entry.innerWidth) results.overflowCount += 1;
  if (screenshotName) await page.screenshot({ path: `${outputDir}/${screenshotName}`, fullPage: false });
  return entry;
}

for (const [width, height] of viewports) {
  for (const reduced of [false, true]) {
    for (const target of [
      { name: 'canonical', route: '/works/brush-2026-09-26/' },
      { name: 'raw', route: '/studies/p5-brush/v020/?preview=1&interaction=1' }
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const consoleMessages = [];
      const pageErrors = [];
      const failedRequests = [];
      page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
      const label = `${target.name}-${width}x${height}-${reduced ? 'reduced' : 'normal'}`;
      const entry = await inspect(page, target.route, [width, height], reduced, label, `${label}.png`);
      entry.consoleMessages = consoleMessages;
      entry.pageErrors = pageErrors;
      entry.failedRequests = failedRequests;
      if (consoleMessages.length || pageErrors.length || failedRequests.length) results.diagnostics.push(entry);
      await context.close();
    }
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionConsole = [];
const interactionErrors = [];
const interactionFailed = [];
interactionPage.on('console', (message) => interactionConsole.push(`${message.type()}: ${message.text()}`));
interactionPage.on('pageerror', (error) => interactionErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
await interactionPage.goto(`${base}/studies/p5-brush/v020/?preview=1&interaction=1`, { waitUntil: 'networkidle', timeout: 30000 });
await interactionPage.waitForTimeout(1200);
const initial = await interactionPage.evaluate(() => ({
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams,
  interaction: document.querySelector('#coil')?.dataset.interaction,
  dataTail: document.querySelector('canvas')?.toDataURL('image/png').slice(-96)
}));
await interactionPage.locator('#dry-control').click();
await interactionPage.waitForTimeout(160);
const afterButton = await interactionPage.evaluate(() => ({
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams,
  interaction: document.querySelector('#coil')?.dataset.interaction,
  dataTail: document.querySelector('canvas')?.toDataURL('image/png').slice(-96)
}));
await interactionPage.locator('#coil-canvas').focus();
await interactionPage.keyboard.press('D');
await interactionPage.waitForTimeout(160);
const afterKeyboard = await interactionPage.evaluate(() => ({
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams,
  dataTail: document.querySelector('canvas')?.toDataURL('image/png').slice(-96)
}));
await interactionPage.keyboard.press('Delete');
await interactionPage.waitForTimeout(160);
const afterLift = await interactionPage.evaluate(() => ({
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams,
  interaction: document.querySelector('#coil')?.dataset.interaction
}));
await interactionPage.locator('#release-control').click();
await interactionPage.waitForTimeout(160);
const afterRelease = await interactionPage.evaluate(() => ({
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams,
  interaction: document.querySelector('#coil')?.dataset.interaction,
  buttonRects: [...document.querySelectorAll('button')].map((button) => { const box = button.getBoundingClientRect(); return { width: Math.round(box.width), height: Math.round(box.height) }; })
}));
await interactionPage.screenshot({ path: `${outputDir}/interaction-390x844.png`, fullPage: false });
results.focused.interaction = { initial, afterButton, afterKeyboard, afterLift, afterRelease, consoleMessages: interactionConsole, pageErrors: interactionErrors, failedRequests: interactionFailed };

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
const blindConsole = [];
const blindErrors = [];
const blindFailed = [];
blindPage.on('console', (message) => blindConsole.push(`${message.type()}: ${message.text()}`));
blindPage.on('pageerror', (error) => blindErrors.push(String(error)));
blindPage.on('requestfailed', (request) => blindFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
await blindPage.goto(`${base}/studies/p5-brush/v020/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
await blindPage.waitForTimeout(1200);
const blindState = await blindPage.evaluate(() => ({
  canvasVisible: Boolean(document.querySelector('canvas') && getComputedStyle(document.querySelector('canvas')).display !== 'none'),
  readoutHidden: getComputedStyle(document.querySelector('.coil-readout')).display === 'none',
  controlsHidden: getComputedStyle(document.querySelector('.coil-controls')).display === 'none',
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  memory: document.querySelector('#coil')?.dataset.memory,
  seams: document.querySelector('#coil')?.dataset.seams
}));
results.focused.blind = { ...blindState, consoleMessages: blindConsole, pageErrors: blindErrors, failedRequests: blindFailed };
await blindPage.screenshot({ path: `${outputDir}/blind-390x844.png`, fullPage: false });

const journalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const journalPage = await journalContext.newPage();
await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
await journalPage.waitForTimeout(650);
results.focused.journal = await journalPage.evaluate(() => ({
  title: document.querySelector('#journal-brush-2026-09-26 h3')?.textContent.trim() ?? null,
  link: document.querySelector('#journal-brush-2026-09-26 a.text-link')?.getAttribute('href') ?? null,
  count: document.querySelectorAll('#journal-brush-2026-09-26').length,
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await journalPage.screenshot({ path: `${outputDir}/journal-390x844.png`, fullPage: false });

const currentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const currentPage = await currentContext.newPage();
await currentPage.goto(`${base}/currents/brush/`, { waitUntil: 'networkidle', timeout: 30000 });
await currentPage.waitForTimeout(1000);
results.focused.current = await currentPage.evaluate(() => ({
  title: document.querySelector('[data-catalog-current-header] h1')?.textContent.trim() ?? null,
  firstWork: document.querySelector('.catalog-card--work h3')?.textContent.trim() ?? null,
  count: document.querySelectorAll('.catalog-card--work').length,
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await currentPage.screenshot({ path: `${outputDir}/current-brush-390x844.png`, fullPage: false });

const status = {
  matrixCount: results.matrix.length,
  matrixPassCount: results.matrix.filter((entry) => entry.status === 200 && entry.scrollWidth <= entry.innerWidth && entry.ready && (entry.canvasCount >= 1 || entry.iframeCanvasCount >= 1) && !entry.consoleMessages?.length && !entry.pageErrors?.length && !entry.failedRequests?.length).length,
  overflowCount: results.overflowCount,
  diagnosticCount: results.diagnostics.length,
  interaction: results.focused.interaction,
  blind: results.focused.blind,
  journal: results.focused.journal,
  current: results.focused.current
};
results.status = status;
await writeFile(`${outputDir}/results.json`, JSON.stringify(results, null, 2));
await writeFile(`${outputDir}/summary.json`, JSON.stringify(status, null, 2));
console.log(JSON.stringify(status, null, 2));
await Promise.all([interactionContext.close(), blindContext.close(), journalContext.close(), currentContext.close(), browser.close()]);
