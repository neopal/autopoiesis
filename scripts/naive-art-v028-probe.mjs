import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = dirname(fileURLToPath(import.meta.url));
const repo = join(ROOT, '..');
const proofDir = join(repo, 'research/qa/proofs/naive-v028-2026-10-10');
const rawPath = '/studies/naive-art/v028/';
const canonicalPath = '/works/naive-2026-10-10/';
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
  return candidate === normalize(repo) || candidate.startsWith(`${normalize(repo)}\\`) || candidate.startsWith(`${normalize(repo)}/`)
    ? candidate
    : null;
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

async function frameFor(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window.__mutineNaiveV028));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineNaiveV028));
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/naive-art/v028/'));
  assert.ok(frame, 'canonical v028 tableau iframe must load');
  return frame;
}

async function frameMetrics(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#mishear-field');
    const stage = document.querySelector('#score-stage');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      field: field?.getBoundingClientRect().toJSON() ?? null,
      stage: stage?.getBoundingClientRect().toJSON() ?? null,
      marks: document.querySelectorAll('[data-mark-index]').length,
      controls: [...document.querySelectorAll('[data-action]')].map((button) => ({ height: Math.round(button.getBoundingClientRect().height), width: Math.round(button.getBoundingClientRect().width) })),
      state: window.__mutineNaiveV028?.getState?.() ?? null
    };
  });
}

async function outerMetrics(page, targetViewport, canonical) {
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
  const frame = await frameFor(page, canonical);
  const embedded = await frameMetrics(frame);
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
  assert.equal(embedded.marks, 15);
  if (canonical) assert.equal(outer.tableauFirst, true, 'tableau must precede generated heading');
  return { outer, embedded };
}

async function runMatrix(browser, base) {
  const results = [];
  for (const route of [{ kind: 'raw', path: rawPath }, { kind: 'canonical', path: canonicalPath }]) {
    for (const viewport of viewports) {
      for (const reduced of [false, true]) {
        const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        const diag = diagnostics(page);
        const response = await page.goto(`${base}${route.path}?${route.kind === 'raw' ? 'preview=1&interaction=1' : 'matrix=1'}`, { waitUntil: 'networkidle' });
        const metrics = await outerMetrics(page, viewport, route.kind === 'canonical');
        const screenshot = join(proofDir, `${route.kind}-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`);
        await page.screenshot({ path: screenshot, fullPage: false });
        results.push({ kind: route.kind, viewport, reduced, status: response?.status() ?? null, metrics, diagnostics: diag, screenshot });
        await context.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV028));
  const initial = await page.evaluate(() => window.__mutineNaiveV028.getState());
  const mark = page.locator('[data-mark-index="2"]');
  await mark.hover();
  const armed = await page.evaluate(() => window.__mutineNaiveV028.getState());
  await page.waitForTimeout(520);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(80);
  const committed = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(armed.memory.length, initial.memory.length, 'pointerenter must arm without writing');
  assert.equal(committed.memory.length, 1, 'sustained pointerleave must commit one observation');

  await page.getByRole('button', { name: 'release the memory' }).click();
  const released = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(released.memory.length, 0);
  await page.locator('[data-mark-index="4"]').hover();
  await page.waitForTimeout(80);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(50);
  const short = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(short.memory.length, 0, 'short departure must be refused');
  assert.equal(short.interaction, 'observation-refused-short');

  await page.locator('[data-mark-index="3"]').focus();
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => window.__mutineNaiveV028.getState());
  const enterSignature = afterEnter.geometrySignature;
  assert.equal(afterEnter.memory.length, 1);
  await page.keyboard.press('Delete');
  const afterDelete = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(afterDelete.memory.length, 0);
  assert.equal(afterDelete.geometrySignature, initial.geometrySignature, 'Delete must restore the exact baseline strip');

  await page.getByRole('button', { name: 'mishear the active mark' }).click();
  const afterButton = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(afterButton.memory.length, 1);
  assert.equal(afterButton.geometrySignature, enterSignature, 'button and Enter must share the deterministic event');
  await page.getByRole('button', { name: 'lift latest' }).click();
  const afterLift = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(afterLift.memory.length, 0);
  await page.locator('#mishear-field').focus();
  await page.keyboard.press('r');
  const afterRelease = await page.evaluate(() => window.__mutineNaiveV028.getState());
  assert.equal(afterRelease.memory.length, 0);

  const touchTargets = await page.evaluate(() => [...document.querySelectorAll('[data-action]')].map((button) => Math.round(button.getBoundingClientRect().height)));
  assert.ok(touchTargets.every((height) => height >= 44));
  await page.screenshot({ path: join(proofDir, 'interaction-390x844.png'), fullPage: false });
  await context.close();
  return { initial, armed, committed, released, short, afterEnter, afterDelete, afterButton, afterLift, afterRelease, touchTargets, diagnostics: diag };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  const response = await page.goto(`${base}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV028));
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    fieldVisible: getComputedStyle(document.querySelector('#mishear-field')).display !== 'none',
    marks: document.querySelectorAll('[data-mark-index]').length,
    readoutVisible: getComputedStyle(document.querySelector('.mishear-readout')).display !== 'none',
    controlsVisible: getComputedStyle(document.querySelector('.mishear-controls')).display !== 'none',
    hintVisible: getComputedStyle(document.querySelector('.mishear-hint')).display !== 'none',
    roles: [...document.querySelectorAll('[data-mark-index]')].map((mark) => mark.dataset.role),
    state: window.__mutineNaiveV028.getState()
  }));
  assert.equal(response?.status(), 200);
  assert.equal(evidence.innerWidth, 390);
  assert.equal(evidence.clientWidth, 390);
  assert.ok(evidence.scrollWidth <= 390);
  assert.equal(evidence.fieldVisible, true);
  assert.equal(evidence.marks, 15);
  assert.equal(evidence.readoutVisible, false);
  assert.equal(evidence.controlsVisible, false);
  assert.equal(evidence.hintVisible, false);
  assert.ok(evidence.roles.includes('vacated'));
  assert.ok(evidence.roles.includes('misheard'));
  await page.screenshot({ path: join(proofDir, 'blind-390x844-reduced.png'), fullPage: false });
  await context.close();
  return { response: response?.status() ?? null, evidence, diagnostics: diag };
}

async function runReadbacks(browser, base) {
  const readbacks = [];
  for (const [path, selector, title] of [
    ['/journal/', '#journal-naive-2026-10-10', 'The picture misremembers the gap.'],
    ['/currents/naive-art/', '[data-catalog-current="naive"] [data-work-id="naive-2026-10-10"]', 'The picture misremembers the gap.'],
    ['/works/naive-2026-10-10/', '[data-catalog-work-detail="naive-2026-10-10"]', 'The picture misremembers the gap.']
  ]) {
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
      scrollWidth: document.documentElement.scrollWidth
    }), { selector, title });
    assert.equal(response?.status(), 200);
    assert.equal(evidence.selectorCount, 1);
    assert.equal(evidence.titlePresent, true);
    assert.equal(evidence.innerWidth, 390);
    assert.equal(evidence.clientWidth, 390);
    assert.ok(evidence.scrollWidth <= 390);
    const screenshot = join(proofDir, `${path.replaceAll('/', '').replaceAll('-', '_') || 'root'}-390x844.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    readbacks.push({ path, status: response?.status() ?? null, evidence, diagnostics: diag, screenshot });
    await context.close();
  }
  return readbacks;
}

