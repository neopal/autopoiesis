import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4261;
const baseUrl = process.env.MUTINE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v027-2026-10-09');
const localMode = baseUrl.startsWith(`http://127.0.0.1:${port}`);
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, baseUrl);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const candidate = resolve(root, `.${normalize(pathname)}`);
    if (!candidate.startsWith(root)) { response.writeHead(403); response.end('forbidden'); return; }
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(candidate).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404); response.end('not found');
  }
});

const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = {
  raw: '/studies/pure-svg/v027/?preview=1&interaction=1',
  canonical: '/works/svg-2026-10-09/'
};

function diagnostics(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  return { consoleMessages, pageErrors, failedRequests, badResponses };
}

async function waitForTableau(page, canonical) {
  if (!canonical) {
    await page.waitForFunction(() => Boolean(window._mutineReady));
    return page;
  }
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._mutineReady));
  return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v027/'));
}

async function tableauEvidence(page, frame, canonical, viewport, reducedMotion) {
  const shell = await page.evaluate(({ isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      mountReady: mount?.dataset.ready ?? null
    };
  }, { isCanonical: canonical });
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#field');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      signature: field?.dataset.signature ?? null,
      memory: Number(field?.dataset.memory ?? -1),
      rowCount: Number(field?.dataset.rowCount ?? -1),
      pathCount: field?.querySelectorAll('path.stratum').length ?? 0,
      touchControls: controls.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)), disabled: node.disabled })),
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display
    };
  });
  return { targetViewport: viewport.join('x'), reducedMotion, shell, tableau };
}

async function state(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      memory: Number(field.dataset.memory),
      signature: field.dataset.signature,
      interaction: field.dataset.interaction,
      seam: field.dataset.seam,
      notice: field.dataset.notice,
      pathCount: field.querySelectorAll('path.stratum').length
    };
  });
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const frame = await waitForTableau(page, routeName === 'canonical');
        const evidence = await tableauEvidence(page, frame, routeName === 'canonical', viewport, reducedMotion);
        await page.screenshot({ path: resolve(proofDir, `${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
        results.push({ routeName, route, viewport: viewport.join('x'), reducedMotion, evidence, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page, false);
  await frame.locator('#field').focus();
  const initial = await state(frame);
  await page.keyboard.press('Enter');
  const keyboardLoad = await state(frame);
  await page.keyboard.press('Delete');
  const keyboardLift = await state(frame);
  const box = await frame.locator('#field').boundingBox();
  await page.mouse.click(box.x + box.width * 0.22, box.y + box.height * 0.66);
  const pointerLoad = await state(frame);
  await frame.getByRole('button', { name: 'lift latest' }).click();
  const buttonLift = await state(frame);
  await frame.getByRole('button', { name: 'load the strata' }).click();
  const buttonLoad = await state(frame);
  await frame.getByRole('button', { name: 'release' }).click();
  const released = await state(frame);
  const buttons = await frame.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)), disabled: node.disabled })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, keyboardLoad, keyboardLift, pointerLoad, buttonLift, buttonLoad, released, buttons, diagnostics: diag };
}

async function runPointerArm(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
  const frame = await waitForTableau(page, false);
  const box = await frame.locator('#field').boundingBox();
  await page.mouse.move(box.x + box.width * 0.33, box.y + box.height * 0.42);
  await page.mouse.down();
  const pointerDown = await state(frame);
  await page.mouse.up();
  const pointerUp = await state(frame);
  await page.close();
  return { pointerDown, pointerUp, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v027/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      fieldVisible: getComputedStyle(field).display !== 'none',
      memory: Number(field.dataset.memory),
      rowCount: Number(field.dataset.rowCount),
      pathCount: field.querySelectorAll('path.stratum').length,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-svg-2026-10-09, [data-work-id="svg-2026-10-09"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, `${path.replaceAll('/', '_') || 'root'}-390x844.png`), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsClean(result) {
  const diagnostics = result.diagnostics;
  return !diagnostics.consoleMessages.length && !diagnostics.pageErrors.length && !diagnostics.failedRequests.length && !diagnostics.badResponses.length;
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  if (localMode) await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const pointer = await runPointerArm(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-svg-2026-10-09');
  const current = await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-09"]');
  const canonical = await runReadback(browser, '/works/svg-2026-10-09/', '[data-catalog-work-detail="svg-2026-10-09"]');
  await browser.close();
  if (localMode) server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const evidence = result.evidence;
    return evidence.shell.innerWidth !== target
      || evidence.shell.clientWidth !== target
      || evidence.shell.scrollWidth > target
      || evidence.tableau.innerWidth !== evidence.tableau.clientWidth
      || evidence.tableau.scrollWidth > evidence.tableau.clientWidth
      || evidence.tableau.rowCount !== 11
      || evidence.tableau.pathCount !== 11
      || !evidence.shell.tableauFirst
      || !diagnosticsClean(result);
  });
  const allDiagnostics = [
    ...matrix.map((result) => result.diagnostics), interaction.diagnostics, pointer.diagnostics, blind.diagnostics,
    journal.diagnostics, current.diagnostics, canonical.diagnostics
  ];
  const diagnosticsCount = allDiagnostics.reduce((count, diagnostic) => count + diagnostic.consoleMessages.length + diagnostic.pageErrors.length + diagnostic.failedRequests.length + diagnostic.badResponses.length, 0);
  const report = {
    baseUrl,
    localMode,
    matrix,
    interaction,
    pointer,
    blind,
    readbacks: { journal, current, canonical },
    summary: {
      matrixRuns: matrix.length,
      matrixFailures: failures.length,
      diagnosticsCount,
      overflowFailures: matrix.filter((result) => result.evidence.shell.scrollWidth > result.evidence.shell.innerWidth || result.evidence.tableau.scrollWidth > result.evidence.tableau.innerWidth).length,
      allDiagnosticsClean: diagnosticsCount === 0,
      journalTitle: journal.evidence.title,
      currentTitle: current.evidence.title,
      canonicalTitle: canonical.evidence.title
    }
  };
  await writeFile(resolve(proofDir, `${localMode ? 'local' : 'production'}-results.json`), JSON.stringify(report, null, 2));
  const interactionOk = interaction.keyboardLoad.memory === 1
    && interaction.keyboardLift.memory === 0
    && interaction.pointerLoad.memory === 1
    && interaction.buttonLift.memory === 0
    && interaction.buttonLoad.memory === 1
    && interaction.released.memory === 0
    && pointer.pointerDown.memory === 0
    && pointer.pointerDown.interaction === 'pressure-armed'
    && pointer.pointerUp.memory === 1;
  const blindOk = blind.evidence.fieldVisible
    && blind.evidence.rowCount === 11
    && blind.evidence.pathCount === 11
    && blind.evidence.readoutDisplay === 'none'
    && blind.evidence.controlsDisplay === 'none';
  if (failures.length || diagnosticsCount || !interactionOk || !blindOk) {
    console.error(JSON.stringify({ failures, interaction, pointer, blind, summary: report.summary }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ...report.summary, interactionOk, blindOk }, null, 2));
  }
}

main().catch((error) => {
  if (localMode) server.close();
  console.error(error);
  process.exitCode = 1;
});
