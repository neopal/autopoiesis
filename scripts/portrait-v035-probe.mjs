import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = 'http://127.0.0.1:49321';
const proofDir = 'research/qa/proofs/portrait-v035-2026-10-27';
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

async function openPage(url, viewport, reduced = false, waitForOrbit = true) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  page.on('console', (message) => diagnostics.push({ type: 'console', text: message.text(), url }));
  page.on('pageerror', (error) => diagnostics.push({ type: 'pageerror', text: error.message, url }));
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).hostname === '127.0.0.1') diagnostics.push({ type: 'http', status: response.status(), url: response.url() });
  });
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle' });
  if (waitForOrbit) await page.waitForSelector('[data-attention-orbit]');
  return { context, page };
}

for (const reduced of [false, true]) {
  for (const viewport of viewports) {
    const { context, page } = await openPage('/studies/self-portrait/v035/?preview=1&interaction=1', viewport, reduced);
    const result = await page.evaluate(() => {
      const stage = document.querySelector('[data-attention-orbit]');
      const buttons = [...document.querySelectorAll('.orbit-controls button, .orbit-void')];
      const nodes = [...document.querySelectorAll('.orbit-node')];
      return {
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        stage: { x: stage.getBoundingClientRect().x, y: stage.getBoundingClientRect().y, width: stage.getBoundingClientRect().width, height: stage.getBoundingClientRect().height },
        nodeCount: nodes.length,
        visibleNodes: nodes.filter((node) => getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none').length,
        touchTargets: buttons.map((button) => ({ label: button.textContent.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
        title: document.title
      };
    });
    await page.screenshot({ path: `${proofDir}/raw-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: false });
    runs.push({ mode: reduced ? 'reduced-motion' : 'normal', viewport: `${viewport.width}x${viewport.height}`, result });
    await context.close();
  }
}

const { context, page } = await openPage('/studies/self-portrait/v035/?preview=1&interaction=1', { width: 390, height: 844 }, true);
const interaction = await page.evaluate(() => ({ baseline: window.__mutinePortraitV035.geometrySignature(), state: window.__mutinePortraitV035.getState() }));
const stageBox = await page.locator('[data-attention-orbit]').boundingBox();
await page.mouse.move(stageBox.x + stageBox.width * .16, stageBox.y + stageBox.height * .5);
const afterObserve = await page.evaluate(() => ({ signature: window.__mutinePortraitV035.geometrySignature(), attention: window.__mutinePortraitV035.getState().attention }));
await page.locator('[data-action="audit"]').first().click();
const afterAudit = await page.evaluate(() => ({ signature: window.__mutinePortraitV035.geometrySignature(), state: window.__mutinePortraitV035.getState() }));
await page.keyboard.press('Delete');
const afterLift = await page.evaluate(() => ({ signature: window.__mutinePortraitV035.geometrySignature(), state: window.__mutinePortraitV035.getState() }));
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
const afterKeyboard = await page.evaluate(() => ({ signature: window.__mutinePortraitV035.geometrySignature(), state: window.__mutinePortraitV035.getState() }));
await page.screenshot({ path: `${proofDir}/interaction-390x844-reduced.png`, fullPage: false });
await context.close();

const { context: blindContext, page: blindPage } = await openPage('/studies/self-portrait/v035/?preview=1&static=1&blind=1', { width: 390, height: 844 }, true);
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
    nodeCount: document.querySelectorAll('.orbit-node').length,
    visibleNodes: [...document.querySelectorAll('.orbit-node')].filter((node) => getComputedStyle(node).visibility !== 'hidden').length,
    readoutVisible: visible('.orbit-readout'),
    hintVisible: visible('.orbit-hint'),
    controlsVisible: visible('.orbit-controls'),
    state: window.__mutinePortraitV035.getState()
  };
});
await blindPage.screenshot({ path: `${proofDir}/blind-390x844-reduced.png`, fullPage: false });
await blindContext.close();

const { context: canonicalContext, page: canonicalPage } = await openPage('/works/portrait-2026-10-27/', { width: 390, height: 844 }, true, false);
const canonical = await canonicalPage.evaluate(() => ({
  title: document.title,
  mount: Boolean(document.querySelector('[data-catalog-work-detail="portrait-2026-10-27"]')),
  text: document.body.innerText.includes('The portrait audits the empty centre.'),
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth
}));
await canonicalPage.screenshot({ path: `${proofDir}/canonical-390x844-reduced.png`, fullPage: true });
await canonicalContext.close();

await browser.close();
const payload = {
  runs,
  interaction: {
    geometryNeutralObservation: interaction.baseline === afterObserve.signature,
    attentionChanged: afterObserve.attention.some((value) => value > 0),
    auditChangedGeometry: afterAudit.signature !== interaction.baseline,
    auditMemory: afterAudit.state.memory.length,
    liftedExact: afterLift.signature === interaction.baseline,
    keyboardCommitted: afterKeyboard.state.memory.length === 1,
    keyboardRevision: afterKeyboard.state.revision
  },
  blind,
  canonical,
  diagnostics
};
console.log(JSON.stringify(payload, null, 2));
if (!payload.runs.every(({ result }) => result.innerWidth === result.clientWidth && result.scrollWidth <= result.innerWidth && result.nodeCount === 12 && result.visibleNodes === 12 && result.touchTargets.every((target) => target.height >= 44))) process.exitCode = 1;
if (!payload.interaction.geometryNeutralObservation || !payload.interaction.attentionChanged || !payload.interaction.auditChangedGeometry || !payload.interaction.liftedExact || !payload.interaction.keyboardCommitted) process.exitCode = 1;
if (!(blind.nodeCount === 12 && blind.visibleNodes === 12 && !blind.readoutVisible && !blind.hintVisible && !blind.controlsVisible && blind.scrollWidth <= blind.innerWidth)) process.exitCode = 1;
if (!(canonical.mount && canonical.text && canonical.scrollWidth <= canonical.clientWidth)) process.exitCode = 1;
