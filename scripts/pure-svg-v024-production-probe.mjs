import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = resolve('C:/Users/ASUS/autopoiesis/research/qa/proofs/pure-svg-v024-2026-10-06-production');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const routes = { raw: '/studies/pure-svg/v024/?preview=1&interaction=1', canonical: '/works/svg-2026-10-06/' };

function diagnostics(page) {
  const result = { consoleMessages: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on('console', (message) => result.consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('requestfailed', (request) => result.failedRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
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

async function evidence(page, frame, canonical, viewport, reducedMotion) {
  const shell = await page.evaluate(({ canonical: isCanonical }) => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    const mount = document.querySelector('[data-catalog-work-detail]');
    return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, tableauFirst: !isCanonical || Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top)), mountReady: mount?.dataset.ready ?? null };
  }, { canonical });
  const tableau = await frame.evaluate(() => {
    const field = document.querySelector('#field');
    const controls = [...document.querySelectorAll('.field-controls button')];
    return { innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, signature: field?.dataset.signature ?? null, memory: Number(field?.dataset.memory ?? -1), portCount: Number(field?.dataset.portCount ?? -1), pathCount: field?.querySelectorAll('path.knot').length ?? 0, fillRule: field?.querySelector('path.knot')?.getAttribute('fill-rule') ?? null, controls: controls.map((node) => Number(node.getBoundingClientRect().height.toFixed(2))), readout: getComputedStyle(document.querySelector('.field-readout')).display, controlsDisplay: getComputedStyle(document.querySelector('.field-controls')).display };
  });
  return { viewport: viewport.join('x'), reducedMotion, shell, tableau };
}

function diagnosticsOk(diag) { return !diag.consoleMessages.length && !diag.pageErrors.length && !diag.failedRequests.length && !diag.badResponses.length; }
function frameState(frame) { return frame.evaluate(() => { const field = document.querySelector('#field'); return { memory: Number(field.dataset.memory), armed: field.dataset.armed, signature: field.dataset.signature, interaction: field.dataset.interaction, notice: field.dataset.notice }; }); }
async function clickPort(page, index) { const centers = [[212, 262], [338, 184], [506, 192], [720, 246], [764, 402], [548, 484], [278, 448]]; const box = await page.locator('#field').boundingBox(); const [x, y] = centers[index]; await page.mouse.click(box.x + x / 1000 * box.width, box.y + y / 680 * box.height); }

