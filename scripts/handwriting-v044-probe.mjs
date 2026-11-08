import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_BASE ?? 'http://127.0.0.1:4177';
const proofDir = new URL(process.env.MUTINE_PROOF_DIR ?? '../research/qa/proofs/handwriting-v044-2026-11-08-local/', import.meta.url);
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const modes = ['normal', 'reduced'];
const routes = {
  raw: '/studies/handwriting/v044/?preview=1&interaction=1',
  canonical: '/works/typography-2026-11-08/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.MUTINE_CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
let interactionEvidence;
let blindEvidence;

async function runMatrix(kind, route, mode, viewport) {
  const [width, height] = viewport;
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
  const diagnostics = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(80);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#carrier-field');
    const canvas = document.querySelector('#carrier-canvas');
    const controls = [...document.querySelectorAll('.carrier-controls button')];
    const rect = (node) => node ? (() => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; })() : null;
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: rect(field),
      canvas: rect(canvas),
      controls: controls.map(rect),
      title: document.querySelector('h1')?.textContent?.trim() ?? null,
      ready: Boolean(window._mutineReady)
    };
  });
  await page.screenshot({ path: fileURLToPath(new URL(`${kind}-${mode}-${width}x${height}.png`, proofDir)), fullPage: true });
  results.push({ kind, mode, viewport: `${width}x${height}`, status: response?.status() ?? null, diagnostics: diagnostics.length, overflow: evidence.scrollWidth > evidence.clientWidth, evidence });
  await context.close();
}

for (const mode of modes) {
  for (const viewport of viewports) {
    await runMatrix('raw', routes.raw + `&motion=${mode}`, mode, viewport);
    await runMatrix('canonical', routes.canonical, mode, viewport);
  }
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  await page.goto(`${base}${routes.raw}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const field = page.locator('#carrier-field');
  const box = await field.boundingBox();
  const y = box.y + box.height * .835;
  const xs = [box.x + box.width * .17, box.x + box.width * .5, box.x + box.width * .83];
  await page.mouse.move(xs[0], y);
  await page.mouse.down();
  await page.mouse.move(xs[1], y, { steps: 3 });
  await page.mouse.move(xs[2], y, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(60);
  const afterPointer = await page.evaluate(() => ({ memory: window.__mutineHandwritingV044.getState().memory.length, pending: window.__mutineHandwritingV044.getState().pending.length, signature: window.__mutineHandwritingV044.geometrySignature() }));
  await field.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(30);
  const afterKeyboard = await page.evaluate(() => ({ memory: window.__mutineHandwritingV044.getState().memory.length, pending: window.__mutineHandwritingV044.getState().pending.length }));
  await page.keyboard.press('Delete');
  const afterDelete = await page.evaluate(() => window.__mutineHandwritingV044.getState().memory.length);
  await page.keyboard.press('Escape');
  const afterEscape = await page.evaluate(() => window.__mutineHandwritingV044.getState().memory.length);
  interactionEvidence = { diagnostics, afterPointer, afterKeyboard, afterDelete, afterEscape, innerWidth: await page.evaluate(() => window.innerWidth), scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) };
  await page.screenshot({ path: fileURLToPath(new URL('interaction-390x844.png', proofDir)), fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const diagnostics = [];
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`); });
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  await page.goto(`${base}${routes.raw}&static=1&blind=1`, { waitUntil: 'networkidle' });
  const blind = await page.evaluate(() => {
    const field = document.querySelector('#carrier-field');
    const canvas = document.querySelector('#carrier-canvas');
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvasVisible: Boolean(canvas && canvas.getBoundingClientRect().width > 0),
      fieldHeight: field?.getBoundingClientRect().height ?? 0,
      controlsHidden: hidden('.carrier-controls'),
      readoutHidden: hidden('.carrier-readout'),
      hintHidden: hidden('.carrier-hint')
    };
  });
  blindEvidence = { diagnostics, ...blind };
  await page.screenshot({ path: fileURLToPath(new URL('blind-static-390x844.png', proofDir)), fullPage: true });
  await context.close();
}

await browser.close();
const report = {
  base,
  routeCount: Object.keys(routes).length,
  matrixCount: results.length,
  matrixPassed: results.every((entry) => entry.status === 200 && entry.diagnostics === 0 && !entry.overflow && (entry.kind !== 'raw' || entry.evidence.ready)),
  minControlHeight: Math.min(...results.flatMap((entry) => entry.evidence.controls.map((control) => control.height)).filter(Boolean)),
  results,
  interactionEvidence,
  blindEvidence,
  proofDir: fileURLToPath(proofDir)
};
await writeFile(new URL('report.json', proofDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ matrixCount: report.matrixCount, matrixPassed: report.matrixPassed, minControlHeight: report.minControlHeight, interactionEvidence, blindEvidence, proofDir: report.proofDir }, null, 2));
if (!report.matrixPassed || report.minControlHeight < 44 || interactionEvidence.afterPointer.memory !== 1 || interactionEvidence.afterKeyboard.memory !== 2 || interactionEvidence.afterDelete !== 1 || interactionEvidence.afterEscape !== 0 || blindEvidence.controlsHidden !== true || blindEvidence.readoutHidden !== true || blindEvidence.hintHidden !== true || blindEvidence.canvasVisible !== true || blindEvidence.scrollWidth > blindEvidence.clientWidth) process.exitCode = 1;
