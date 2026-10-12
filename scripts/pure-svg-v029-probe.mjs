import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4282;
const baseUrl = process.env.MUTINE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v029-2026-10-12');
const localMode = baseUrl.startsWith(`http://127.0.0.1:${port}`);
const rawRoute = '/studies/pure-svg/v029/?preview=1&interaction=1';
const canonicalRoute = '/works/svg-2026-10-12/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };

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
  } catch { response.writeHead(404); response.end('not found'); }
});

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

async function fieldState(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#field');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      signature: field?.dataset.signature ?? null,
      memory: Number(field?.dataset.memory ?? -1),
      interaction: field?.dataset.interaction ?? null,
      cellCount: Number(field?.dataset.cellCount ?? -1),
      pathCount: field?.querySelectorAll('path[data-cell-path]').length ?? 0,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      controls: controls.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)), disabled: node.disabled }))
    };
  });
}

async function openRaw(page) {
  await page.goto(`${baseUrl}${rawRoute}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  return page;
}

async function openCanonical(page) {
  await page.goto(`${baseUrl}${canonicalRoute}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._mutineReady));
  return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v029/'));
}

async function shellState(page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      title: heading?.textContent?.trim() ?? null,
      target: document.querySelector('[data-catalog-work-detail]')?.getAttribute('data-catalog-work-detail') ?? null
    };
  });
}

async function runMatrix(browser, routeType) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
      const diag = diagnostics(page);
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      let frame;
      let shell = null;
      if (routeType === 'raw') {
        await page.goto(`${baseUrl}${rawRoute}`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => Boolean(window._mutineReady));
        frame = page;
      } else {
        await page.goto(`${baseUrl}${canonicalRoute}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
        await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((iframe) => iframe.contentWindow?._mutineReady));
        shell = await shellState(page);
        frame = page.frames().find((candidate) => candidate.url().includes('/studies/pure-svg/v029/'));
      }
      const tableau = await fieldState(frame);
      await page.screenshot({ path: resolve(proofDir, `${routeType}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
      results.push({ routeType, viewport: viewport.join('x'), reducedMotion, shell, tableau, diagnostics: diag });
      await page.close();
    }
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openRaw(page);
  const field = page.locator('#field');
  await field.focus();
  const initial = await fieldState(page);

  await page.keyboard.press('Enter');
  const keyboardArmed = await fieldState(page);
  await page.keyboard.press('Enter');
  const keyboardFused = await fieldState(page);
  await page.keyboard.press('Delete');
  const keyboardLift = await fieldState(page);
  await page.keyboard.press('Escape');
  const keyboardRelease = await fieldState(page);

  const box = await field.boundingBox();
  await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.34);
  const pointerArmed = await fieldState(page);
  await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.68);
  const pointerFused = await fieldState(page);
  const afterPointer = pointerFused.signature;
  await page.getByRole('button', { name: 'lift latest' }).click();
  const buttonLift = await fieldState(page);
  await page.getByRole('button', { name: 'offer another place' }).click();
  const buttonArmed = await fieldState(page);
  await page.getByRole('button', { name: 'answer the offered place' }).click();
  const buttonFused = await fieldState(page);

  await page.getByRole('button', { name: 'release' }).click();
  const released = await fieldState(page);
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, keyboardArmed, keyboardFused, keyboardLift, keyboardRelease, pointerArmed, pointerFused, afterPointer, buttonLift, buttonArmed, buttonFused, released, diagnostics: diag };
}

async function runSamePlace(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await openRaw(page);
  const field = page.locator('#field');
  const box = await field.boundingBox();
  await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.34);
  const armed = await fieldState(page);
  await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.34);
  const refused = await fieldState(page);

  await page.close();
  return { armed, refused, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v029/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window._mutineReady));
  const evidence = await fieldState(page);
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, route, marker) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2, h3')?.textContent?.trim() ?? null
  }));
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsCount(result) {
  const diagnostics = result.diagnostics ?? result;
  return diagnostics.consoleMessages.length + diagnostics.pageErrors.length + diagnostics.failedRequests.length + diagnostics.badResponses.length;
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  if (localMode) await new Promise((listen) => server.listen(port, '127.0.0.1', listen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const rawMatrix = await runMatrix(browser, 'raw');
  const canonicalMatrix = await runMatrix(browser, 'canonical');
  const interaction = await runInteraction(browser);
  const samePlace = await runSamePlace(browser);
  const blind = await runBlind(browser);
  const readbacks = {
    journal: await runReadback(browser, '/journal/', '#journal-svg-2026-10-12'),
    current: await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-12"]'),
    canonical: await runReadback(browser, canonicalRoute, '[data-catalog-work-detail="svg-2026-10-12"]')
  };
  await browser.close();
  if (localMode) server.close();

  const matrix = [...rawMatrix, ...canonicalMatrix];
  const matrixFailures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const tableau = result.tableau;
    const shell = result.shell;
    return (result.routeType === 'raw' && (tableau.innerWidth !== target || tableau.clientWidth !== target || tableau.scrollWidth > target)) || tableau.innerWidth !== tableau.clientWidth || tableau.scrollWidth > tableau.clientWidth || tableau.cellCount !== 9 || tableau.pathCount !== 9 || (shell && (shell.innerWidth !== target || shell.clientWidth !== target || shell.scrollWidth > target || !shell.tableauFirst)) || diagnosticsCount(result);
  });
  const interactionOk = interaction.initial.memory === 0
    && interaction.keyboardArmed.memory === 0
    && interaction.keyboardArmed.interaction === 'first-place-armed'
    && interaction.keyboardFused.memory === 1
    && interaction.keyboardFused.signature !== interaction.initial.signature
    && interaction.keyboardLift.memory === 0
    && interaction.keyboardRelease.memory === 0
    && interaction.pointerArmed.memory === 0
    && interaction.pointerFused.memory === 1
    && interaction.buttonLift.memory === 0
    && interaction.buttonArmed.memory === 0
    && interaction.buttonArmed.interaction === 'first-place-armed'
    && interaction.buttonFused.memory === 1
    && interaction.released.memory === 0;
  const samePlaceOk = samePlace.armed.memory === 0 && samePlace.refused.memory === 0 && samePlace.refused.interaction === 'fusion-refused-same-place';
  const blindOk = blind.evidence.cellCount === 9 && blind.evidence.pathCount === 9 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.scrollWidth === blind.evidence.clientWidth;
  const diagnosticsTotal = [...matrix, interaction, samePlace, blind, ...Object.values(readbacks)].reduce((total, result) => total + diagnosticsCount(result), 0);
  const report = {
    baseUrl,
    localMode,
    rawMatrix,
    canonicalMatrix,
    interaction,
    samePlace,
    blind,
    readbacks,
    summary: {
      rawRuns: rawMatrix.length,
      canonicalRuns: canonicalMatrix.length,
      matrixFailures: matrixFailures.length,
      diagnosticTotal: diagnosticsTotal,
      screenshotCount: rawMatrix.length + canonicalMatrix.length + 3
    }
  };
  await writeFile(resolve(proofDir, `${localMode ? 'local' : 'production'}-results.json`), JSON.stringify(report, null, 2));
  if (matrixFailures.length || diagnosticsTotal || !interactionOk || !samePlaceOk || !blindOk) {
    console.error(JSON.stringify({ matrixFailures, interaction, samePlace, blind, readbacks, summary: report.summary }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ...report.summary, interactionOk, samePlaceOk, blindOk }, null, 2));
  }
}

main().catch((error) => {
  if (localMode) server.close();
  console.error(error);
  process.exitCode = 1;
});
