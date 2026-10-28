import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:49436';
const proofDir = process.argv[3] || 'research/qa/proofs/portrait-v036-2026-10-28';
await mkdir(proofDir, { recursive: true });
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const diagnostics = [];
const runs = [];

async function openPage(url, viewport, reduced = false, waitForCanvas = true) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('console', (message) => diagnostics.push({ type: 'console', text: message.text(), url }));
  page.on('pageerror', (error) => diagnostics.push({ type: 'pageerror', text: error.message, url }));
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).hostname === '127.0.0.1') diagnostics.push({ type: 'http', status: response.status(), url: response.url() });
  });
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
  if (waitForCanvas) await page.waitForFunction(() => Boolean(window.__mutinePortraitV036 && document.querySelector('#resistance-canvas')));
  return { context, page };
}

for (const reduced of [false, true]) {
  for (const viewport of viewports) {
    const { context, page } = await openPage('/studies/self-portrait/v036/?preview=1&interaction=1', viewport, reduced);
    const result = await page.evaluate(() => {
      const stage = document.querySelector('[data-resistance-cast]');
      const canvas = document.querySelector('#resistance-canvas');
      const buttons = [...document.querySelectorAll('.resistance-controls button')];
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        stage: { x: stage.getBoundingClientRect().x, y: stage.getBoundingClientRect().y, width: stage.getBoundingClientRect().width, height: stage.getBoundingClientRect().height },
        canvas: { width: canvas.width, height: canvas.height, cssWidth: canvas.getBoundingClientRect().width, cssHeight: canvas.getBoundingClientRect().height },
        plateCount: window.__mutinePortraitV036.getState().plates.length,
        visibleCanvas: getComputedStyle(canvas).visibility !== 'hidden' && getComputedStyle(canvas).display !== 'none',
        touchTargets: buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        title: document.title
      };
    });
    await page.screenshot({ path: `${proofDir}/raw-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: false });
    runs.push({ mode: reduced ? 'reduced-motion' : 'normal', viewport: `${viewport.width}x${viewport.height}`, result });
    await context.close();
  }
}

const { context, page } = await openPage('/studies/self-portrait/v036/?preview=1&interaction=1', { width: 390, height: 844 }, true);
const baseline = await page.evaluate(() => ({ signature: window.__mutinePortraitV036.geometrySignature(), state: window.__mutinePortraitV036.getState() }));
const canvasBox = await page.locator('#resistance-canvas').boundingBox();
const start = { x: canvasBox.x + canvasBox.width * 0.3, y: canvasBox.y + canvasBox.height * 0.3 };
const end = { x: canvasBox.x + canvasBox.width * 0.72, y: canvasBox.y + canvasBox.height * 0.68 };
await page.mouse.move(start.x, start.y);
await page.mouse.down();
await page.mouse.move(end.x, end.y, { steps: 8 });
const afterProbe = await page.evaluate(() => ({ signature: window.__mutinePortraitV036.geometrySignature(), state: window.__mutinePortraitV036.getState() }));
await page.mouse.up();
const afterCast = await page.evaluate(() => ({ signature: window.__mutinePortraitV036.geometrySignature(), state: window.__mutinePortraitV036.getState() }));
await page.keyboard.press('Delete');
const afterLift = await page.evaluate(() => ({ signature: window.__mutinePortraitV036.geometrySignature(), state: window.__mutinePortraitV036.getState() }));
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
const afterKeyboard = await page.evaluate(() => ({ signature: window.__mutinePortraitV036.geometrySignature(), state: window.__mutinePortraitV036.getState() }));
await page.screenshot({ path: `${proofDir}/interaction-390x844-reduced.png`, fullPage: false });
await context.close();

const { context: blindContext, page: blindPage } = await openPage('/studies/self-portrait/v036/?preview=1&static=1&blind=1', { width: 390, height: 844 }, true);
const blind = await blindPage.evaluate(() => {
  const visible = (selector) => {
    const node = document.querySelector(selector);
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  return {
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    plateCount: window.__mutinePortraitV036.getState().plates.length,
    visibleCanvas: getComputedStyle(document.querySelector('#resistance-canvas')).visibility !== 'hidden',
    readoutVisible: visible('.resistance-readout'),
    hintVisible: visible('.resistance-hint'),
    controlsVisible: visible('.resistance-controls'),
    revision: window.__mutinePortraitV036.getState().revision,
    memory: window.__mutinePortraitV036.getState().memory.length
  };
});
await blindPage.screenshot({ path: `${proofDir}/blind-390x844-reduced.png`, fullPage: false });
await blindContext.close();

const { context: canonicalContext, page: canonicalPage } = await openPage('/works/portrait-2026-10-28/', { width: 390, height: 844 }, true, false);
await canonicalPage.waitForTimeout(250);
const canonical = await canonicalPage.evaluate(() => ({
  title: document.title,
  mount: Boolean(document.querySelector('[data-catalog-work-detail="portrait-2026-10-28"]')),
  text: document.body.innerText.includes('The portrait hardens where it resists.'),
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth
}));
await canonicalPage.screenshot({ path: `${proofDir}/canonical-390x844-reduced.png`, fullPage: true });
await canonicalContext.close();

await browser.close();
const payload = {
  runs,
  interaction: {
    geometryNeutralProbe: baseline.signature === afterProbe.signature,
    resistanceChanged: afterProbe.state.resistance.some((value) => value > 0),
    castChangedGeometry: afterCast.signature !== baseline.signature,
    castMemory: afterCast.state.memory.length,
    rolesRemote: ['hardenedIndex', 'fracturedIndex', 'binderIndex'].every((key) => afterCast.state.memory.at(-1)[key] !== afterCast.state.memory.at(-1).originIndex),
    liftedExact: afterLift.signature === baseline.signature,
    keyboardCommitted: afterKeyboard.state.memory.length === 1,
    keyboardRevision: afterKeyboard.state.revision
  },
  blind,
  canonical,
  diagnostics
};
console.log(JSON.stringify(payload, null, 2));
if (!payload.runs.every(({ result }) => result.innerWidth === result.clientWidth && result.scrollWidth <= result.innerWidth && result.plateCount === 9 && result.visibleCanvas && result.touchTargets.every((target) => target.height >= 44))) process.exitCode = 1;
if (!payload.interaction.geometryNeutralProbe || !payload.interaction.resistanceChanged || !payload.interaction.castChangedGeometry || !payload.interaction.rolesRemote || !payload.interaction.liftedExact || !payload.interaction.keyboardCommitted) process.exitCode = 1;
if (!(blind.plateCount === 9 && blind.visibleCanvas && !blind.readoutVisible && !blind.hintVisible && !blind.controlsVisible && blind.memory === 4 && blind.scrollWidth <= blind.innerWidth)) process.exitCode = 1;
if (!(canonical.mount && canonical.text && canonical.scrollWidth <= canonical.clientWidth)) process.exitCode = 1;
