import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.MUTINE_BASE_URL ?? 'http://127.0.0.1:4177';
const proofDir = resolve(process.env.MUTINE_PROBE_PROOF_DIR ?? 'research/qa/proofs/handwriting-v042-2026-11-04');
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const rawPath = '/studies/handwriting/v042/?preview=1&interaction=1';
const canonicalPath = '/works/typography-2026-11-04/';
const results = { baseUrl, viewports, rawPath, canonicalPath, matrix: [], interaction: null, readbacks: null, failures: [] };

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

function diagnostics(page) {
  const entries = [];
  page.on('console', (message) => { if (message.type() === 'error') entries.push(`console:${message.text()}`); });
  page.on('pageerror', (error) => entries.push(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => entries.push(`request:${request.url()}:${request.failure()?.errorText ?? 'failed'}`));
  return entries;
}

async function waitReady(page) {
  await page.waitForFunction(() => window._mutineReady === true, null, { timeout: 10000 });
}

async function rawEvidence(page, targetViewport, reducedMotion) {
  return page.evaluate(({ targetViewport, reducedMotion }) => {
    const svg = document.querySelector('#ligature-svg');
    const field = document.querySelector('#ligature-field');
    const state = window.__mutineHandwritingV042?.getState();
    const buttons = [...document.querySelectorAll('.ligature-controls button')];
    return {
      targetViewport,
      reducedMotion,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      field: field ? { width: Number(field.getBoundingClientRect().width.toFixed(2)), height: Number(field.getBoundingClientRect().height.toFixed(2)) } : null,
      svg: svg ? { width: Number(svg.getBoundingClientRect().width.toFixed(2)), height: Number(svg.getBoundingClientRect().height.toFixed(2)), strokeCount: svg.querySelectorAll('[data-stroke-id]').length, mouthCount: svg.querySelectorAll('.mouth-group').length } : null,
      minTouchTarget: buttons.length ? Math.min(...buttons.map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))) : null,
      state: state ? { memory: state.memory.length, pending: state.pending.length, geometry: state.field.signature } : null
    };
  }, { targetViewport, reducedMotion });
}

async function canonicalEvidence(page, targetViewport, reducedMotion) {
  await page.waitForSelector('[data-catalog-work-detail="typography-2026-11-04"]', { timeout: 10000 });
  let tableau = null;
  for (let attempt = 0; attempt < 100 && !tableau; attempt += 1) {
    tableau = page.frames().find((frame) => frame.url().includes('/studies/handwriting/v042/')) ?? null;
    if (!tableau) await page.waitForTimeout(100);
  }
  if (!tableau) throw new Error('canonical tableau iframe not found');
  await waitReady(tableau);
  const evidence = await rawEvidence(tableau, targetViewport, reducedMotion);
  const shell = await page.evaluate(() => {
    const iframe = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      iframeTop: iframe ? Number(iframe.getBoundingClientRect().top.toFixed(2)) : null,
      headingTop: heading ? Number(heading.getBoundingClientRect().top.toFixed(2)) : null,
      tableauFirst: Boolean(iframe && (!heading || iframe.getBoundingClientRect().top < heading.getBoundingClientRect().top))
    };
  });
  return { ...evidence, shell };
}

async function getPortPoint(page, id) {
  return page.locator(`.mouth-group[data-port-id="${id}"]`).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}

