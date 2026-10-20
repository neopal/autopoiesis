import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4293;
const baseUrl = process.env.MUTINE_PROBE_BASE_URL ?? `http://127.0.0.1:${port}`;
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v033-2026-10-20');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/p5-brush/v033/?preview=1&interaction=1', canonical: '/works/brush-2026-10-20/' };

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

function diagnosticsOk(diag) {
  return !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length;
}

async function getTableau(page, canonical) {
  if (canonical) {
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForFunction(() => [...document.querySelectorAll('.work-inspect__stage iframe')].some((frame) => frame.contentWindow?.__mutineBrushV033));
    return page.frames().find((frame) => frame.url().includes('/studies/p5-brush/v033/'));
  }
  await page.waitForFunction(() => Boolean(window.__mutineBrushV033));
  return page;
}

async function shellEvidence(page, canonical, viewport) {
  return page.evaluate(({ isCanonical, targetViewport }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      targetViewport,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)),
      ready: document.querySelector('[data-catalog-work-detail]')?.dataset.ready ?? null
    };
  }, { isCanonical: canonical, targetViewport: viewport.join('x') });
}

async function tableauEvidence(frame, viewport, reduced) {
  return frame.evaluate(({ targetViewport, reducedMotion }) => {
    const field = document.querySelector('#seam-field');
    const svg = document.querySelector('#field');
    const buttons = [...document.querySelectorAll('.seam-controls button')];
    const state = window.__mutineBrushV033.getFrame();
    return {
      targetViewport,
      reducedMotion,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      svg: svg ? { width: Number(svg.getBoundingClientRect().width.toFixed(2)), height: Number(svg.getBoundingClientRect().height.toFixed(2)) } : null,
      state: { stage: state.stage, memory: state.memory.length, pending: state.pending.length, interaction: state.interaction, plateCount: state.plates.length, event: state.event ? { affected: state.event.affected, entryIndex: state.event.entryIndex } : null },
      controls: buttons.map((button) => ({ text: button.textContent.trim(), height: Number(button.getBoundingClientRect().height.toFixed(2)) })),
      readoutDisplay: getComputedStyle(document.querySelector('.seam-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.seam-controls')).display,
      hintDisplay: getComputedStyle(document.querySelector('.seam-hint')).display
    };
  }, { targetViewport: viewport.join('x'), reducedMotion: reduced });
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
        const tableau = await getTableau(page, routeName === 'canonical');
        const shell = await shellEvidence(page, routeName === 'canonical', viewport);
        const evidence = await tableauEvidence(tableau, viewport, reducedMotion);
        await page.screenshot({ path: resolve(proofDir, `brush-v033-${routeName}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
        results.push({ routeName, viewport: viewport.join('x'), reducedMotion, shell, tableau: evidence, diagnostics: diag });
        await page.close();
      }
    }
  }
  return results;
}

async function frameState(frame) {
  return frame.evaluate(() => {
    const state = window.__mutineBrushV033.getFrame();
    return { stage: state.stage, memory: state.memory.length, pending: state.pending.length, interaction: state.interaction, signature: window.__mutineBrushV033.geometrySignature() };
  });
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'domcontentloaded' });
  const initial = await frameState(page);
  const box = await page.locator('#field').boundingBox();
  const tap = async (x, y) => {
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
  };
  await tap(0.28, 0.28);
  const armedOne = await frameState(page);
  await tap(0.52, 0.48);
  const armedTwo = await frameState(page);
  await tap(0.75, 0.72);
  const committed = await frameState(page);
  const committedSignature = committed.signature;
  await page.locator('#lift-control').click();
  const lifted = await frameState(page);
  await page.locator('#knock-control').click();
  const button = await frameState(page);
  await page.locator('#seam-field').focus();
  await page.keyboard.press('Delete');
  const afterDelete = await frameState(page);
  await page.keyboard.press('Enter');
  const keyboard = await frameState(page);
  await page.keyboard.press('Escape');
  const released = await frameState(page);
  const buttons = await page.locator('.seam-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent.trim(), height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'brush-v033-interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, armedOne, armedTwo, committed, committedSignature, lifted, button, afterDelete, keyboard, released, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/p5-brush/v033/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__mutineBrushV033));
  const evidence = await page.evaluate(() => {
    const state = window.__mutineBrushV033.getFrame();
    return {
      fieldVisible: getComputedStyle(document.querySelector('#seam-field')).display !== 'none',
      svgVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
      state: { stage: state.stage, memory: state.memory.length, plateCount: state.plates.length, signature: window.__mutineBrushV033.geometrySignature().slice(0, 32) },
      readoutDisplay: getComputedStyle(document.querySelector('.seam-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.seam-controls')).display,
      hintDisplay: getComputedStyle(document.querySelector('.seam-hint')).display,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  await page.screenshot({ path: resolve(proofDir, 'brush-v033-blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, route, marker, filename) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2, h3')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-brush-2026-10-20, [data-work-id="brush-2026-10-20"], [data-catalog-work-detail="brush-2026-10-20"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, filename), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await new Promise((resolveReady) => server.listen(port, '127.0.0.1', resolveReady));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-brush-2026-10-20', 'brush-v033-journal-390x844.png');
  const current = await runReadback(browser, '/currents/brush/', '[data-catalog-current="brush"] [data-work-id="brush-2026-10-20"]', 'brush-v033-current-390x844.png');
  const work = await runReadback(browser, '/works/brush-2026-10-20/', '[data-catalog-work-detail="brush-2026-10-20"]', 'brush-v033-work-390x844.png');
  const worksResponse = await fetch(`${baseUrl}/studio/data/works.json`);
  const works = await worksResponse.json();
  const recordCount = works.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-10-20').length;
  const faviconResponse = await fetch(`${baseUrl}/studio/favicon.svg`);
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const { shell, tableau } = result;
    return shell.innerWidth !== target || shell.clientWidth !== target || shell.scrollWidth > target || tableau.clientWidth !== tableau.innerWidth || tableau.scrollWidth > tableau.innerWidth || !tableau.state || tableau.state.plateCount !== 9 || (result.reducedMotion ? tableau.state.memory !== 4 : tableau.state.memory !== 0) || (result.routeName === 'canonical' && !shell.tableauFirst) || tableau.controls.some((control) => control.height < 44) || !diagnosticsOk(result.diagnostics);
  });
  const interactionOk = interaction.initial.memory === 0 && interaction.armedOne.pending === 1 && interaction.armedTwo.pending === 2 && interaction.armedOne.signature === interaction.initial.signature && interaction.armedTwo.signature === interaction.initial.signature && interaction.committed.memory === 1 && interaction.committed.signature !== interaction.initial.signature && interaction.lifted.signature === interaction.initial.signature && interaction.button.memory === 1 && interaction.afterDelete.memory === 0 && interaction.keyboard.memory === 1 && interaction.released.memory === 0 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.svgVisible && blind.evidence.state.memory === 4 && blind.evidence.state.plateCount === 9 && blind.evidence.readoutDisplay === 'none' && blind.evidence.controlsDisplay === 'none' && blind.evidence.hintDisplay === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth === blind.evidence.clientWidth && diagnosticsOk(blind.diagnostics);
  const readbacksOk = [journal, current, work].every((result) => result.evidence.innerWidth === result.evidence.clientWidth && result.evidence.scrollWidth === result.evidence.clientWidth && result.evidence.recordAnchor && diagnosticsOk(result.diagnostics));
  const output = {
    matrix,
    interaction,
    blind,
    journal,
    current,
    work,
    publicRecord: { status: worksResponse.status, brushDailyMatches: recordCount, totalWorks: works.works.length },
    favicon: { status: faviconResponse.status, contentType: faviconResponse.headers.get('content-type') },
    summary: { matrixRuns: matrix.length, matrixFailures: failures.length, interactionOk, blindOk, readbacksOk, publicRecordOk: worksResponse.status === 200 && recordCount === 1, faviconOk: faviconResponse.status === 200, diagnostics: matrix.filter((result) => diagnosticsOk(result.diagnostics)).length + (interactionOk ? 1 : 0) + (blindOk ? 1 : 0) + (readbacksOk ? 3 : 0) }
  };
  await writeFile(resolve(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ summary: output.summary, failures, interaction: { initial: interaction.initial, armedOne: interaction.armedOne, armedTwo: interaction.armedTwo, committed: interaction.committed, lifted: interaction.lifted, button: interaction.button, afterDelete: interaction.afterDelete, keyboard: interaction.keyboard, released: interaction.released }, blind: blind.evidence, publicRecord: output.publicRecord, favicon: output.favicon }, null, 2));
  if (failures.length || !interactionOk || !blindOk || !readbacksOk || !output.summary.publicRecordOk || faviconResponse.status !== 200) process.exitCode = 1;
}

main().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
