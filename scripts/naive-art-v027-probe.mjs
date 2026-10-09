import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const rawPath = '/studies/naive-art/v027/';
const canonicalPath = '/works/naive-2026-10-09/';
const localMode = !process.argv[2] || process.argv[2] === 'local';
const requestedBase = localMode ? null : process.argv[2].replace(/\/$/, '');
const proofDir = join(root, 'research/qa/proofs', `naive-v027-2026-10-09${localMode ? '' : '-production'}`);

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = normalize(join(root, decoded.replace(/^\/+/, '')));
  return candidate.startsWith(normalize(root)) ? candidate : null;
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = request.url?.split('?')[0] ?? '/';
      const filePath = safeFilePath(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
      if (!filePath) { response.writeHead(403); response.end('forbidden'); return; }
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': mime[extname(filePath)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404); response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

function diagnostics(page) {
  const result = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
}

async function artworkFrame(page, kind) {
  if (kind === 'raw') return page;
  const frame = page.frames().find((entry) => entry.url().includes('/studies/naive-art/v027/'));
  if (!frame) throw new Error('canonical artwork iframe did not load');
  return frame;
}

async function pageMetrics(page, frame) {
  return page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  })).then(async (outer) => ({
    outer,
    artwork: await frame.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stage: document.querySelector('#register-stage')?.getBoundingClientRect().toJSON(),
      field: document.querySelector('#register-field')?.getBoundingClientRect().toJSON(),
      layers: document.querySelectorAll('[data-print-layer]').length,
      controls: [...document.querySelectorAll('button')].map((button) => Math.round(button.getBoundingClientRect().height))
    }))
  }));
}

async function state(frame) {
  return frame.evaluate(() => window.__mutineNaiveV027.getState());
}

async function openRun(browser, base, viewport, reduced, kind) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  const url = `${base}${kind === 'raw' ? rawPath : canonicalPath}?${kind === 'raw' ? 'preview=1&interaction=1' : 'matrix=1'}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  const frame = await artworkFrame(page, kind);
  await frame.waitForFunction(() => Boolean(window.__mutineNaiveV027));
  const metrics = await pageMetrics(page, frame);
  const initial = await state(frame);
  const screenshot = join(proofDir, `${kind}-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();
  return { kind, viewport, reduced, initial: { stage: initial.stage, memory: initial.memory.length, layers: initial.scene.plates.length }, metrics, diagnostics: diag, screenshot };
}

async function interactionRun(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const frame = page;
  await frame.waitForFunction(() => Boolean(window.__mutineNaiveV027));
  const box = await page.locator('#register-stage').boundingBox();
  if (!box) throw new Error('interaction stage has no bounding box');
  const at = (x, y) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const initial = await state(frame);
  const start = at(0.18, 0.78);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of [[0.72, 0.78], [0.80, 0.27], [0.26, 0.20], [0.18, 0.78], [0.22, 0.75]]) {
    const point = at(x, y);
    await page.mouse.move(point.x, point.y, { steps: 4 });
  }
  await page.mouse.up();
  const committed = await state(frame);
  const afterSignature = committed.geometrySignature;
  await page.keyboard.press('Delete');
  const lifted = await state(frame);
  const liftedExact = lifted.memory.length === 0 && lifted.geometrySignature === initial.geometrySignature;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  const tap = await state(frame);
  await page.getByRole('button', { name: 'close the correction' }).click();
  const buttonCommitted = await state(frame);
  await page.keyboard.press('r');
  const released = await state(frame);
  await context.close();
  return {
    diagnostics: diag,
    initial: { memory: initial.memory.length, signature: initial.geometrySignature },
    committed: { memory: committed.memory.length, interaction: committed.interaction, changedLayers: committed.scene.trace.changedLayerCount, signatureChanged: afterSignature !== initial.geometrySignature },
    lifted: { memory: lifted.memory.length, exact: liftedExact },
    shortTap: { memory: tap.memory.length, interaction: tap.interaction },
    button: { memory: buttonCommitted.memory.length, interaction: buttonCommitted.interaction },
    released: { memory: released.memory.length, interaction: released.interaction }
  };
}

async function blindRun(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diag = diagnostics(page);
  await page.goto(`${base}${rawPath}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV027));
  const hidden = await page.evaluate(() => ({
    readout: getComputedStyle(document.querySelector('.register-readout')).display,
    controls: getComputedStyle(document.querySelector('.register-controls')).display,
    hint: getComputedStyle(document.querySelector('.register-hint')).display,
    width: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('*')].map((element) => ({
      tag: element.tagName,
      id: element.id,
      className: typeof element.className === 'string' ? element.className : '',
      right: Math.round(element.getBoundingClientRect().right),
      width: Math.round(element.getBoundingClientRect().width)
    })).filter((entry) => entry.right > window.innerWidth + 1).slice(0, 12),
    layers: document.querySelectorAll('.print-layer[data-print-layer]').length
  }));
  const settled = await state(page);
  await page.screenshot({ path: join(proofDir, 'blind-390x844-reduced.png'), fullPage: true });
  await context.close();
  return { diagnostics: diag, hidden, settled: { stage: settled.stage, memory: settled.memory.length, changedLayers: settled.scene.trace.changedLayerCount } };
}

const serverInfo = localMode ? await startServer() : { server: null, base: requestedBase };
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/.agent-browser/browsers/chrome-155.0.8059.39/chrome.exe' });
try {
  const matrix = [];
  for (const viewport of viewports) {
    for (const reduced of [false, true]) {
      matrix.push(await openRun(browser, serverInfo.base, viewport, reduced, 'raw'));
      matrix.push(await openRun(browser, serverInfo.base, viewport, reduced, 'canonical'));
    }
  }
  const interaction = await interactionRun(browser, serverInfo.base);
  const blind = await blindRun(browser, serverInfo.base);
  const flatDiagnostics = [...matrix.flatMap((run) => Object.values(run.diagnostics).flat()), ...Object.values(interaction.diagnostics).flat(), ...Object.values(blind.diagnostics).flat()];
  const report = {
    base: serverInfo.base,
    mode: localMode ? 'local' : 'production',
    matrix,
    interaction,
    blind,
    matrixRuns: matrix.length,
    diagnostics: flatDiagnostics.length,
    overflowFailures: matrix.filter((run) => run.metrics.outer.scrollWidth > run.viewport.width || run.metrics.outer.clientWidth > run.viewport.width).length + (blind.hidden.scrollWidth > blind.hidden.width ? 1 : 0)
  };
  await writeFile(join(proofDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const summary = {
    mode: report.mode,
    matrixRuns: report.matrixRuns,
    diagnostics: report.diagnostics,
    overflowFailures: report.overflowFailures,
    interaction: {
      committed: report.interaction.committed,
      lifted: report.interaction.lifted,
      shortTap: report.interaction.shortTap,
      button: report.interaction.button,
      released: report.interaction.released
    },
    blind: report.blind
  };
  console.log(JSON.stringify(summary, null, 2));
  if (report.matrixRuns !== 14 && report.matrixRuns !== 20) throw new Error(`unexpected matrix run count ${report.matrixRuns}`);
  if (report.diagnostics || report.overflowFailures) process.exitCode = 1;
} finally {
  await browser.close();
  serverInfo.server?.close();
}