async function runInteraction() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${rawPath}`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const quiet = await page.evaluate(() => JSON.parse(JSON.stringify(window.__mutineHandwritingV042.getState())));
  const start = await getPortPoint(page, 1);
  const end = await getPortPoint(page, 5);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 3 });
  await page.mouse.move(end.x, end.y, { steps: 3 });
  await page.mouse.up();
  const committed = await page.evaluate(() => JSON.parse(JSON.stringify(window.__mutineHandwritingV042.getState())));
  const sourceExact = [1, 5].every((id) => JSON.stringify(committed.field.strokes[id]) === JSON.stringify(quiet.field.strokes[id]));
  const remoteOnly = committed.changedStrokeIds.length >= 2 && committed.changedStrokeIds.every((id) => ![1, 5].includes(id));
  await page.keyboard.press('Delete');
  const lifted = await page.evaluate(() => JSON.stringify(window.__mutineHandwritingV042.getState().field.signature));
  const quietSignature = JSON.stringify(quiet.field.signature);

  const blank = { x: 195, y: 422 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(blank.x, blank.y, { steps: 2 });
  await page.mouse.up();
  const refused = await page.evaluate(() => {
    const state = window.__mutineHandwritingV042.getState();
    return { memory: state.memory.length, geometry: state.field.signature };
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const keyboard = await page.evaluate(() => {
    const state = window.__mutineHandwritingV042.getState();
    return { memory: state.memory.length, pending: state.pending.length, changedStrokeIds: state.changedStrokeIds };
  });
  await page.keyboard.press('Escape');

  const touchStart = await getPortPoint(page, 2);
  const touchEnd = await getPortPoint(page, 6);
  const touch = await page.evaluate(({ start, end }) => {
    const target = document.querySelector('#ligature-field');
    const event = (type, point) => new PointerEvent(type, { bubbles: true, clientX: point.x, clientY: point.y, pointerId: 17, pointerType: 'touch', isPrimary: true });
    target.dispatchEvent(event('pointerdown', start));
    target.dispatchEvent(event('pointerup', end));
    const state = window.__mutineHandwritingV042.getState();
    return { memory: state.memory.length, pending: state.pending.length };
  }, { start: touchStart, end: touchEnd });

  results.interaction = {
    diagnostics: diag,
    pointer: { committed: committed.memory.length === 1 && committed.field.signature !== quiet.field.signature, sourceExact, remoteOnly, changedStrokeIds: committed.changedStrokeIds },
    lift: { exact: lifted === quietSignature },
    refusedBlank: { geometryNeutral: refused.memory === 0 && refused.geometry === quiet.field.signature },
    keyboard: { committed: keyboard.memory === 1 && keyboard.pending === 0, changedStrokeIds: keyboard.changedStrokeIds },
    touch: { committed: touch.memory === 1 && touch.pending === 0 }
  };
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v042-interaction-390x844.png'), fullPage: true });
  await page.close();
}

for (const reducedMotion of [false, true]) {
  for (const route of [{ name: 'raw', path: rawPath }, { name: 'canonical', path: canonicalPath }]) {
    for (const [width, height] of viewports) {
      const page = await browser.newPage({ viewport: { width, height } });
      const diag = diagnostics(page);
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'domcontentloaded' });
      let evidence;
      if (route.name === 'raw') {
        await waitReady(page);
        evidence = await rawEvidence(page, `${width}x${height}`, reducedMotion);
      } else {
        evidence = await canonicalEvidence(page, `${width}x${height}`, reducedMotion);
      }
      results.matrix.push({ route: route.name, ...evidence, diagnostics: diag });
      await page.screenshot({ path: resolve(proofDir, `handwriting-v042-${route.name}-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`), fullPage: true });
      await page.close();
    }
  }
}

async function runBlind() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const diag = diagnostics(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/studies/handwriting/v042/?preview=1&static=1&blind=1`, { waitUntil: 'domcontentloaded' });
  await waitReady(page);
  const settled = await page.evaluate(() => {
    for (let index = 0; index < 4; index += 1) window.__mutineHandwritingV042.bindDeterministic();
    const state = window.__mutineHandwritingV042.getState();
    const controls = document.querySelector('.ligature-controls');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      memory: state.memory.length,
      strokeCount: document.querySelectorAll('[data-stroke-id]').length,
      controlsHidden: controls ? getComputedStyle(controls).display === 'none' : false
    };
  });
  results.blind = { ...settled, diagnostics: diag };
  await page.screenshot({ path: resolve(proofDir, 'handwriting-v042-blind-390x844.png'), fullPage: true });
  await page.close();
}

await runInteraction();
await runBlind();

async function fetchReadback(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { path, status: response.status, text };
}

