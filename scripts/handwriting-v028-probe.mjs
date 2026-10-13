import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile as readBinary, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const BASE = process.env.MUTINE_BASE_URL || 'http://127.0.0.1:4190';
const SERVER_PORT = Number(new URL(BASE).port || 4190);
const CHROME = process.env.MUTINE_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROOF_DIR = process.env.MUTINE_PROOF_DIR || 'research/qa/proofs/handwriting-v028-2026-10-14';
const RAW_PATH = '/studies/handwriting/v028/';
const WORK_PATH = '/works/typography-2026-10-14/';
const JOURNAL_PATH = '/journal/';
const CURRENT_PATH = '/currents/handwriting/';
const VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
    const relative = normalize(pathname).replace(/^[/\\\\]+/, '');
    let filePath = resolve(ROOT, relative || 'index.html');
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    if (!filePath.toLowerCase().startsWith(ROOT.toLowerCase())) throw new Error('outside root');
    const body = await readBinary(filePath);
    response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch (_) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((resolveServer) => server.listen(SERVER_PORT, '127.0.0.1', resolveServer));

await mkdir(PROOF_DIR, { recursive: true });
const diagnostics = [];
const screenshots = [];
const matrix = [];

function attachDiagnostics(page, label) {
  page.on('console', (message) => diagnostics.push({ label, kind: 'console', type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => diagnostics.push({ label, kind: 'pageerror', text: String(error) }));
  page.on('requestfailed', (request) => diagnostics.push({ label, kind: 'requestfailed', url: request.url(), text: request.failure()?.errorText || 'unknown' }));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.push({ label, kind: 'http', status: response.status(), url: response.url() });
  });
}

async function openChecked(context, path, label, screenshotName) {
  const page = await context.newPage();
  attachDiagnostics(page, label);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const isRaw = path.startsWith(RAW_PATH);
  let tableauFrame = page.mainFrame();
  if (isRaw) {
    await page.waitForFunction(() => Boolean(window.__mutineHandwritingV028));
  } else {
    await page.waitForSelector('[data-catalog-work-detail] iframe');
    await page.waitForFunction(() => [...document.querySelectorAll('iframe')].some((iframe) => iframe.contentWindow?.__mutineHandwritingV028));
    tableauFrame = page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/handwriting/v028/'));
    if (!tableauFrame) throw new Error(`${label} iframe frame missing`);
    await tableauFrame.waitForFunction(() => Boolean(window.__mutineHandwritingV028));
  }
  const state = await tableauFrame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    hasField: Boolean(document.querySelector('#counter-field')),
    hasSvg: Boolean(document.querySelector('#counter-svg')),
    glyphCount: document.querySelectorAll('[data-glyph-index]').length,
    status: window.__mutineHandwritingV028.getState()
  }));
  const outerState = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  state.outer = outerState;
  if (!response || response.status() >= 400) throw new Error(`${label} returned ${response?.status()}`);
  if (state.innerWidth !== state.clientWidth || state.scrollWidth > state.clientWidth || state.outer.innerWidth !== state.outer.clientWidth || state.outer.scrollWidth > state.outer.clientWidth) throw new Error(`${label} overflow: ${JSON.stringify(state)}`);
  if (!state.hasField || !state.hasSvg || state.glyphCount !== 12) throw new Error(`${label} missing tableau: ${JSON.stringify(state)}`);
  const shot = `${PROOF_DIR}/${screenshotName}`;
  await page.screenshot({ path: shot });
  screenshots.push(shot);
  await page.close();
  return state;
}

for (const reducedMotion of [false, true]) {
  for (const [width, height] of VIEWPORTS) {
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      executablePath: CHROME,
      viewport: { width, height },
      reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
    });
    const mode = reducedMotion ? 'reduced' : 'normal';
    const raw = await openChecked(context, `${RAW_PATH}?preview=1&interaction=1`, `raw-${width}x${height}-${mode}`, `${String(screenshots.length + 1).padStart(2, '0')}-raw-${width}x${height}-${mode}.png`);
    const canonical = await openChecked(context, WORK_PATH, `canonical-${width}x${height}-${mode}`, `${String(screenshots.length + 1).padStart(2, '0')}-canonical-${width}x${height}-${mode}.png`);
    matrix.push({ width, height, mode, raw, canonical });
    await context.close();
  }
}

