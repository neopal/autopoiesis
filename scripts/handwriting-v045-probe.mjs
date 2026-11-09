import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_BASE ?? 'http://127.0.0.1:4177';
const proofDir = new URL(process.env.MUTINE_PROOF_DIR ?? '../research/qa/proofs/handwriting-v045-2026-11-09-local/', import.meta.url);
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const modes = ['normal', 'reduced'];
const routes = {
  raw: '/studies/handwriting/v045/?preview=1&interaction=1',
  canonical: '/works/typography-2026-11-09/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
let interactionEvidence;
let blindEvidence;

function rect(node) {
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
  page.on('response', (responseEntry) => { if (responseEntry.status() >= 400) badResponses.push(`${responseEntry.status()}:${responseEntry.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    if (location.pathname.includes('/studies/')) return Boolean(document.querySelector('#attendance-field')) && Boolean(window._mutineReady);
    const frame = document.querySelector('.work-inspect__stage iframe');
    return Boolean(frame?.contentDocument?.querySelector('#attendance-field'));
  });
  await page.waitForTimeout(80);
  const evidence = await page.evaluate(() => {
    const frame = document.querySelector('.work-inspect__stage iframe');
    const artworkDocument = frame?.contentDocument ?? document;
    const field = artworkDocument.querySelector('#attendance-field');
    const canvas = artworkDocument.querySelector('#attendance-canvas');
    const controls = [...artworkDocument.querySelectorAll('.attendance-controls button')];
    const nodeRect = (node) => node ? (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; })() : null;
    const artworkReady = Boolean(artworkDocument.defaultView?._mutineReady);
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: nodeRect(field),
      canvas: nodeRect(canvas),
      controls: controls.map(nodeRect),
      title: document.querySelector('h1')?.textContent?.trim() ?? null,
      tableauFirst: Boolean(frame && frame.getBoundingClientRect().top < (document.querySelector('.work-inspect__heading')?.getBoundingClientRect().top ?? Infinity)),
      ready: artworkReady,
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
  page.on('response', (responseEntry) => { if (responseEntry.status() >= 400) badResponses.push(`${responseEntry.status()}:${responseEntry.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const box = await page.locator('#attendance-field').boundingBox();
  const point = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const tapPoints = [point(.18, .30), point(.39, .52), point(.78, .74)];
  const quietSignature = await page.evaluate(() => window.__mutineHandwritingV045.geometrySignature());
  await page.touchscreen.tap(tapPoints[0].x, tapPoints[0].y);
  await page.touchscreen.tap(tapPoints[1].x, tapPoints[1].y);
  await page.touchscreen.tap(tapPoints[2].x, tapPoints[2].y);
  const afterTouch = await page.evaluate(() => ({ memory: window.__mutineHandwritingV045.getState().memory.length, pending: window.__mutineHandwritingV045.getState().pending.length, signature: window.__mutineHandwritingV045.geometrySignature() }));
  await page.evaluate(() => window.__mutineHandwritingV045.release());
  const beforePending = await page.evaluate(() => window.__mutineHandwritingV045.geometrySignature());
  await page.evaluate(() => window.__mutineHandwritingV045.attend(4));
  const afterPending = await page.evaluate(() => ({ signature: window.__mutineHandwritingV045.geometrySignature(), pending: window.__mutineHandwritingV045.getState().pending.length, memory: window.__mutineHandwritingV045.getState().memory.length }));
  await page.evaluate(() => window.__mutineHandwritingV045.attend(4));
  const afterRepeat = await page.evaluate(() => ({ pending: window.__mutineHandwritingV045.getState().pending.length, memory: window.__mutineHandwritingV045.getState().memory.length }));
  await page.evaluate(() => window.__mutineHandwritingV045.release());
  const field = page.locator('#attendance-field');
  await field.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const afterKeyboard = await page.evaluate(() => ({ memory: window.__mutineHandwritingV045.getState().memory.length, pending: window.__mutineHandwritingV045.getState().pending.length }));
  await page.keyboard.press('Delete');
  const afterDelete = await page.evaluate(() => window.__mutineHandwritingV045.getState().memory.length);
  await page.keyboard.press('Escape');
  const afterEscape = await page.evaluate(() => window.__mutineHandwritingV045.getState().memory.length);
  await page.evaluate(() => { for (let index = 0; index < 4; index += 1) window.__mutineHandwritingV045.assembleDeterministic(); });
  const afterFour = await page.evaluate(() => window.__mutineHandwritingV045.getState().memory.length);
  interactionEvidence = {
    diagnostics,
    badResponses,
    quietSignature,
    afterTouch,
    pendingGeometryUnchanged: beforePending === afterPending.signature,
    afterRepeat,
    afterKeyboard,
    afterDelete,
    afterEscape,
    afterFour,
    innerWidth: await page.evaluate(() => window.innerWidth),
    clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
    scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth)
  };
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
  page.on('response', (responseEntry) => { if (responseEntry.status() >= 400) badResponses.push(`${responseEntry.status()}:${responseEntry.url()}`); });
  page.on('requestfailed', (request) => badResponses.push(`failed:${request.url()}`));
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const blind = await page.evaluate(() => {
    const field = document.querySelector('#attendance-field');
    const canvas = document.querySelector('#attendance-canvas');
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0),
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      controlsHidden: hidden('.attendance-controls'),
      readoutHidden: hidden('.attendance-readout'),
      hintHidden: hidden('.attendance-hint'),
      memory: window.__mutineHandwritingV045.getState().memory.length,
      layout: window.__mutineHandwritingV045.getState().field.layout
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
  matrixPassed: results.every((entry) => entry.status === 200 && entry.diagnostics === 0 && entry.badResponses.length === 0 && !entry.overflow && entry.evidence.canvas?.width > 0 && (entry.kind !== 'raw' || entry.evidence.ready)),
  minControlHeight: Math.min(...results.flatMap((entry) => entry.evidence.controls.map((control) => control.height)).filter(Boolean)),
  results,
  interactionEvidence,
  blindEvidence,
  proofDir: fileURLToPath(proofDir)
};
await writeFile(new URL('report.json', proofDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ matrixCount: report.matrixCount, matrixPassed: report.matrixPassed, minControlHeight: report.minControlHeight, interactionEvidence, blindEvidence, proofDir: report.proofDir }, null, 2));
if (!report.matrixPassed || report.minControlHeight < 44 || interactionEvidence.badResponses.length > 0 || interactionEvidence.afterTouch.memory !== 1 || interactionEvidence.afterTouch.pending !== 0 || !interactionEvidence.pendingGeometryUnchanged || interactionEvidence.afterRepeat.pending !== 1 || interactionEvidence.afterRepeat.memory !== 0 || interactionEvidence.afterKeyboard.memory !== 1 || interactionEvidence.afterDelete !== 0 || interactionEvidence.afterEscape !== 0 || interactionEvidence.afterFour !== 4 || blindEvidence.badResponses.length > 0 || blindEvidence.controlsHidden !== true || blindEvidence.readoutHidden !== true || blindEvidence.hintHidden !== true || blindEvidence.canvasVisible !== true || blindEvidence.memory !== 4 || blindEvidence.layout !== 'collective-axis' || blindEvidence.scrollWidth > blindEvidence.clientWidth) process.exitCode = 1;
