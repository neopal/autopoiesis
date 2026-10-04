import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = resolve('C:/Users/ASUS/autopoiesis');
const port = 4225;
const proofDir = resolve(ROOT, 'research/qa/proofs/webgpu-v022-2026-10-04');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/webgpu/v022/?preview=1&interaction=1',
  canonical: '/works/webgpu-2026-10-04/'
};

await mkdir(proofDir, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const candidate = resolve(ROOT, relative);
    if (!(candidate === ROOT || candidate.startsWith(ROOT + '\\') || candidate.startsWith(ROOT + '/'))) {
      response.writeHead(403); response.end('forbidden'); return;
    }
    let file = candidate;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    } catch {
      response.writeHead(404); response.end('not found'); return;
    }
    response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(500); response.end('server error');
  }
});

const rect = (node) => {
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
};

function attachDiagnostics(page) {
  const diagnostics = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => diagnostics.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => diagnostics.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

async function waitForTableau(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineWebGPUV022));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineWebGPUV022));
  return page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/studies/webgpu/v022/'));
}

async function measure(page, frame, canonical, viewport, reduced, route) {
  const shell = await page.evaluate(({ isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      iframe: iframe ? { top: iframe.getBoundingClientRect().top, width: iframe.getBoundingClientRect().width, height: iframe.getBoundingClientRect().height } : null,
      heading: heading ? { top: heading.getBoundingClientRect().top, width: heading.getBoundingClientRect().width } : null
    };
  }, { isCanonical: canonical });
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#field');
    const frame = document.querySelector('.weather-frame');
    const controls = [...document.querySelectorAll('.weather-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fieldVisible: Boolean(field && getComputedStyle(field).display !== 'none'),
      field: field ? { left: field.getBoundingClientRect().left, top: field.getBoundingClientRect().top, width: field.getBoundingClientRect().width, height: field.getBoundingClientRect().height } : null,
      frame: frame ? { width: frame.getBoundingClientRect().width, height: frame.getBoundingClientRect().height } : null,
      controls: controls.map((node) => ({ height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width, visible: getComputedStyle(node).display !== 'none' })),
      readoutVisible: getComputedStyle(document.querySelector('.weather-readout')).display !== 'none',
      statusVisible: getComputedStyle(document.querySelector('.weather-status')).display !== 'none',
      state: window.__mutineWebGPUV022?.getState?.() ?? null
    };
  });
  const screenshot = resolve(proofDir, `${canonical ? 'canonical' : 'raw'}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  return { route, viewport: `${viewport[0]}x${viewport[1]}`, reduced, shell, tableau, screenshot };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

for (const [label, route] of Object.entries(routes)) {
  for (const viewport of viewports) {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const diagnostics = attachDiagnostics(page);
      const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(reduced ? 120 : 180);
      const frame = await waitForTableau(page, label === 'canonical');
      const evidence = await measure(page, frame, label === 'canonical', viewport, reduced, route);
      results.push({ label, httpStatus: response?.status() ?? null, diagnostics, evidence });
      await context.close();
    }
  }
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
const interactionPage = await interactionContext.newPage();
const interactionDiagnostics = attachDiagnostics(interactionPage);
await interactionPage.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
await waitForTableau(interactionPage, false);
const state = () => interactionPage.evaluate(() => window.__mutineWebGPUV022.getState());
const initial = await state();
const box = await interactionPage.locator('#field').boundingBox();
assert.ok(box);
await interactionPage.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
const afterTap = await state();
await interactionPage.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.78);
await interactionPage.mouse.down();
await interactionPage.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.22, { steps: 8 });
await interactionPage.mouse.up();
const afterDrag = await state();
const afterDragSignature = afterDrag.signature;
await interactionPage.locator('#field').focus();
await interactionPage.keyboard.press('Delete');
const afterDelete = await state();
await interactionPage.keyboard.press('Enter');
const afterEnter = await state();
await interactionPage.keyboard.press('r');
const afterRelease = await state();
await interactionPage.getByRole('button', { name: 'release a sweep' }).click();
const afterButton = await state();
await interactionPage.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: false });

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
const blindDiagnostics = attachDiagnostics(blindPage);
const blindResponse = await blindPage.goto(`http://127.0.0.1:${port}/studies/webgpu/v022/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitForTableau(blindPage, false);
const blind = await blindPage.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  fieldVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
  readoutVisible: getComputedStyle(document.querySelector('.weather-readout')).display !== 'none',
  controlsVisible: getComputedStyle(document.querySelector('.weather-controls')).display !== 'none',
  state: window.__mutineWebGPUV022.getState()
}));
await blindPage.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: false });

