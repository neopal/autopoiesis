import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:4184';
const outputDir = process.argv[3] || 'research/qa/proofs/brush-v019-2026-09-25';
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = {
  base,
  matrix: [],
  focused: {},
  diagnostics: [],
  overflowCount: 0,
  failed: false
};

async function inspect(page, route, viewport, reduced, label, screenshotName) {
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  const data = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rack = document.querySelector('#rack');
    const iframe = document.querySelector('iframe');
    const intro = document.querySelector('.work-inspect__heading, .register-opening, [data-catalog-current-header]');
    const sample = canvas ? (() => {
      const context = canvas.getContext('2d');
      if (!context) return 'no-context';
      const pixels = context.getImageData(0, 0, Math.max(1, canvas.width), Math.max(1, canvas.height)).data;
      let value = 0;
      for (let index = 0; index < pixels.length; index += 997) value = (value + pixels[index] * (index + 1)) % 1000000007;
      return String(value);
    })() : null;
    const rect = (node) => node ? (() => { const box = node.getBoundingClientRect(); return { top: box.top, left: box.left, width: box.width, height: box.height, right: box.right, bottom: box.bottom }; })() : null;
    return {
      href: location.href,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      ready: document.querySelector('[data-ready="true"]') !== null,
      iframeCount: document.querySelectorAll('iframe').length,
      canvasCount: document.querySelectorAll('canvas').length,
      canvasRect: rect(canvas),
      rackRect: rect(rack),
      iframeRect: rect(iframe),
      introRect: rect(intro),
      memory: rack?.dataset.memory ?? null,
      gaps: rack?.dataset.gaps ?? null,
      interaction: rack?.dataset.interaction ?? null,
      canvasSample: sample,
      hiddenReadout: document.querySelector('.rack-readout') ? getComputedStyle(document.querySelector('.rack-readout')).display === 'none' : null,
      hiddenControls: document.querySelector('.rack-controls') ? getComputedStyle(document.querySelector('.rack-controls')).display === 'none' : null,
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
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
    const label = `canonical-${width}x${height}-${reduced ? 'reduced' : 'normal'}`;
    const entry = await inspect(page, '/works/brush-2026-09-25/', [width, height], reduced, label, `${label}.png`);
    entry.consoleMessages = consoleMessages;
    entry.pageErrors = pageErrors;
    entry.failedRequests = failedRequests;
    if (consoleMessages.length || pageErrors.length || failedRequests.length) results.diagnostics.push(entry);
    await context.close();
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionConsole = [];
const interactionErrors = [];
const interactionFailed = [];
interactionPage.on('console', (message) => interactionConsole.push(`${message.type()}: ${message.text()}`));
interactionPage.on('pageerror', (error) => interactionErrors.push(String(error)));
interactionPage.on('requestfailed', (request) => interactionFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`));
await interactionPage.goto(`${base}/studies/p5-brush/v019/?preview=1&interaction=1`, { waitUntil: 'networkidle', timeout: 30000 });
await interactionPage.waitForTimeout(900);
const rackBox = await interactionPage.locator('#rack').boundingBox();
await interactionPage.mouse.move(rackBox.x + rackBox.width * 0.5, rackBox.y + rackBox.height * 0.5);
const initial = await interactionPage.evaluate(() => ({ memory: document.querySelector('#rack')?.dataset.memory, gaps: document.querySelector('#rack')?.dataset.gaps, sample: document.querySelector('canvas')?.toDataURL().slice(-80) }));
await interactionPage.mouse.wheel(0, 140);
await interactionPage.waitForTimeout(120);
const afterWheel = await interactionPage.evaluate(() => ({ memory: document.querySelector('#rack')?.dataset.memory, gaps: document.querySelector('#rack')?.dataset.gaps, interaction: document.querySelector('#rack')?.dataset.interaction, sample: document.querySelector('canvas')?.toDataURL().slice(-80) }));
await interactionPage.locator('#rack-canvas').focus();
await interactionPage.keyboard.press('ArrowDown');
await interactionPage.waitForTimeout(120);
const afterKeyboard = await interactionPage.evaluate(() => ({ memory: document.querySelector('#rack')?.dataset.memory, gaps: document.querySelector('#rack')?.dataset.gaps, sample: document.querySelector('canvas')?.toDataURL().slice(-80) }));
await interactionPage.keyboard.press('Delete');
await interactionPage.waitForTimeout(120);
const afterLift = await interactionPage.evaluate(() => ({ memory: document.querySelector('#rack')?.dataset.memory, gaps: document.querySelector('#rack')?.dataset.gaps, interaction: document.querySelector('#rack')?.dataset.interaction }));
await interactionPage.locator('#release-control').click();
await interactionPage.waitForTimeout(120);
const afterRelease = await interactionPage.evaluate(() => ({ memory: document.querySelector('#rack')?.dataset.memory, gaps: document.querySelector('#rack')?.dataset.gaps, interaction: document.querySelector('#rack')?.dataset.interaction, buttonRects: [...document.querySelectorAll('button')].map((button) => { const box = button.getBoundingClientRect(); return { width: Math.round(box.width), height: Math.round(box.height) }; }) }));
await interactionPage.screenshot({ path: `${outputDir}/interaction-390x844.png`, fullPage: false });
results.focused.interaction = {
  initial,
  afterWheel,
  afterKeyboard,
  afterLift,
  afterRelease,
  consoleMessages: interactionConsole,
  pageErrors: interactionErrors,
  failedRequests: interactionFailed
};

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
await blindPage.goto(`${base}/studies/p5-brush/v019/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle', timeout: 30000 });
await blindPage.waitForTimeout(900);
results.focused.blind = await blindPage.evaluate(() => ({
  canvasVisible: Boolean(document.querySelector('canvas') && getComputedStyle(document.querySelector('canvas')).display !== 'none'),
  readoutHidden: getComputedStyle(document.querySelector('.rack-readout')).display === 'none',
  controlsHidden: getComputedStyle(document.querySelector('.rack-controls')).display === 'none',
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  memory: document.querySelector('#rack')?.dataset.memory,
  gaps: document.querySelector('#rack')?.dataset.gaps
}));
await blindPage.screenshot({ path: `${outputDir}/blind-390x844.png`, fullPage: false });

const journalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const journalPage = await journalContext.newPage();
await journalPage.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
await journalPage.waitForTimeout(500);
results.focused.journal = await journalPage.evaluate(() => ({
  status: document.querySelector('#journal-brush-2026-09-25')?.querySelector('h3')?.textContent.trim() ?? null,
  link: document.querySelector('#journal-brush-2026-09-25 a.text-link')?.getAttribute('href') ?? null,
  count: document.querySelectorAll('#journal-brush-2026-09-25').length,
  innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await journalPage.screenshot({ path: `${outputDir}/journal-390x844.png`, fullPage: false });

const currentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const currentPage = await currentContext.newPage();
await currentPage.goto(`${base}/currents/brush/`, { waitUntil: 'networkidle', timeout: 30000 });
await currentPage.waitForTimeout(800);
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
  matrixPassCount: results.matrix.filter((entry) => entry.status === 200 && entry.scrollWidth <= entry.innerWidth && entry.ready && entry.iframeCount >= 1 && entry.iframeCanvasCount >= 1 && !entry.consoleMessages?.length && !entry.pageErrors?.length && !entry.failedRequests?.length).length,
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