const interactionContext = await chromium.launchPersistentContext('', { headless: true,
      executablePath: CHROME, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const interactionPage = await interactionContext.newPage();
attachDiagnostics(interactionPage, 'interaction-390x844');
await interactionPage.goto(`${BASE}${RAW_PATH}?preview=1&interaction=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
await interactionPage.waitForFunction(() => Boolean(window.__mutineHandwritingV028));
const interaction = await interactionPage.evaluate(() => {
  const api = window.__mutineHandwritingV028;
  const field = document.querySelector('#counter-field');
  const rect = document.querySelector('#counter-svg').getBoundingClientRect();
  const frame = api.getFrame();
  const point = (index) => ({ x: rect.left + frame.glyphs[index].x * rect.width, y: rect.top + frame.glyphs[index].y * rect.height });
  return { before: api.getState(), baselineSignature: api.getSignature(), points: { source: point(1), target: point(9) } };
});
await interactionPage.mouse.move(interaction.points.source.x, interaction.points.source.y);
await interactionPage.mouse.down();
const armed = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
await interactionPage.mouse.move(interaction.points.target.x, interaction.points.target.y);
await interactionPage.mouse.up();
const pointerReply = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV028.getState(), signature: window.__mutineHandwritingV028.getSignature() }));
await interactionPage.evaluate(() => window.__mutineHandwritingV028.armCounter(1));
const sameGapBefore = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
await interactionPage.evaluate(() => window.__mutineHandwritingV028.commitReply(1));
const sameGap = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
await interactionPage.locator('#counter-field').focus();
await interactionPage.keyboard.press('Enter');
const keyboardReply = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
const changedSignature = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getSignature());
await interactionPage.keyboard.press('Delete');
const lifted = await interactionPage.evaluate(() => ({ state: window.__mutineHandwritingV028.getState(), signature: window.__mutineHandwritingV028.getSignature() }));
const buttonBefore = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
await interactionPage.locator('#offer-counter').click();
const buttonReply = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
await interactionPage.locator('#release-counter').click();
const released = await interactionPage.evaluate(() => window.__mutineHandwritingV028.getState());
const touchTargets = await interactionPage.locator('.counter-controls button').evaluateAll((buttons) => buttons.map((button) => ({ id: button.id, height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })));
await interactionPage.screenshot({ path: `${PROOF_DIR}/21-interaction-390x844.png` });
screenshots.push(`${PROOF_DIR}/21-interaction-390x844.png`);
await interactionPage.close();
await interactionContext.close();

const blindContext = await chromium.launchPersistentContext('', { headless: true,
      executablePath: CHROME, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
attachDiagnostics(blindPage, 'blind-390x844');
await blindPage.goto(`${BASE}${RAW_PATH}?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
await blindPage.waitForFunction(() => Boolean(window.__mutineHandwritingV028));
const blind = await blindPage.evaluate(() => {
  const field = document.querySelector('#counter-field');
  const svg = document.querySelector('#counter-svg');
  const visible = (selector) => getComputedStyle(document.querySelector(selector)).display !== 'none';
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    svgVisible: getComputedStyle(svg).display !== 'none',
    readoutVisible: visible('.counter-readout'),
    controlsVisible: visible('.counter-controls'),
    hintVisible: visible('.counter-hint'),
    state: window.__mutineHandwritingV028.getState(),
    fieldRect: field.getBoundingClientRect().toJSON()
  };
});
await blindPage.screenshot({ path: `${PROOF_DIR}/22-blind-390x844.png` });
screenshots.push(`${PROOF_DIR}/22-blind-390x844.png`);
await blindPage.close();
await blindContext.close();

const readbackContext = await chromium.launchPersistentContext('', { headless: true,
      executablePath: CHROME, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
for (const [path, label, screenshotName] of [
  [JOURNAL_PATH, 'journal-390x844', '23-journal-390x844.png'],
  [CURRENT_PATH, 'current-390x844', '24-current-390x844.png'],
  [WORK_PATH, 'work-390x844', '25-work-390x844.png']
]) {
  const page = await readbackContext.newPage();
  attachDiagnostics(page, label);
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const readback = await page.evaluate((workId) => ({
    status: document.body.innerText.includes('The word leaves a hollow.'),
    anchor: Boolean(document.querySelector(`#journal-${workId}`)),
    detail: Boolean(document.querySelector(`[data-catalog-work-detail="${workId}"]`)),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }), 'typography-2026-10-14');
  if (!response || response.status() >= 400) throw new Error(`${label} returned ${response?.status()}`);
  if (readback.innerWidth !== readback.clientWidth || readback.scrollWidth > readback.clientWidth) throw new Error(`${label} overflow: ${JSON.stringify(readback)}`);
  await page.screenshot({ path: `${PROOF_DIR}/${screenshotName}` });
  screenshots.push(`${PROOF_DIR}/${screenshotName}`);
  matrix.push({ label, readback });
  await page.close();
}
await readbackContext.close();

const result = {
  base: BASE,
  rawPath: RAW_PATH,
  workPath: WORK_PATH,
  viewportMatrix: matrix,
  interaction: {
    armed,
    pointerReply,
    sameGapBefore,
    sameGap,
    keyboardReply,
    exactLift: lifted.signature === pointerReply.signature,
    lifted,
    buttonBefore,
    buttonReply,
    released,
    touchTargets
  },
  blind,
  diagnostics,
  screenshots,
  screenshotCount: screenshots.length,
  passed: diagnostics.length === 0 && screenshots.length === 25 && pointerReply.state.memory === 1 && sameGap.memory === 1 && keyboardReply.memory === 2 && lifted.signature === pointerReply.signature && released.memory === 0 && blind.svgVisible && !blind.readoutVisible && !blind.controlsVisible && !blind.hintVisible && touchTargets.every((target) => target.height >= 44)
};
await writeFile(`${PROOF_DIR}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ passed: result.passed, diagnostics: diagnostics.length, screenshotCount: screenshots.length, interaction: result.interaction, blind: result.blind }, null, 2));
await new Promise((resolveServer) => server.close(resolveServer));
if (!result.passed) process.exitCode = 1;
