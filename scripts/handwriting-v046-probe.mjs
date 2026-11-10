import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_BASE ?? 'http://127.0.0.1:4177';
const proofDir = new URL(process.env.MUTINE_PROOF_DIR ?? '../research/qa/proofs/handwriting-v046-2026-11-10-local/', import.meta.url);
const chrome = process.env.MUTINE_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const modes = ['normal', 'reduced'];
const routes = {
  raw: '/studies/handwriting/v046/?preview=1&interaction=1',
  canonical: '/works/typography-2026-11-10/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const results = [];
let interactionEvidence;
let blindEvidence;

function nodeRect(node) {
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
}

async function runMatrix(kind, route, mode, viewport) {
  const [width, height] = viewport;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
  const diagnostics = [];
  const badResponses = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()}:${response.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    if (location.pathname.includes('/studies/')) return Boolean(document.querySelector('#counterform-field')) && Boolean(window._mutineReady);
    return Boolean(document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#counterform-field'));
  });
  await page.waitForTimeout(80);
  const evidence = await page.evaluate(() => {
    const nodeRect = (node) => {
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const frame = document.querySelector('.work-inspect__stage iframe');
    const artworkDocument = frame?.contentDocument ?? document;
    const field = artworkDocument.querySelector('#counterform-field');
    const tokens = [...artworkDocument.querySelectorAll('.counterform-token')];
    const voids = [...artworkDocument.querySelectorAll('.counterform-void')];
    const controls = [...artworkDocument.querySelectorAll('.counterform-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: nodeRect(field),
      tokenCount: tokens.length,
      visibleTokens: tokens.filter((token) => token.getBoundingClientRect().width > 0).length,
      voidCount: voids.length,
      controls: controls.map(nodeRect),
      title: document.querySelector('h1')?.textContent?.trim() ?? null,
      tableauFirst: Boolean(frame && frame.getBoundingClientRect().top < (document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top ?? Infinity)),
      ready: Boolean(artworkDocument.defaultView?._mutineReady),
      iframeSrc: frame?.getAttribute('src') ?? null
    };
  });
  await page.screenshot({ path: fileURLToPath(new URL(`${kind}-${mode}-${width}x${height}.png`, proofDir)), fullPage: true });
  results.push({ kind, mode, viewport: `${width}x${height}`, status: response?.status() ?? null, diagnostics: diagnostics.length, badResponses, overflow: evidence.scrollWidth > evidence.clientWidth, evidence });
  await context.close();
}

for (const mode of modes) {
  for (const viewport of viewports) {
    await runMatrix('raw', routes.raw + `&motion=${mode}`, mode, viewport);
    await runMatrix('canonical', routes.canonical, mode, viewport);
  }
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = [];
  const badResponses = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()}:${response.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const token = (id) => page.locator(`[data-token-id="${id}"]`);
  const first = await token(1).boundingBox();
  const last = await token(4).boundingBox();
  const cut = await page.locator('[data-action="cut"]').boundingBox();
  const quietSignature = await page.evaluate(() => window.__mutineHandwritingV046.geometrySignature());
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => ({ pending: window.__mutineHandwritingV046.getState().pending, signature: window.__mutineHandwritingV046.geometrySignature() }));
  await page.locator('[data-action="cut"]').click();
  const afterPointerCut = await page.evaluate(() => ({ memory: window.__mutineHandwritingV046.getState().memory.length, voids: window.__mutineHandwritingV046.getState().field.voids.length }));
  await page.evaluate(() => window.__mutineHandwritingV046.selectRange({ start: 4, end: 7 }));
  const afterOverlap = await page.evaluate(() => ({ memory: window.__mutineHandwritingV046.getState().memory.length, pending: window.__mutineHandwritingV046.getState().pending, lastEvent: window.__mutineHandwritingV046.getState().lastEvent }));
  await page.evaluate(() => window.__mutineHandwritingV046.release());
  const afterRelease = await page.evaluate(() => window.__mutineHandwritingV046.getState().memory.length);
  interactionEvidence = {
    diagnostics,
    badResponses,
    quietSignature,
    afterDrag,
    dragGeometryUnchanged: afterDrag.signature === quietSignature,
    afterPointerCut,
    afterOverlap,
    afterRelease,
    innerWidth: await page.evaluate(() => window.innerWidth),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth)
  };
  await page.screenshot({ path: fileURLToPath(new URL('interaction-pointer-390x844.png', proofDir)), fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = [];
  const badResponses = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()}:${response.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  await page.locator('[data-token-id="7"]').tap();
  await page.locator('[data-action="cut"]').tap();
  const afterTouch = await page.evaluate(() => ({ memory: window.__mutineHandwritingV046.getState().memory.length, voids: window.__mutineHandwritingV046.getState().field.voids.length }));
  const field = page.locator('#counterform-field');
  await field.focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => ({ memory: window.__mutineHandwritingV046.getState().memory.length, pending: window.__mutineHandwritingV046.getState().pending }));
  await page.keyboard.press('Delete');
  const afterDelete = await page.evaluate(() => window.__mutineHandwritingV046.getState().memory.length);
  await page.evaluate(() => { for (let index = 0; index < 4; index += 1) window.__mutineHandwritingV046.cutDeterministic(); });
  const afterFour = await page.evaluate(() => ({ memory: window.__mutineHandwritingV046.getState().memory.length, voids: window.__mutineHandwritingV046.getState().field.voids.length }));
  interactionEvidence = { ...interactionEvidence, touchDiagnostics: diagnostics, touchBadResponses: badResponses, afterTouch, afterKeyboard, afterDelete, afterFour };
  await page.screenshot({ path: fileURLToPath(new URL('interaction-touch-keyboard-390x844.png', proofDir)), fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = [];
  const badResponses = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()}:${response.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const blind = await page.evaluate(() => {
    const field = document.querySelector('#counterform-field');
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV046.getState();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && field.getBoundingClientRect().width > 0),
      tokenCount: document.querySelectorAll('.counterform-token').length,
      voidCount: document.querySelectorAll('.counterform-void').length,
      controlsHidden: hidden('.counterform-controls'),
      readoutHidden: hidden('.counterform-readout'),
      hintHidden: hidden('.counterform-hint'),
      memory: state.memory.length,
      layout: state.field.layout
    };
  });
  blindEvidence = { diagnostics, badResponses, ...blind };
  await page.screenshot({ path: fileURLToPath(new URL('blind-static-390x844.png', proofDir)), fullPage: true });
  await context.close();
}

await browser.close();
const report = {
  base,
  routeCount: Object.keys(routes).length,
  matrixCount: results.length,
  matrixPassed: results.every((entry) => entry.status === 200 && entry.diagnostics === 0 && entry.badResponses.length === 0 && !entry.overflow && entry.evidence.field?.width > 0 && entry.evidence.tokenCount === 24 && (entry.kind !== 'raw' || entry.evidence.ready)),
  minControlHeight: Math.min(...results.flatMap((entry) => entry.evidence.controls.map((control) => control.height)).filter(Boolean)),
  results,
  interactionEvidence,
  blindEvidence,
  proofDir: fileURLToPath(proofDir)
};
await writeFile(new URL('report.json', proofDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ matrixCount: report.matrixCount, matrixPassed: report.matrixPassed, minControlHeight: report.minControlHeight, interactionEvidence, blindEvidence, proofDir: report.proofDir }, null, 2));
if (!report.matrixPassed || report.minControlHeight < 44 || interactionEvidence.badResponses.length > 0 || interactionEvidence.touchBadResponses.length > 0 || interactionEvidence.afterDrag.pending === null || !interactionEvidence.dragGeometryUnchanged || interactionEvidence.afterPointerCut.memory !== 1 || interactionEvidence.afterPointerCut.voids !== 1 || interactionEvidence.afterOverlap.memory !== 1 || interactionEvidence.afterOverlap.pending !== null || interactionEvidence.afterRelease !== 0 || interactionEvidence.afterTouch.memory !== 1 || interactionEvidence.afterKeyboard.memory !== 1 || interactionEvidence.afterDelete !== 0 || interactionEvidence.afterFour.memory !== 4 || interactionEvidence.afterFour.voids !== 4 || blindEvidence.badResponses.length > 0 || blindEvidence.controlsHidden !== true || blindEvidence.readoutHidden !== true || blindEvidence.hintHidden !== true || blindEvidence.fieldVisible !== true || blindEvidence.tokenCount !== 24 || blindEvidence.voidCount !== 4 || blindEvidence.memory !== 4 || blindEvidence.layout !== 'counterform-reflow' || blindEvidence.scrollWidth > blindEvidence.clientWidth) process.exitCode = 1;
