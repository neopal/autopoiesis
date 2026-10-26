import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];
const modes = ['normal', 'reduced-motion'];
const proofDir = process.env.PROOF_DIR || 'research/qa/proofs/handwriting-v034-2026-10-26';
const suppliedBase = process.env.BASE_URL || '';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function localServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const candidate = path.resolve(root, `.${requestPath}`);
      if (!candidate.startsWith(root)) throw new Error('path traversal');
      let target = candidate;
      const details = await stat(target);
      if (details.isDirectory()) target = path.join(target, 'index.html');
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(target)] || 'application/octet-stream' });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function diagnosticsFor(page) {
  const diagnostics = [];
  page.on('console', (message) => diagnostics.push(`console:${message.type()}:${message.text()}`));
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed:${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) diagnostics.push(`http:${response.status()}:${response.url()}`);
  });
  return diagnostics;
}

async function rawMetrics(page) {
  return page.evaluate(() => {
    const field = document.querySelector('#register-field');
    const controls = [...document.querySelectorAll('.register-controls button')];
    const fieldRect = field?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fragments: document.querySelectorAll('.fragment').length,
      fieldWidth: fieldRect?.width ?? 0,
      fieldHeight: fieldRect?.height ?? 0,
      controls: controls.map((control) => ({ id: control.id, width: control.getBoundingClientRect().width, height: control.getBoundingClientRect().height })),
      signature: window.__mutineHandwritingV034?.getSignature(),
      memory: window.__mutineHandwritingV034?.getState().memory
    };
  });
}

