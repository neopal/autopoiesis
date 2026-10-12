import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = dirname(fileURLToPath(import.meta.url));
const repo = join(ROOT, '..');
const localMode = !process.argv[2] || process.argv[2] === 'local';
const requestedBase = localMode ? null : process.argv[2].replace(/\/$/, '');
const proofDir = join(repo, 'research/qa/proofs', `naive-v029-2026-10-12${localMode ? '' : '-production'}`);
const rawPath = '/studies/naive-art/v029/';
const canonicalPath = '/works/naive-2026-10-12/';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = normalize(join(repo, decoded.replace(/^\/+/, '')));
  const root = normalize(repo);
  return candidate === root || candidate.startsWith(`${root}\\`) || candidate.startsWith(`${root}/`) ? candidate : null;
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = request.url?.split('?')[0] ?? '/';
      const candidate = safeFile(pathname);
      if (!candidate) { response.writeHead(403); response.end('forbidden'); return; }
      let file = candidate;
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      response.writeHead(200, { 'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404);
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function chromePath() {
  for (const candidate of [
    'C:/Users/ASUS/.agent-browser/browsers/chrome-155.0.8059.39/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
  ]) {
    try { await access(candidate); return candidate; } catch { /* try next installed browser */ }
  }
  return undefined;
}

function diagnostics(page) {
  const result = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
}

async function artworkFrame(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineNaiveV029));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV029));
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/naive-art/v029/'));
  assert.ok(frame, 'canonical v029 tableau iframe must load');
  return frame;
}

async function state(frame) {
  return frame.evaluate(() => window.__mutineNaiveV029.getState());
}

async function metrics(page, frame, targetViewport, canonical) {
  const outer = await page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      firstArtwork: document.querySelector('.artwork-frame')?.getBoundingClientRect().toJSON() ?? null,
      intro: document.querySelector('.work-opening')?.getBoundingClientRect().toJSON() ?? null,
      tableauFirst: !iframe || !heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top,
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    };
  });
  const embedded = await frame.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvas: document.querySelector('#junction-canvas')?.getBoundingClientRect().toJSON() ?? null,
    patches: window.__mutineNaiveV029.getState().scene.patches.length,
    changedPatches: window.__mutineNaiveV029.getState().scene.trace.changedPatchCount,
    controls: [...document.querySelectorAll('[data-gesture]')].map((button) => Math.round(button.getBoundingClientRect().height)),
    state: window.__mutineNaiveV029.getState()
  }));
  assert.equal(outer.innerWidth, targetViewport.width, 'emulated innerWidth must match target');
  assert.equal(outer.clientWidth, targetViewport.width, 'outer clientWidth must match target');
  if (!canonical) {
    assert.equal(embedded.innerWidth, targetViewport.width, 'raw tableau innerWidth must match target');
    assert.equal(embedded.clientWidth, targetViewport.width, 'raw tableau clientWidth must match target');
  } else {
    assert.ok(embedded.innerWidth <= targetViewport.width, 'embedded tableau must not exceed target');
    assert.ok(embedded.clientWidth <= targetViewport.width, 'embedded tableau client must not exceed target');
  }
  assert.ok(outer.scrollWidth <= targetViewport.width, `outer overflow at ${targetViewport.width}`);
  assert.ok(embedded.scrollWidth <= targetViewport.width, `tableau overflow at ${targetViewport.width}`);
  assert.equal(embedded.patches, 12);
  if (canonical) assert.equal(outer.tableauFirst, true, 'tableau must precede generated heading');
  return { outer, embedded };
}