await mkdir(proofDir, { recursive: true });
const { server, base } = await startServer();
const browser = await chromium.launch({ headless: true, executablePath: await chromePath() });
try {
  const matrix = await runMatrix(browser, base);
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base);
  const readbacks = await runReadbacks(browser, base);
  const diagnosticCount = [
    ...matrix.flatMap((entry) => Object.values(entry.diagnostics).flat()),
    ...Object.values(interaction.diagnostics).flat(),
    ...Object.values(blind.diagnostics).flat(),
    ...readbacks.flatMap((entry) => Object.values(entry.diagnostics).flat())
  ].length;
  const report = {
    status: 'local-headless-browser-probe',
    base,
    matrix,
    interaction,
    blind,
    readbacks,
    counts: {
      matrixRuns: matrix.length,
      diagnosticCount,
      overflowFailures: matrix.filter((entry) => entry.metrics.outer.scrollWidth > entry.viewport.width || entry.metrics.embedded.scrollWidth > entry.viewport.width).length + (blind.evidence.scrollWidth > blind.evidence.innerWidth ? 1 : 0) + readbacks.filter((entry) => entry.evidence.scrollWidth > entry.evidence.innerWidth).length,
      httpFailures: matrix.filter((entry) => entry.status >= 400 || entry.status === null).length + (blind.response >= 400 ? 1 : 0) + readbacks.filter((entry) => entry.status >= 400 || entry.status === null).length
    }
  };
  await writeFile(join(proofDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, counts: report.counts, interaction: { committedMemory: interaction.committed.memory.length, shortMemory: interaction.short.memory.length, afterEnter: interaction.afterEnter.memory.length, afterDelete: interaction.afterDelete.memory.length }, blind: { memory: blind.evidence.state.memory.length, changed: blind.evidence.state.scene.trace.changedMarkCount } }, null, 2));
  assert.equal(report.counts.matrixRuns, 20);
  assert.equal(report.counts.diagnosticCount, 0);
  assert.equal(report.counts.overflowFailures, 0);
  assert.equal(report.counts.httpFailures, 0);
} finally {
  await browser.close();
  server.close();
}