async function runViewportMatrix(browser, base, label, production) {
  const runs = [];
  const diagnostics = [];
  for (const mode of modes) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const pageDiagnostics = await diagnosticsFor(page);
      const rawUrl = `${base}/studies/handwriting/v034/?preview=1&interaction=1`;
      await page.goto(rawUrl, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window._p5Ready === true);
      const metrics = await rawMetrics(page);
      runs.push({ route: 'raw', mode, viewport: `${viewport.width}x${viewport.height}`, ...metrics });
      await page.screenshot({ path: path.join(root, proofDir, `${label}-raw-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...pageDiagnostics);
      await context.close();

      const canonicalContext = await browser.newContext({ viewport, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
      const canonicalPage = await canonicalContext.newPage();
      const canonicalDiagnostics = await diagnosticsFor(canonicalPage);
      await canonicalPage.goto(`${base}/works/typography-2026-10-26/`, { waitUntil: 'networkidle' });
      await canonicalPage.waitForSelector('[data-catalog-work-detail="typography-2026-10-26"]');
      await canonicalPage.waitForFunction(() => document.body.innerText.includes('The gap keeps an elsewhere.'));
      const canonicalMetrics = await canonicalPage.evaluate(() => ({
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        detail: Boolean(document.querySelector('[data-catalog-work-detail="typography-2026-10-26"]')),
        title: document.body.innerText.includes('The gap keeps an elsewhere.')
      }));
      runs.push({ route: 'canonical', mode, viewport: `${viewport.width}x${viewport.height}`, ...canonicalMetrics });
      await canonicalPage.screenshot({ path: path.join(root, proofDir, `${label}-canonical-${mode}-${viewport.width}x${viewport.height}.png`), fullPage: true });
      diagnostics.push(...canonicalDiagnostics);
      await canonicalContext.close();
    }
  }
  return { runs, diagnostics };
}

async function runInteraction(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = await diagnosticsFor(page);
  await page.goto(`${base}/studies/handwriting/v034/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window._p5Ready === true);
  const baseline = await page.evaluate(() => window.__mutineHandwritingV034.getSignature());
  const fragment = page.locator('.fragment[data-fragment-id="2"]');
  const box = await fragment.boundingBox();
  if (!box) throw new Error('fragment 2 has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const during = await page.evaluate(() => window.__mutineHandwritingV034.getState());
  const duringSignature = await page.evaluate(() => window.__mutineHandwritingV034.getSignature());
  await page.mouse.move(399, 853);
  await page.waitForTimeout(20);
  const after = await page.evaluate(() => window.__mutineHandwritingV034.getState());
  const changedSignature = await page.evaluate(() => window.__mutineHandwritingV034.getSignature());
  await page.evaluate(() => document.querySelector('#register-field').focus());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineHandwritingV034.getState());
  const restored = await page.evaluate(() => window.__mutineHandwritingV034.getSignature());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window._p5Ready === true);
  await page.evaluate(() => document.querySelector('#register-field').focus());
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineHandwritingV034.getState());
  const controls = await page.evaluate(() => [...document.querySelectorAll('.register-controls button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })));
  await context.close();
  return {
    committed: after.lastEvent === 'withdrawal' && after.history.length === 1,
    previewGeometryUnchanged: during.lastEvent === 'attending' && during.history.length === 0 && during.active === 2 && during.changedFragmentIds.length === 0 && duringSignature === baseline,
    changedGeometry: after.history.length === 1 && after.changedFragmentIds.length >= 3 && changedSignature !== baseline,
    liftRestored: lifted.lastEvent === 'lifted' && lifted.history.length === 0 && restored === baseline,
    keyboardCommitted: keyboard.lastEvent === 'withdrawal' && keyboard.history.length === 1,
    controls,
    diagnostics
  };
}

async function runBlind(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const diagnostics = await diagnosticsFor(page);
  await page.goto(`${base}/studies/handwriting/v034/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window._p5Ready === true);
  const result = await page.evaluate(() => {
    const hidden = (selector) => getComputedStyle(document.querySelector(selector)).display === 'none';
    const state = window.__mutineHandwritingV034.getState();
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fragments: document.querySelectorAll('.fragment').length,
      memory: state.memory,
      controls: hidden('.register-controls') ? 'none' : 'visible',
      readout: hidden('.field-readout') ? 'none' : 'visible',
      hint: hidden('.field-hint') ? 'none' : 'visible'
    };
  });
  await page.screenshot({ path: path.join(root, proofDir, 'blind-390x844.png'), fullPage: true });
  await context.close();
  return { ...result, diagnostics };
}

async function run() {
  await mkdir(path.join(root, proofDir), { recursive: true });
  const local = suppliedBase ? null : await localServer();
  const base = suppliedBase || local.base;
  const production = Boolean(suppliedBase);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  const matrix = await runViewportMatrix(browser, base, production ? 'production' : 'local', production);
  const interaction = await runInteraction(browser, base);
  const blind = await runBlind(browser, base);
  await browser.close();
  if (local) await new Promise((resolve) => local.server.close(resolve));

  const allDiagnostics = [...matrix.diagnostics, ...interaction.diagnostics, ...blind.diagnostics];
  const viewportRuns = matrix.runs.length;
  const rawViewportRuns = matrix.runs.filter((run) => run.route === 'raw').length;
  const overflow = matrix.runs.filter((run) => run.innerWidth !== run.clientWidth || run.scrollWidth > run.innerWidth).length;
  const minTouchTarget = Math.min(...interaction.controls.map((control) => control.height));
  const output = {
    schema: 'mutine-qa/v1',
    base,
    production,
    viewportRuns,
    rawViewportRuns,
    canonicalViewportRuns: matrix.runs.filter((run) => run.route === 'canonical').length,
    diagnostics: allDiagnostics.length,
    overflow,
    minTouchTarget,
    localViewportRuns: production ? undefined : viewportRuns,
    localDiagnostics: production ? undefined : allDiagnostics.length,
    localOverflow: production ? undefined : overflow,
    localMinTouchTarget: production ? undefined : minTouchTarget,
    productionViewportRuns: production ? viewportRuns : undefined,
    productionDiagnostics: production ? allDiagnostics.length : undefined,
    productionOverflow: production ? overflow : undefined,
    productionMinTouchTarget: production ? minTouchTarget : undefined,
    interaction,
    blind,
    matrix
  };
  const outputPath = path.join(root, proofDir, production ? 'production-qa-summary.json' : 'qa-summary.json');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(outputPath, JSON.stringify(output, null, 2) + '\n'));
  console.log(JSON.stringify({ outputPath, base, viewportRuns, canonicalViewportRuns: output.canonicalViewportRuns, diagnostics: output.diagnostics, overflow, minTouchTarget, interaction: { committed: interaction.committed, changedGeometry: interaction.changedGeometry, liftRestored: interaction.liftRestored, keyboardCommitted: interaction.keyboardCommitted }, blind }, null, 2));
}

await run();