async function matrixRun(browser, base) {
  const results = [];
  for (const route of [{ kind: 'raw', path: rawPath }, { kind: 'canonical', path: canonicalPath }]) {
    for (const viewport of viewports) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        const diag = diagnostics(page);
        const response = await page.goto(`${base}${route.path}?${route.kind === 'raw' ? 'preview=1&interaction=1' : 'matrix=1'}`, { waitUntil: 'networkidle' });
        const frame = await artworkFrame(page, route.kind === 'canonical');
        const measured = await metrics(page, frame, viewport, route.kind === 'canonical');
        const initial = await state(frame);
        const screenshot = join(proofDir, `${route.kind}-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        results.push({ kind: route.kind, viewport, reduced, status: response?.status() ?? null, initial: { stage: initial.stage, memory: initial.memory.length }, metrics: measured, diagnostics: diag, screenshot });
        await context.close();
      }
    }
  }
  return results;
}

async function interactionRun(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV029));
  const initial = await state(page);
  const canvas = page.locator('#junction-canvas');
  const box = await canvas.boundingBox();
  assert.ok(box, 'canvas must have a bounding box');
  const point = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const start = point(0.18, 0.23);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const armed = await state(page);
  assert.equal(armed.memory.length, initial.memory.length, 'pointerdown must arm without writing');
  for (const [x, y] of [[0.76, 0.22], [0.22, 0.53], [0.76, 0.50], [0.88, 0.76]]) {
    const next = point(x, y);
    await page.mouse.move(next.x, next.y, { steps: 5 });
  }
  await page.waitForTimeout(500);
  await page.mouse.up();
  const committed = await state(page);
  assert.equal(committed.memory.length, 1, 'real multi-crossing gesture must commit');
  assert.ok(committed.scene.trace.changedPatchCount >= 3);
  const firstSignature = committed.geometrySignature;

  const shortPoint = point(0.51, 0.48);
  await page.mouse.click(shortPoint.x, shortPoint.y);
  const refused = await state(page);
  assert.equal(refused.memory.length, 1, 'shallow click must not add memory');
  assert.equal(refused.interaction, 'gesture-refused-shallow');

  await page.locator('#junction-field').focus();
  await page.keyboard.press('Enter');
  const afterEnter = await state(page);
  assert.equal(afterEnter.memory.length, 2);
  const enterSignature = afterEnter.geometrySignature;
  await page.keyboard.press('Delete');
  const afterDelete = await state(page);
  assert.equal(afterDelete.memory.length, 1);
  assert.equal(afterDelete.geometrySignature, firstSignature, 'Delete must restore the exact preceding picture');
  await page.getByRole('button', { name: 'make the false join' }).click();
  const afterButton = await state(page);
  assert.equal(afterButton.memory.length, 2);
  assert.equal(afterButton.geometrySignature, enterSignature, 'button and Enter must share the deterministic event');
  await page.getByRole('button', { name: 'lift latest' }).click();
  const afterLift = await state(page);
  assert.equal(afterLift.memory.length, 1);
  await page.keyboard.press('r');
  const afterRelease = await state(page);
  assert.equal(afterRelease.memory.length, 0);
  const touchTargets = await page.evaluate(() => [...document.querySelectorAll('[data-gesture]')].map((button) => Math.round(button.getBoundingClientRect().height)));
  assert.ok(touchTargets.every((height) => height >= 44));
  const screenshot = join(proofDir, 'interaction-390x844.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { initial: { memory: initial.memory.length }, armed: { memory: armed.memory.length }, committed: { memory: committed.memory.length, changed: committed.scene.trace.changedPatchCount }, refused: { memory: refused.memory.length, interaction: refused.interaction }, afterEnter: { memory: afterEnter.memory.length }, afterDelete: { memory: afterDelete.memory.length }, afterButton: { memory: afterButton.memory.length }, afterLift: { memory: afterLift.memory.length }, afterRelease: { memory: afterRelease.memory.length }, touchTargets, diagnostics: diag, screenshot };
}

async function blindRun(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV029));
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    canvasVisible: getComputedStyle(document.querySelector('#junction-canvas')).display !== 'none',
    canvasWidth: document.querySelector('#junction-canvas')?.getBoundingClientRect().width ?? 0,
    readoutVisible: getComputedStyle(document.querySelector('.junction-readout')).display !== 'none',
    controlsVisible: getComputedStyle(document.querySelector('.junction-controls')).display !== 'none',
    hintVisible: getComputedStyle(document.querySelector('.junction-hint')).display !== 'none',
    state: window.__mutineNaiveV029.getState()
  }));
  assert.equal(response?.status(), 200);
  assert.equal(evidence.innerWidth, 390);
  assert.equal(evidence.clientWidth, 390);
  assert.ok(evidence.scrollWidth <= 390);
  assert.equal(evidence.canvasVisible, true);
  assert.ok(evidence.canvasWidth > 300);
  assert.equal(evidence.readoutVisible, false);
  assert.equal(evidence.controlsVisible, false);
  assert.equal(evidence.hintVisible, false);
  assert.equal(evidence.state.memory.length, 4);
  assert.ok(evidence.state.scene.trace.changedPatchCount >= 3);
  const screenshot = join(proofDir, 'blind-390x844-reduced.png');
  await page.screenshot({ path: screenshot, fullPage: false });
  await context.close();
  return { response: response?.status() ?? null, evidence, diagnostics: diag, screenshot };
}

async function readbacks(browser, base) {
  const checks = [
    ['/journal/', '#journal-naive-2026-10-12', 'The picture joins what never touched.'],
    ['/currents/naive-art/', '[data-catalog-current="naive"] [data-work-id="naive-2026-10-12"]', 'The picture joins what never touched.'],
    ['/works/naive-2026-10-12/', '[data-catalog-work-detail="naive-2026-10-12"]', 'The picture joins what never touched.']
  ];
  const results = [];
  for (const [path, selector, title] of checks) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const diag = diagnostics(page);
    const response = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(selector);
    const evidence = await page.evaluate(({ selector, title }) => ({
      selectorCount: document.querySelectorAll(selector).length,
      titlePresent: document.body.innerText.includes(title),
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauReady: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    }), { selector, title });
    assert.equal(response?.status(), 200);
    assert.equal(evidence.selectorCount, 1);
    assert.equal(evidence.titlePresent, true);
    assert.equal(evidence.innerWidth, 390);
    assert.equal(evidence.clientWidth, 390);
    assert.ok(evidence.scrollWidth <= 390);
    const screenshot = join(proofDir, `${path.replaceAll('/', '').replaceAll('-', '_') || 'root'}-390x844.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    results.push({ path, status: response?.status() ?? null, evidence, diagnostics: diag, screenshot });
    await context.close();
  }
  return results;
}

await mkdir(proofDir, { recursive: true });
const serverInfo = localMode ? await startServer() : { server: null, base: requestedBase };
const browser = await chromium.launch({ headless: true, executablePath: await chromePath() });
try {
  const matrix = await matrixRun(browser, serverInfo.base);
  const interaction = await interactionRun(browser, serverInfo.base);
  const blind = await blindRun(browser, serverInfo.base);
  const publicReadbacks = await readbacks(browser, serverInfo.base);
  const diagnosticsCount = [
    ...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()),
    ...Object.values(interaction.diagnostics).flat(),
    ...Object.values(blind.diagnostics).flat(),
    ...publicReadbacks.flatMap((entry) => Object.values(entry.diagnostics).flat())
  ].length;
  const report = {
    status: localMode ? 'local-headless-browser-probe' : 'production-headless-browser-probe',
    base: serverInfo.base,
    matrix,
    interaction,
    blind,
    publicReadbacks,
    counts: {
      matrixRuns: matrix.length,
      diagnosticsCount,
      overflowFailures: matrix.filter((entry) => entry.metrics.outer.scrollWidth > entry.viewport.width || entry.metrics.embedded.scrollWidth > entry.viewport.width).length + (blind.evidence.scrollWidth > blind.evidence.innerWidth ? 1 : 0) + publicReadbacks.filter((entry) => entry.evidence.scrollWidth > entry.evidence.innerWidth).length,
      httpFailures: matrix.filter((entry) => entry.status >= 400 || entry.status === null).length + (blind.response >= 400 ? 1 : 0) + publicReadbacks.filter((entry) => entry.status >= 400 || entry.status === null).length
    }
  };
  await writeFile(join(proofDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, counts: report.counts, interaction: { committedMemory: interaction.committed.memory, refused: interaction.refused.interaction, afterDelete: interaction.afterDelete.memory, afterRelease: interaction.afterRelease.memory }, blind: { memory: blind.evidence.state.memory.length, changed: blind.evidence.state.scene.trace.changedPatchCount } }, null, 2));
  assert.equal(report.counts.matrixRuns, 20);
  assert.equal(report.counts.diagnosticsCount, 0);
  assert.equal(report.counts.overflowFailures, 0);
  assert.equal(report.counts.httpFailures, 0);
} finally {
  await browser.close();
  serverInfo.server?.close();
}