const sourceJson = await fetchReadback('/studio/data/works.json');
const publicJson = await fetchReadback('/studio/data/catalog-public.json');
const favicon = await fetchReadback('/studio/favicon.svg');
const readbackPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await readbackPage.goto(`${baseUrl}/journal/`, { waitUntil: 'domcontentloaded' });
await readbackPage.waitForSelector('#journal-typography-2026-11-04', { timeout: 10000 });
const journalAnchorCount = await readbackPage.locator('#journal-typography-2026-11-04').count();
const journalText = await readbackPage.locator('#journal-typography-2026-11-04').innerText();
await readbackPage.goto(`${baseUrl}/currents/handwriting/`, { waitUntil: 'domcontentloaded' });
await readbackPage.waitForSelector('.catalog-current-header__title', { timeout: 10000 });
const currentText = await readbackPage.locator('.catalog-current-header__title').innerText();
await readbackPage.close();
const sourcePayload = JSON.parse(sourceJson.text);
const publicPayload = JSON.parse(publicJson.text);
results.readbacks = {
  works: { status: sourceJson.status, matches: sourcePayload.works.filter((work) => work.id === 'typography-2026-11-04').length },
  publicCatalog: { status: publicJson.status, matches: publicPayload.works.works.filter((work) => work.id === 'typography-2026-11-04').length },
  journal: { status: 200, hasAnchor: journalAnchorCount === 1, hasTitle: journalText.includes('The mouth becomes a hinge.') },
  current: { status: 200, hasTitle: currentText === 'Handwriting' },
  favicon: { status: favicon.status }
};
await browser.close();

const failures = [];
for (const entry of results.matrix) {
  const shell = entry.shell ?? entry;
  if (shell.innerWidth !== Number(entry.targetViewport.split('x')[0]) || shell.clientWidth !== shell.innerWidth || shell.scrollWidth > shell.innerWidth) failures.push(`${entry.route} viewport ${entry.targetViewport} invalid or overflowing`);
  if (entry.route === 'canonical' && !shell.tableauFirst) failures.push(`canonical tableau-first order failed at ${entry.targetViewport}`);
  if (!entry.svg || entry.svg.strokeCount !== 8 || entry.svg.mouthCount !== 8) failures.push(`${entry.route} tableau structure failed at ${entry.targetViewport}`);
  if ((entry.minTouchTarget ?? 0) < 44) failures.push(`touch target below 44px at ${entry.route} ${entry.targetViewport}`);
  if (entry.diagnostics.length) failures.push(`diagnostics at ${entry.route} ${entry.targetViewport}: ${entry.diagnostics.join('; ')}`);
}
if (!results.readbacks || results.readbacks.works.status !== 200 || results.readbacks.works.matches !== 1 || results.readbacks.publicCatalog.status !== 200 || results.readbacks.publicCatalog.matches !== 1 || !results.readbacks.journal.hasAnchor || !results.readbacks.journal.hasTitle || !results.readbacks.current.hasTitle || results.readbacks.favicon.status !== 200) failures.push('readback content failure');
if (!results.blind || results.blind.innerWidth !== 390 || results.blind.clientWidth !== 390 || results.blind.scrollWidth > 390 || results.blind.memory !== 4 || results.blind.strokeCount !== 8 || !results.blind.controlsHidden || results.blind.diagnostics.length) failures.push('blind preview evidence failed');
const interactionValues = results.interaction ? [
  ['pointer commit', results.interaction.pointer.committed],
  ['source exact', results.interaction.pointer.sourceExact],
  ['remote only', results.interaction.pointer.remoteOnly],
  ['exact lift', results.interaction.lift.exact],
  ['incomplete refusal', results.interaction.refusedBlank.geometryNeutral],
  ['keyboard commit', results.interaction.keyboard.committed],
  ['touch commit', results.interaction.touch.committed],
  ['interaction diagnostics', results.interaction.diagnostics.length === 0]
] : [];
for (const [label, passed] of interactionValues) if (!passed) failures.push(`interaction ${label} failed`);
results.failures = failures;
await writeFile(resolve(proofDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ baseUrl, matrixRuns: results.matrix.length, interaction: results.interaction, failures }, null, 2));
if (failures.length) process.exitCode = 1;