async function runMatrix(browser) {
  const results = [];
  for (const reducedMotion of [false, true]) for (const [name, route] of Object.entries(routes)) for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport[0], height: viewport[1] } });
    const diag = diagnostics(page);
    await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    const frame = await waitForTableau(page, name === 'canonical');
    const item = { name, route, evidence: await evidence(page, frame, name === 'canonical', viewport, reducedMotion), diagnostics: diag };
    await page.screenshot({ path: resolve(proofDir, `${name}-${viewport[0]}x${viewport[1]}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
    results.push(item);
    await page.close();
  }
  return results;
}

async function runInteraction(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base + routes.raw, { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const initial = await frameState(page);
  await clickPort(page, 1); const firstWitness = await frameState(page);
  await clickPort(page, 5); const pair = await frameState(page);
  await page.locator('#field').focus(); await page.keyboard.press('Delete'); const lifted = await frameState(page);
  await page.locator('#field').focus(); await page.keyboard.press('3'); const armed = await frameState(page);
  await page.keyboard.press('Enter'); const keyboard = await frameState(page);
  await page.keyboard.press('Delete'); const keyboardLift = await frameState(page);
  await page.getByRole('button', { name: 'splice two witnesses' }).click(); const button = await frameState(page);
  await page.locator('#field').focus(); await page.keyboard.press('r'); const released = await frameState(page);
  const buttons = await page.locator('.field-controls button').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, height: Number(node.getBoundingClientRect().height.toFixed(2)) })));
  await page.screenshot({ path: resolve(proofDir, 'interaction-390x844.png'), fullPage: true });
  await page.close();
  return { initial, firstWitness, pair, lifted, armed, keyboard, keyboardLift, button, released, buttons, diagnostics: diag };
}

async function runBlind(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/studies/pure-svg/v024/?preview=1&static=1&blind=1', { waitUntil: 'networkidle' });
  await waitForTableau(page, false);
  const result = await page.evaluate(() => { const field = document.querySelector('#field'); return { fieldVisible: getComputedStyle(field).display !== 'none', memory: Number(field.dataset.memory), portCount: Number(field.dataset.portCount), pathCount: document.querySelectorAll('#field path.knot').length, fillRule: document.querySelector('#field path.knot')?.getAttribute('fill-rule'), readout: getComputedStyle(document.querySelector('.field-readout')).display, controls: getComputedStyle(document.querySelector('.field-controls')).display, marks: document.querySelector('.port-mark') ? getComputedStyle(document.querySelector('.port-mark')).display : 'none', innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }; });
  await page.screenshot({ path: resolve(proofDir, 'blind-390x844.png'), fullPage: true });
  await page.close();
  return { evidence: result, diagnostics: diag };
}

async function runReadback(browser, path, marker, screenshot) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForSelector(marker);
  const result = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('h1, h2')?.textContent?.trim() ?? null, recordAnchor: Boolean(document.querySelector('#journal-svg-2026-10-06, [data-work-id="svg-2026-10-06"]')) }));
  await page.screenshot({ path: resolve(proofDir, screenshot), fullPage: true });
  await page.close();
  return { evidence: result, diagnostics: diag };
}

async function main() {
  await mkdir(proofDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const matrix = await runMatrix(browser);
  const interaction = await runInteraction(browser);
  const blind = await runBlind(browser);
  const journal = await runReadback(browser, '/journal/', '#journal-svg-2026-10-06', 'journal-390x844.png');
  const current = await runReadback(browser, '/currents/pure-svg/', '[data-catalog-current="svg"] [data-work-id="svg-2026-10-06"]', 'current-390x844.png');
  const work = await runReadback(browser, '/works/svg-2026-10-06/', '[data-catalog-work-detail="svg-2026-10-06"]', 'work-390x844.png');
  await browser.close();
  const failures = matrix.filter((item) => { const target = Number(item.evidence.viewport.split('x')[0]); const { shell, tableau } = item.evidence; return shell.innerWidth !== target || shell.scrollWidth > shell.innerWidth || tableau.scrollWidth > tableau.innerWidth || tableau.portCount !== 7 || tableau.pathCount !== 1 || tableau.fillRule !== 'evenodd' || (item.name === 'canonical' && !shell.tableauFirst) || tableau.controls.some((height) => height < 44) || !diagnosticsOk(item.diagnostics); });
  const interactionOk = interaction.initial.memory === 0 && interaction.firstWitness.memory === 0 && interaction.firstWitness.armed !== '' && interaction.pair.memory === 1 && interaction.pair.signature !== interaction.initial.signature && interaction.lifted.memory === 0 && interaction.keyboard.memory === 1 && interaction.keyboardLift.memory === 0 && interaction.button.memory === 1 && interaction.released.memory === 0 && interaction.buttons.every((button) => button.height >= 44) && diagnosticsOk(interaction.diagnostics);
  const blindOk = blind.evidence.fieldVisible && blind.evidence.memory === 4 && blind.evidence.portCount === 7 && blind.evidence.pathCount === 1 && blind.evidence.fillRule === 'evenodd' && blind.evidence.readout === 'none' && blind.evidence.controls === 'none' && blind.evidence.marks === 'none' && blind.evidence.innerWidth === blind.evidence.clientWidth && blind.evidence.scrollWidth <= blind.evidence.innerWidth && diagnosticsOk(blind.diagnostics);
  const readbacks = [journal, current, work];
  const readbacksOk = readbacks.every((entry) => entry.evidence.recordAnchor && entry.evidence.innerWidth === entry.evidence.clientWidth && entry.evidence.scrollWidth <= entry.evidence.innerWidth && diagnosticsOk(entry.diagnostics));
  const summary = { matrixRuns: matrix.length, matrixFailures: failures, interaction, blind, journal, current, work, proofDir };
  await writeFile(resolve(proofDir, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length || !interactionOk || !blindOk || !readbacksOk) process.exitCode = 1;
}

main().catch(async (error) => { await mkdir(proofDir, { recursive: true }); await writeFile(resolve(proofDir, 'error.txt'), error.stack || String(error)); console.error(error.stack || error); process.exitCode = 1; });
