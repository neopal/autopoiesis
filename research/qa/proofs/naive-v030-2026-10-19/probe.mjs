import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4205;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/naive-v030-2026-10-19');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) throw new Error('forbidden');
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawRoute = '/studies/naive-art/v030/?preview=1&interaction=1';
const canonicalRoute = '/works/naive-2026-10-19/';

function diagnostics(page) {
  const value = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => value.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => value.pageErrors.push(error.message));
  page.on('requestfailed', (request) => value.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) value.badResponses.push(`${response.status()} ${response.url()}`); });
  return value;
}

async function waitRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutineNaiveV030), null, { timeout: 15000 });
  await page.waitForSelector('#pressure-svg', { timeout: 15000 });
  await sleep(80);
}

async function waitCanonical(page) {
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]', { timeout: 15000 });
  await page.waitForSelector('.work-inspect__stage iframe', { timeout: 15000 });
  await page.frames().at(-1).waitForFunction(() => Boolean(window.__mutineNaiveV030), null, { timeout: 15000 });
  await sleep(180);
}

async function inspect(browser, route, viewport, reducedMotion) {
  const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
  if (route === rawRoute) await waitRaw(page); else await waitCanonical(page);
  const evidence = await page.evaluate(({ isCanonical }) => {
    const svg = isCanonical ? document.querySelector('.work-inspect__stage iframe') : document.querySelector('#pressure-svg');
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tableauTop: svg?.getBoundingClientRect().top ?? null,
      tableauVisible: Boolean(svg && getComputedStyle(svg).display !== 'none'),
      iframeHeight: iframe?.getBoundingClientRect().height ?? null,
      headingTop: heading?.getBoundingClientRect().top ?? null,
      mountReady: mount?.dataset.ready ?? null,
      title: heading?.textContent?.trim() ?? null
    };
  }, { isCanonical: route === canonicalRoute });
  await page.screenshot({ path: resolve(proofDir, `${route === rawRoute ? 'raw' : 'canonical'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
  await page.close();
  return { route: route === rawRoute ? 'raw' : 'canonical', viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = [];
  for (const reducedMotion of [false, true]) {
    for (const route of [rawRoute, canonicalRoute]) {
      for (const viewport of viewports) matrix.push(await inspect(browser, route, viewport, reducedMotion));
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const interactionDiagnostics = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${rawRoute}`, { waitUntil: 'networkidle' });
  await waitRaw(page);
  const initial = await page.evaluate(() => window.__mutineNaiveV030.getState());
  const initialSignature = await page.evaluate(() => window.__mutineNaiveV030.geometrySignature());
  const svg = page.locator('#pressure-svg');
  const box = await svg.boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.48);
  const shallow = await page.evaluate(() => window.__mutineNaiveV030.getState());
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.48);
  await page.mouse.down();
  await sleep(700);
  await page.mouse.up();
  const held = await page.evaluate(() => window.__mutineNaiveV030.getState());
  const heldSignature = await page.evaluate(() => window.__mutineNaiveV030.geometrySignature());
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => window.__mutineNaiveV030.getState());
  await page.locator('[data-gesture="load"]').click();
  const button = await page.evaluate(() => window.__mutineNaiveV030.getState());
  const keyboardSignatureBefore = await page.evaluate(() => window.__mutineNaiveV030.geometrySignature());
  await page.locator('#slab-field').focus();
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => window.__mutineNaiveV030.getState());
  await page.keyboard.press('Delete');
  const keyboardLifted = await page.evaluate(() => window.__mutineNaiveV030.getState());
  await page.locator('[data-gesture="release"]').click();
  const released = await page.evaluate(() => window.__mutineNaiveV030.getState());
  const touchTargets = await page.evaluate(() => [...document.querySelectorAll('.slab-controls button')].map((buttonNode) => ({ text: buttonNode.textContent.trim(), height: buttonNode.getBoundingClientRect().height })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();

  const blind = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const blindDiagnostics = diagnostics(blind);
  await blind.emulateMedia({ reducedMotion: 'reduce' });
  await blind.goto(`http://127.0.0.1:${port}/studies/naive-art/v030/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitRaw(blind);
  const blindEvidence = await blind.evaluate(() => ({
    svgVisible: getComputedStyle(document.querySelector('#pressure-svg')).display !== 'none',
    readoutDisplay: getComputedStyle(document.querySelector('.slab-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.slab-controls')).display,
    hintDisplay: getComputedStyle(document.querySelector('.slab-hint')).display,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    memory: window.__mutineNaiveV030.getState().memory.length
  }));
  await blind.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await blind.close();

  const journal = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const journalDiagnostics = diagnostics(journal);
  await journal.goto(`http://127.0.0.1:${port}/journal/`, { waitUntil: 'networkidle' });
  await journal.waitForSelector('#journal-naive-2026-10-19', { timeout: 15000 });
  const journalEvidence = await journal.evaluate(() => ({
    count: document.querySelectorAll('#journal-naive-2026-10-19').length,
    title: document.querySelector('#journal-naive-2026-10-19 h3')?.textContent?.trim() ?? null,
    canonicalHref: document.querySelector('#journal-naive-2026-10-19 h3 a')?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await journal.screenshot({ path: resolve(proofDir, 'journal-390x844.png'), fullPage: true });
  await journal.close();

  const current = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const currentDiagnostics = diagnostics(current);
  await current.goto(`http://127.0.0.1:${port}/currents/naive-art/`, { waitUntil: 'networkidle' });
  await current.waitForSelector('[data-catalog-current-header][data-ready="true"]', { timeout: 15000 });
  await current.waitForSelector('[data-work-id="naive-2026-10-19"]', { timeout: 15000 });
  const currentEvidence = await current.evaluate(() => ({
    header: document.querySelector('[data-catalog-current-header] h1')?.textContent?.trim() ?? null,
    firstTarget: document.querySelector('[data-work-id="naive-2026-10-19"]')?.textContent?.trim() ?? null,
    targetCount: document.querySelectorAll('[data-work-id="naive-2026-10-19"]').length,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await current.screenshot({ path: resolve(proofDir, 'current-390x844.png'), fullPage: true });
  await current.close();

  await browser.close();
  server.close();
  const allDiagnostics = [
    ...matrix.flatMap((entry) => Object.values(entry.diagnostics)),
    ...Object.values(interactionDiagnostics),
    ...Object.values(blindDiagnostics),
    ...Object.values(journalDiagnostics),
    ...Object.values(currentDiagnostics)
  ];
  const failures = matrix.filter((entry) => {
    const target = Number(entry.viewport.split('x')[0]);
    return entry.evidence.innerWidth !== target || entry.evidence.clientWidth !== target || entry.evidence.scrollWidth > target || !entry.evidence.tableauVisible || Object.values(entry.diagnostics).some((items) => items.length);
  });
  const summary = {
    matrixRuns: matrix.length,
    matrixFailures: failures,
    diagnosticCount: allDiagnostics.reduce((sum, items) => sum + items.length, 0),
    overflowCount: matrix.filter((entry) => entry.evidence.scrollWidth > Number(entry.viewport.split('x')[0])).length,
    interaction: { initial: { memory: initial.memory.length, signature: initial.surface }, shallow: { memory: shallow.memory.length, interaction: shallow.interaction }, held: { memory: held.memory.length, interaction: held.interaction, changedBoundaryIds: held.surface.changedBoundaryIds, remoteZone: held.surface.remoteZone, signatureChanged: heldSignature !== initialSignature }, lifted: { memory: lifted.memory.length, interaction: lifted.interaction }, button: { memory: button.memory.length, interaction: button.interaction }, keyboard: { memory: keyboard.memory.length, interaction: keyboard.interaction, changed: keyboardSignatureBefore !== heldSignature }, keyboardLifted: { memory: keyboardLifted.memory.length, interaction: keyboardLifted.interaction }, released: { memory: released.memory.length, interaction: released.interaction }, touchTargets, diagnostics: interactionDiagnostics },
    blindEvidence,
    journalEvidence,
    currentEvidence,
    sample: matrix.filter((entry) => entry.route === 'raw' && (entry.viewport === '390x844' || entry.viewport === '1920x1080')).map((entry) => ({ viewport: entry.viewport, reducedMotion: entry.reducedMotion, evidence: entry.evidence, diagnostics: entry.diagnostics }))
  };
  await writeFile(resolve(proofDir, 'matrix.json'), JSON.stringify(matrix, null, 2));
  await writeFile(resolve(proofDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { server.close(); console.error(error.stack || error); process.exitCode = 1; });