const readback = async (path, marker) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diagnostics = attachDiagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, anchor: Boolean(document.querySelector('#journal-webgpu-2026-10-04, [data-work-id="webgpu-2026-10-04"]')) }));
  await page.close();
  return { evidence, diagnostics };
};
const journal = await readback('/journal/', '#journal-webgpu-2026-10-04');
const current = await readback('/currents/webgpu/', '[data-catalog-current="webgpu"] [data-work-id="webgpu-2026-10-04"]');

assert.equal(afterTap.memory, initial.memory, 'a short pointer tap must be refused');
assert.equal(afterDrag.memory, initial.memory + 1, 'a real drag must commit one sweep');
assert.notEqual(afterDrag.signature, initial.signature, 'a sweep must change field geometry');
assert.equal(afterDelete.memory, initial.memory, 'Delete must lift the latest sweep');
assert.equal(afterDelete.signature, initial.signature, 'Delete must restore the exact preceding field');
assert.equal(afterEnter.memory, initial.memory + 1, 'Enter must commit one sweep');
assert.equal(afterRelease.memory, 0, 'R must release the weather');
assert.equal(afterButton.memory, 1, 'the sweep control must commit one structural event');
assert.equal(blind.fieldVisible, true);
assert.equal(blind.readoutVisible, false);
assert.equal(blind.controlsVisible, false);

const overflowFailures = results.filter(({ evidence }) => evidence.shell.innerWidth !== Number(evidence.viewport.split('x')[0]) || evidence.shell.scrollWidth > evidence.shell.innerWidth || evidence.tableau.scrollWidth > evidence.tableau.innerWidth || evidence.tableau.controls.some((control) => control.visible && control.height < 44));
const diagnostics = [...results.map((entry) => entry.diagnostics), interactionDiagnostics, blindDiagnostics, journal.diagnostics, current.diagnostics];
const diagnosticFailures = diagnostics.filter((entry) => entry.consoleMessages.length || entry.pageErrors.length || entry.failedRequests.length || entry.badResponses.length);
const output = {
  status: 'local-headless-browser-probe',
  root: `http://127.0.0.1:${port}`,
  routes,
  viewportRuns: results,
  interaction: { initial, afterTap, afterDrag, afterDelete, afterEnter, afterRelease, afterButton, restoredSignature: afterDelete.signature, dragSignature: afterDragSignature, diagnostics: interactionDiagnostics },
  blind: { httpStatus: blindResponse?.status() ?? null, evidence: blind, diagnostics: blindDiagnostics },
  journal,
  current,
  counts: { viewportRuns: results.length, overflowFailures: overflowFailures.length, diagnosticRuns: diagnosticFailures.length, nonEmptyScreenshots: results.length + 2 }
};
await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(output, null, 2));
await blindContext.close();
await interactionContext.close();
await browser.close();
await new Promise((resolveClose) => server.close(resolveClose));
console.log(JSON.stringify({ status: output.status, counts: output.counts, interaction: { initialMemory: initial.memory, afterTapMemory: afterTap.memory, afterDragMemory: afterDrag.memory, afterDeleteMemory: afterDelete.memory, afterEnterMemory: afterEnter.memory, afterReleaseMemory: afterRelease.memory, afterButtonMemory: afterButton.memory }, blind, journal: journal.evidence, current: current.evidence }, null, 2));
if (overflowFailures.length || diagnosticFailures.length || blindResponse?.status() >= 400 || !journal.evidence.anchor || !current.evidence.anchor) process.exitCode = 1;
