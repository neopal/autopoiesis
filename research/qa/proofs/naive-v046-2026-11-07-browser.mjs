import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.BASE_URL || 'http://127.0.0.1:41760';
const proofRoot = path.resolve('research/qa/proofs/naive-v046-2026-11-07-local');
const viewports = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1920, 1080]
];
const modes = [
  ['normal', 'no-preference'],
  ['reduced-motion', 'reduce']
];
const rawPath = '/studies/naive-art/v046/?preview=1&interaction=1';
const blindPath = '/studies/naive-art/v046/?preview=1&static=1&blind=1';
const canonicalPath = '/works/naive-2026-11-07/';

await mkdir(proofRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

async function waitReady(page) {
  await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
  await page.waitForTimeout(180);
}

function recordErrors(page) {
  const diagnostics = [];
  const responses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) responses.push(`${response.status()} ${response.url()}`);
  });
  return { diagnostics, responses };
}

async function measure(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#echo-field');
    const controls = [...document.querySelectorAll('button')];
    const rect = field?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      canvas: Boolean(document.querySelector('canvas')),
      canvasSize: document.querySelector('canvas') ? { width: document.querySelector('canvas').width, height: document.querySelector('canvas').height } : null,
      controls: controls.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height, width: button.getBoundingClientRect().width })),
      ready: window._p5Ready === true,
      memory: window.__mutineNaiveV046?.getState().memory.length ?? null,
      grammar: window.__mutineNaiveV046?.getState().grammar ?? null
    };
  });
}

async function interact(page, viewport) {
  const interaction = await page.evaluate(() => {
    const api = window.__mutineNaiveV046;
    const field = document.querySelector('#echo-field');
    const rect = field.getBoundingClientRect();
    const throat = api.getState().body.throats[0];
    const scale = Math.min(rect.width, rect.height) * 0.38;
    return { x: rect.left + rect.width / 2 + throat.x * scale, y: rect.top + rect.height / 2 + throat.y * scale };
  });
  await page.mouse.move(interaction.x, interaction.y);
  await page.mouse.down();
  await page.waitForTimeout(820);
  await page.mouse.up();
  const afterPointer = await page.evaluate(() => ({ memory: window.__mutineNaiveV046.getState().memory.length, interaction: window.__mutineNaiveV046.getState().interaction }));
  const field = page.locator('#echo-field');
  await field.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const afterKeyboard = await page.evaluate(() => ({ memory: window.__mutineNaiveV046.getState().memory.length, interaction: window.__mutineNaiveV046.getState().interaction }));
  await page.keyboard.press('Delete');
  const afterLift = await page.evaluate(() => ({ memory: window.__mutineNaiveV046.getState().memory.length, interaction: window.__mutineNaiveV046.getState().interaction }));
  await page.keyboard.press('Escape');
  const afterRelease = await page.evaluate(() => ({ memory: window.__mutineNaiveV046.getState().memory.length, interaction: window.__mutineNaiveV046.getState().interaction }));
  const screenshot = path.join(proofRoot, `raw-${viewport[0]}x${viewport[1]}-normal-interaction.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  return { pointer: afterPointer, keyboard: afterKeyboard, lift: afterLift, release: afterRelease, screenshot };
}

for (const [mode, reducedMotion] of modes) {
  for (const viewport of viewports) {
    const [width, height] = viewport;
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
    const events = recordErrors(page);
    await page.goto(`${base}${rawPath}`, { waitUntil: 'networkidle' });
    await waitReady(page);
    const metrics = await measure(page);
    const screenshot = path.join(proofRoot, `raw-${width}x${height}-${mode}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    let interaction = null;
    if (mode === 'normal' && width === 390) interaction = await interact(page, viewport);
    results.push({ route: 'raw', mode, viewport: `${width}x${height}`, metrics, interaction, diagnostics: events.diagnostics, responses: events.responses, screenshot });
    await page.close();
  }
}

for (const [mode, reducedMotion] of modes) {
  for (const viewport of viewports) {
    const [width, height] = viewport;
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
    const events = recordErrors(page);
    await page.goto(`${base}${canonicalPath}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
    const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v046/'));
    if (!frame) throw new Error(`canonical tableau iframe missing at ${width}x${height} ${mode}`);
    await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 15000 });
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.querySelector('h1')?.textContent.trim(),
      tableauTop: document.querySelector('.work-inspect__stage')?.getBoundingClientRect().top,
      frameTop: document.querySelector('iframe')?.getBoundingClientRect().top
    }));
    const screenshot = path.join(proofRoot, `canonical-${width}x${height}-${mode}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    results.push({ route: 'canonical', mode, viewport: `${width}x${height}`, metrics, diagnostics: events.diagnostics, responses: events.responses, screenshot });
    await page.close();
  }
}

for (const [mode, reducedMotion] of modes) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion });
  const events = recordErrors(page);
  await page.goto(`${base}${blindPath}`, { waitUntil: 'networkidle' });
  await waitReady(page);
  const metrics = await measure(page);
  const screenshot = path.join(proofRoot, `blind-390x844-${mode}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ route: 'blind', mode, viewport: '390x844', metrics, diagnostics: events.diagnostics, responses: events.responses, screenshot });
  await page.close();
}

await browser.close();
const summary = {
  routeRuns: results.length,
  diagnostics: results.reduce((count, item) => count + item.diagnostics.length, 0),
  responseFailures: results.reduce((count, item) => count + item.responses.length, 0),
  overflow: results.filter((item) => item.metrics.scrollWidth > item.metrics.innerWidth).length,
  invalidWidths: results.filter((item) => item.metrics.innerWidth !== Number(item.viewport.split('x')[0])).length,
  minTouchTarget: Math.min(...results.flatMap((item) => item.metrics.controls ?? []).map((control) => Math.min(control.height, control.width)).filter((size) => Number.isFinite(size) && size > 0)),
  results
};
await writeFile(path.join(proofRoot, 'browser-evidence.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ routeRuns: summary.routeRuns, diagnostics: summary.diagnostics, responseFailures: summary.responseFailures, overflow: summary.overflow, invalidWidths: summary.invalidWidths, minTouchTarget: summary.minTouchTarget, interaction: results.find((item) => item.interaction)?.interaction }, null, 2));
if (summary.diagnostics || summary.responseFailures || summary.overflow || summary.invalidWidths || summary.minTouchTarget < 44) process.exitCode = 1;
