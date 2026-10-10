import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4281;
const baseUrl = process.env.MUTINE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROOF_DIR ?? 'research/qa/proofs/pure-svg-v028-2026-10-10');
const localMode = baseUrl.startsWith(`http://127.0.0.1:${port}`);
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

const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawRoute = '/studies/pure-svg/v028/?preview=1&interaction=1';
const canonicalRoute = '/works/svg-2026-10-10/';

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

async function openTableau(page, canonical = false) {
  if (canonical) {
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?._mutineReady));
    return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v028/'));
  }
  await page.waitForFunction(() => Boolean(window._mutineReady));
  return page;
}

async function fieldState(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      signature: field?.dataset.signature ?? null,
      memory: Number(field?.dataset.memory ?? -1),
      interaction: field?.dataset.interaction ?? null,
      plateCount: Number(field?.dataset.plateCount ?? -1),
      pathCount: field?.querySelectorAll('path[data-plate-path]').length ?? 0,
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
      controls: [...document.querySelectorAll('.field-controls button')].map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)), disabled: node.disabled }))
    };
  });
}

async function shellState(page, canonical) {
  return page.evaluate(({ isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      title: heading?.textContent?.trim() ?? null
    };
  }, { isCanonical: canonical });
}

async function runMatrix(browser, route, canonical) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
      const diag = diagnostics(page);
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      const frame = await openTableau(page, canonical);
      const shell = await shellState(page, canonical);
      const tableau = await fieldState(frame);
      await page.screenshot({ path: resolve(proofDir, `${canonical ? 'canonical' : 'raw'}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
      results.push({ route, canonical, viewport: viewport.join('x'), reducedMotion, shell, tableau, diagnostics: diag });
      await page.close();
    }
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawRoute}`, { waitUntil: 'networkidle' });
  const frame = await openTableau(page, false);
  const field = frame.locator('#field');
  await field.focus();
  const initial = await fieldState(frame);
  await page.keyboard.press('Enter');
  const keyboardDepart = await fieldState(frame);
  await page.keyboard.press('Delete');
  const keyboardLift = await fieldState(frame);
  await page.keyboard.press('Escape');
  const keyboardRelease = await fieldState(frame);
  const box = await field.boundingBox();
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.26);
  const pointerArmed = await fieldState(frame);
  await page.mouse.down();
  const pointerDown = await fieldState(frame);
  await page.mouse.up();
  const pointerDepart = await fieldState(frame);
  await frame.getByRole('button', { name: 'lift latest' }).click();
  const buttonLift = await fieldState(frame);
  await frame.getByRole('button', { name: 'leave the plate' }).click();
  const buttonDepart = await fieldState(frame);
  await frame.getByRole('button', { name: 'release' }).click();
  const released = await fieldState(frame);
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, keyboardDepart, keyboardLift, keyboardRelease, pointerArmed, pointerDown, pointerDepart, buttonLift, buttonDepart, released, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/pure-svg/v028/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await openTableau(page, false);
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
  const evidence = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null }));
  await page.close();
  return { evidence, diagnostics: diag };
}

function diagnosticsCount(results) {
  return results.reduce((count, result) => {
    const diagnostics = result.diagnostics;
    return count + diagnostics.consoleMessages.length + diagnostics.pageErrors.length + diagnostics.failedRequests.length + diagnostics.badResponses.length;
  }, 0);
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  if (localMode) await new Promise((listen) => server.listen(port, '127.0.0.1', listen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const rawMatrix = await runMatrix(browser, rawRoute, false);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const readbacks = {};
  const canonicalExists = await fetch(`${baseUrl}${canonicalRoute}`).then((response) => response.ok).catch(() => false);
  if (canonicalExists) {
    readbacks.journal = await runReadback(browser, '/journal/', '#journal-svg-2026-10-10');
    readbacks.current = await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-10"]');
    readbacks.canonical = await runReadback(browser, canonicalRoute, '[data-catalog-work-detail="svg-2026-10-10"]');
  }
  const canonicalMatrix = canonicalExists ? await runMatrix(browser, canonicalRoute, true) : [];
  await browser.close();
  if (localMode) server.close();

  const allMatrix = [...rawMatrix, ...canonicalMatrix];
  const matrixFailures = allMatrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    return result.shell.innerWidth !== target || result.shell.clientWidth !== target || result.shell.scrollWidth > target || result.tableau.innerWidth !== result.tableau.clientWidth || result.tableau.scrollWidth > result.tableau.clientWidth || result.tableau.plateCount !== 7 || result.tableau.pathCount !== 7 || (result.canonical && !result.shell.tableauFirst) || diagnosticsCount([result]) > 0;
  });
  const allResults = [...allMatrix, interaction, blind, ...Object.values(readbacks)];
  const diagnosticTotal = allResults.reduce((count, result) => count + (result.diagnostics ? diagnosticsCount([result]) : 0), 0);
  const report = {
    baseUrl,
    localMode,
    rawMatrix,
    canonicalMatrix,
    interaction,
    blind,
    readbacks,
    summary: { rawRuns: rawMatrix.length, canonicalRuns: canonicalMatrix.length, matrixFailures: matrixFailures.length, diagnosticTotal, screenshotCount: rawMatrix.length + canonicalMatrix.length + 2, canonicalExists }
  };
  await writeFile(resolve(proofDir, `${localMode ? 'local' : 'production'}-results.json`), JSON.stringify(report, null, 2));

  const interactionOk = interaction.initial.memory === 0
    && interaction.keyboardDepart.memory === 1
    && interaction.keyboardLift.memory === 0
    && interaction.keyboardRelease.memory === 0
    && interaction.pointerArmed.memory === 0
    && interaction.pointerArmed.interaction === 'attention-armed'
    && interaction.pointerDown.memory === 0
    && interaction.pointerDepart.memory === 1
    && interaction.buttonLift.memory === 0
    && interaction.buttonDepart.memory === 1
    && interaction.released.memory === 0
    && interaction.pointerDepart.signature !== interaction.initial.signature;
  const blindOk = blind.evidence.plateCount === 7 && blind.evidence.pathCount === 7 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.scrollWidth === blind.evidence.clientWidth;
  if (matrixFailures.length || diagnosticTotal || !interactionOk || !blindOk || (canonicalExists && canonicalMatrix.length !== 10)) {
    console.error(JSON.stringify({ matrixFailures, interaction, blind, readbacks, summary: report.summary }, null, 2));
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
