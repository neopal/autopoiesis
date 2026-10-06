import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4235;
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/pure-svg-v024-2026-10-06');
const scratchDir = resolve('C:/Users/ASUS/AppData/Local/hermes/profiles/autopoiesis/cache/scratch');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png'
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
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
  raw: '/studies/pure-svg/v024/?preview=1&interaction=1',
  canonical: '/works/svg-2026-10-06/'
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
  return page.frames().find((frame) => frame.url().includes('/studies/pure-svg/v024/'));
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
      spliceCount: Number(field?.dataset.spliceCount ?? -1),
      portCount: Number(field?.dataset.portCount ?? -1),
      pathCount: field?.querySelectorAll('path.knot').length ?? 0,
      fillRule: field?.querySelector('path.knot')?.getAttribute('fill-rule') ?? null,
      touchControls: controls.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)) })),
      readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
      controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display
    };
  });
  return { targetViewport: viewport.join('x'), reducedMotion, shell, tableau };
}

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) {
    for (const [routeName, route] of Object.entries(routes)) {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
        const diag = diagnostics(page);
        await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
        await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
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

function state(frame) {
  return frame.evaluate(() => {
    const field = document.querySelector('#field');
    return {
      memory: Number(field.dataset.memory),
      splices: Number(field.dataset.spliceCount),
      armed: field.dataset.armed,
      signature: field.dataset.signature,
      interaction: field.dataset.interaction,
      notice: field.dataset.notice
    };
  });
}

async function clickPort(page, index) {
  const centers = [[212, 262], [338, 184], [506, 192], [720, 246], [764, 402], [548, 484], [278, 448]];
  const box = await page.locator('#field').boundingBox();
  const [x, y] = centers[index];
  await page.mouse.click(box.x + (x / 1000) * box.width, box.y + (y / 680) * box.height);
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`http://127.0.0.1:${port}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const initial = await state(page);
  await clickPort(page, 1);
  const firstWitness = await state(page);
  await clickPort(page, 5);
  const pointerPair = await state(page);
  await page.locator('#field').focus();
  await page.keyboard.press('Delete');
  const lifted = await state(page);
  await page.locator('#field').focus();
  await page.keyboard.press('3');
  const armed = await state(page);
  await page.keyboard.press('Enter');
  const keyboardPair = await state(page);
  await page.keyboard.press('Delete');
  const afterKeyboardLift = await state(page);
  await page.getByRole('button', { name: 'splice two witnesses' }).click();
  const buttonPair = await state(page);
  await page.locator('#field').focus();
  await page.keyboard.press('r');
  const released = await state(page);
  await clickPort(page, 2);
  await clickPort(page, 2);
  const samePort = await state(page);
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, firstWitness, pointerPair, lifted, armed, keyboardPair, afterKeyboardLift, buttonPair, released, samePort, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/studies/pure-svg/v024/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const evidence = await page.evaluate(() => ({
    fieldVisible: getComputedStyle(document.querySelector('#field')).display !== 'none',
    portCount: Number(document.querySelector('#field').dataset.portCount),
    memory: Number(document.querySelector('#field').dataset.memory),
    pathCount: document.querySelectorAll('#field path.knot').length,
    fillRule: document.querySelector('#field path.knot')?.getAttribute('fill-rule'),
    readoutDisplay: getComputedStyle(document.querySelector('.field-readout')).display,
    controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display,
    marksDisplay: (() => { const node = document.querySelector('.port-mark'); return node ? getComputedStyle(node).display : 'none'; })(),
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

async function runReadback(browser, path, marker) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const evidence = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.querySelector('h1, h2')?.textContent?.trim() ?? null,
    recordAnchor: Boolean(document.querySelector('#journal-svg-2026-10-06, [data-work-id="svg-2026-10-06"]'))
  }));
  await page.screenshot({ path: resolve(proofDir, `${path.replaceAll('/', '_') || 'root'}-390x844.png`), fullPage: true });
  await page.close();
  return { evidence, diagnostics: diag };
}

function cleanDiagnostics(results) {
  return results.flatMap((result) => [result.diagnostics]).every((diag) => !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length);
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  await mkdir(scratchDir, { recursive: true });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-svg-2026-10-06');
  const current = await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-06"]');
  const canonical = await runReadback(browser, '/works/svg-2026-10-06/', '[data-catalog-work-detail="svg-2026-10-06"]');
  await browser.close();
  server.close();

  const failures = matrix.filter((result) => {
    const target = Number(result.viewport.split('x')[0]);
    const evidence = result.evidence;
    return evidence.shell.innerWidth !== target
      || evidence.shell.scrollWidth > evidence.shell.innerWidth
      || evidence.tableau.scrollWidth > evidence.tableau.innerWidth
      || evidence.tableau.portCount !== 7
      || evidence.tableau.pathCount !== 1
      || evidence.tableau.fillRule !== 'evenodd'
      || (result.routeName === 'canonical' && !evidence.shell.tableauFirst)
      || evidence.tableau.touchControls.some((control) => control.height < 44)
      || !cleanDiagnostics([result]);
  });
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, canonical, proofDir, scratchDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  const interactionOk = interaction.initial.memory === 0
    && interaction.firstWitness.memory === 0
    && interaction.firstWitness.armed !== ''
    && interaction.pointerPair.memory === 1
    && interaction.pointerPair.signature !== interaction.initial.signature
    && interaction.lifted.memory === 0
    && interaction.armed.memory === 0
    && interaction.keyboardPair.memory === 1
    && interaction.afterKeyboardLift.memory === 0
    && interaction.buttonPair.memory === 1
    && interaction.released.memory === 0
    && interaction.samePort.memory === 0
    && interaction.samePort.interaction === 'same-witness-refused'
    && interaction.buttons.every((button) => button.height >= 44)
    && cleanDiagnostics([interaction]);
  const blindOk = blind.evidence.fieldVisible
    && blind.evidence.portCount === 7
    && blind.evidence.memory === 4
    && blind.evidence.pathCount === 1
    && blind.evidence.fillRule === 'evenodd'
    && blind.evidence.readoutDisplay === 'none'
    && blind.evidence.controlsDisplay === 'none'
    && blind.evidence.marksDisplay === 'none'
    && blind.evidence.innerWidth === blind.evidence.clientWidth
    && blind.evidence.scrollWidth <= blind.evidence.innerWidth
    && cleanDiagnostics([blind]);
  const readbacksOk = [journal, current, canonical].every((entry) => entry.evidence.recordAnchor && entry.evidence.innerWidth === entry.evidence.clientWidth && entry.evidence.scrollWidth <= entry.evidence.innerWidth && cleanDiagnostics([entry]));
  if (failures.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

main().catch(async (error) => {
  server.close();
  await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error));
  console.error(error.stack || error);
  process.exitCode = 1;
});
