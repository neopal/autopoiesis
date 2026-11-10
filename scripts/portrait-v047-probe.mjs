import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PORTRAIT_V047_BASE_URL ?? 'http://127.0.0.1:4177';
const proofDir = path.resolve(process.env.PORTRAIT_V047_PROOF_DIR ?? 'research/qa/proofs/portrait-v047-2026-11-10-local');
const viewports = [
  { width: 320, height: 568, label: '320x568' },
  { width: 390, height: 844, label: '390x844' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1280, height: 800, label: '1280x800' },
  { width: 1920, height: 1080, label: '1920x1080' }
];
const routes = {
  raw: '/studies/self-portrait/v047/?preview=1&interaction=1',
  canonical: '/works/portrait-2026-11-10/'
};

await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PORTRAIT_V047_CHROME ? { executablePath: process.env.PORTRAIT_V047_CHROME } : {})
});
const runs = [];
const diagnostics = [];
const badResponses = [];

function attachDiagnostics(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`${label}:console:${message.text()}`);
  });
  page.on('pageerror', (error) => diagnostics.push(`${label}:pageerror:${error.message}`));
  page.on('requestfailed', (request) => diagnostics.push(`${label}:request:${request.url()} :: ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => {
    if (response.url().startsWith(baseUrl) && response.status() >= 400) badResponses.push(`${label}:${response.status()}:${response.url()}`);
  });
}

async function waitForRaw(page) {
  await page.waitForFunction(() => Boolean(window.__mutinePortraitV047));
  await page.locator('[data-profile-stage]').waitFor({ state: 'visible' });
}

async function waitForCanonical(page) {
  const mount = page.locator('[data-catalog-work-detail="portrait-2026-11-10"]');
  await mount.waitFor({ state: 'visible' });
  const iframe = mount.locator('iframe');
  await iframe.waitFor({ state: 'visible' });
  const frame = page.frames().find((entry) => entry.url().includes('/studies/self-portrait/v047/'));
  if (!frame) throw new Error('canonical tableau iframe did not load v047');
  await frame.waitForFunction(() => Boolean(window.__mutinePortraitV047));
  return frame;
}

async function measure(documentLike, label) {
  return documentLike.evaluate(({ name }) => {
    const stage = document.querySelector('[data-profile-stage]');
    const svg = document.querySelector('[data-profile-svg]');
    const hidden = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return true;
      const style = getComputedStyle(node);
      return style.display === 'none' || style.visibility === 'hidden' || node.getBoundingClientRect().width === 0;
    };
    const touchTargets = [...document.querySelectorAll('.counterpressure-controls button')].map((button) => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height));
    return {
      label: name,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      stageVisible: Boolean(stage && stage.getBoundingClientRect().width > 0 && stage.getBoundingClientRect().height > 0),
      svgVisible: Boolean(svg && svg.getBoundingClientRect().width > 0 && svg.getBoundingClientRect().height > 0),
      ribCount: document.querySelectorAll('[data-rib-index]').length,
      controls: hidden('.counterpressure-controls') ? 'none' : 'visible',
      readout: hidden('.profile-readout') ? 'none' : 'visible',
      hint: hidden('.profile-hint') ? 'none' : 'visible',
      minTouchTarget: Math.min(...touchTargets, 999),
      state: window.__mutinePortraitV047?.getState?.() ?? null
    };
  }, { name: label });
}

async function rawRun(viewport, reduced) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage();
  const label = `raw-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}`;
  attachDiagnostics(page, label);
  await page.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
  await waitForRaw(page);
  const measurement = await measure(page, label);
  measurement.viewportTarget = viewport.width;
  if (viewport.width === 390 && !reduced) await page.screenshot({ path: path.join(proofDir, 'raw-390-normal.png'), fullPage: false });
  await context.close();
  return measurement;
}

async function canonicalRun(viewport, reduced) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage();
  const label = `canonical-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}`;
  attachDiagnostics(page, label);
  await page.goto(`${baseUrl}${routes.canonical}`, { waitUntil: 'networkidle' });
  const frame = await waitForCanonical(page);
  const measurement = await measure(frame, label);
  const outerViewport = await page.evaluate(() => ({ innerWidth: window.innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  measurement.frameInnerWidth = measurement.innerWidth;
  measurement.frameClientWidth = measurement.clientWidth;
  measurement.frameScrollWidth = measurement.scrollWidth;
  Object.assign(measurement, outerViewport, { viewportTarget: viewport.width });
  measurement.tableauFirst = await page.evaluate(() => {
    const mount = document.querySelector('[data-catalog-work-detail]');
    const iframe = mount?.querySelector('iframe');
    const heading = mount?.querySelector('h1');
    return Boolean(iframe && heading && iframe.getBoundingClientRect().top <= heading.getBoundingClientRect().top);
  });
  if (viewport.width === 390 && !reduced) await page.screenshot({ path: path.join(proofDir, 'canonical-390-normal.png'), fullPage: false });
  await context.close();
  return measurement;
}

for (const viewport of viewports) {
  runs.push(await rawRun(viewport, false));
  runs.push(await rawRun(viewport, true));
  runs.push(await canonicalRun(viewport, false));
  runs.push(await canonicalRun(viewport, true));
}

const interactionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', hasTouch: true });
const interactionPage = await interactionContext.newPage();
attachDiagnostics(interactionPage, 'interaction');
await interactionPage.goto(`${baseUrl}${routes.raw}`, { waitUntil: 'networkidle' });
await waitForRaw(interactionPage);
const stage = interactionPage.locator('[data-profile-stage]');
const box = await stage.boundingBox();
if (!box) throw new Error('profile stage has no bounds');
const baseline = await interactionPage.evaluate(() => ({ state: window.__mutinePortraitV047.getState(), signature: window.__mutinePortraitV047.geometrySignature() }));
const point = ([x, y]) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
const straight = [[0.12, .5], [.28, .5], [.44, .5], [.62, .5], [.82, .5]];
await interactionPage.mouse.move(point(straight[0]).x, point(straight[0]).y);
await interactionPage.mouse.down();
for (const sample of straight.slice(1)) { const next = point(sample); await interactionPage.mouse.move(next.x, next.y); }
await interactionPage.mouse.up();
const refused = await interactionPage.evaluate(() => window.__mutinePortraitV047.getState());
const zigzag = [[.12, .72], [.26, .56], [.18, .42], [.42, .30], [.34, .18], [.68, .24], [.58, .62], [.86, .40]];
const firstPoint = point(zigzag[0]);
await interactionPage.mouse.move(firstPoint.x, firstPoint.y);
await interactionPage.mouse.down();
for (const sample of zigzag.slice(1)) { const next = point(sample); await interactionPage.mouse.move(next.x, next.y); }
await interactionPage.mouse.up();
const committed = await interactionPage.evaluate(() => ({ state: window.__mutinePortraitV047.getState(), signature: window.__mutinePortraitV047.geometrySignature() }));
const interaction = {
  straightRefused: refused.interaction === 'refused / no counterpressure' && refused.document.revision === 0,
  pendingGeometryNeutral: refused.document.revision === baseline.state.document.revision,
  committed: committed.state.memory.length === 1 && committed.state.document.revision === 1,
  wholeProfileChanged: committed.signature !== baseline.signature,
  ribCount: committed.state.ribs.length
};
await stage.focus();
for (let index = 0; index < 8; index += 1) await interactionPage.keyboard.press('ArrowRight');
await interactionPage.keyboard.press('Enter');
const keyboardCommitted = await interactionPage.evaluate(() => window.__mutinePortraitV047.getState());
interaction.keyboardCommitted = keyboardCommitted.memory.length === 2;
await interactionPage.keyboard.press('Delete');
const lifted = await interactionPage.evaluate(() => ({ state: window.__mutinePortraitV047.getState(), signature: window.__mutinePortraitV047.geometrySignature() }));
interaction.liftRestored = lifted.state.memory.length === 1 && lifted.state.document.revision === 1;
await interactionPage.keyboard.press('Escape');
interaction.released = (await interactionPage.evaluate(() => window.__mutinePortraitV047.getState())).document.revision === 0;
for (let revision = 0; revision < 4; revision += 1) await interactionPage.evaluate(() => window.__mutinePortraitV047.commitValid());
const four = await interactionPage.evaluate(() => window.__mutinePortraitV047.getState());
interaction.fourCompounded = four.memory.length === 4 && four.document.revision === 4;
await interactionPage.screenshot({ path: path.join(proofDir, 'interaction-390-reduced.png'), fullPage: false });
await interactionContext.close();

const blindContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const blindPage = await blindContext.newPage();
attachDiagnostics(blindPage, 'blind');
await blindPage.goto(`${baseUrl}/studies/self-portrait/v047/?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
await waitForRaw(blindPage);
const blind = await measure(blindPage, 'blind-390-reduced');
await blindPage.screenshot({ path: path.join(proofDir, 'blind-390-reduced.png'), fullPage: false });
await blindContext.close();

const readbacks = {};
for (const [key, route] of Object.entries({
  works: '/studio/data/works.json',
  publicCatalog: '/studio/data/catalog-public.json',
  journal: '/journal/',
  canonical: routes.canonical,
  raw: routes.raw,
  favicon: '/studio/favicon.svg'
})) {
  const response = await fetch(`${baseUrl}${route}`);
  const text = await response.text();
  readbacks[key] = { status: response.status, hasWork: text.includes('portrait-2026-11-10'), hasJournal: text.includes('journal-portrait-2026-11-10'), hasTitle: text.includes('The portrait cannot keep a straight answer.') };
}

const journalContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const journalPage = await journalContext.newPage();
attachDiagnostics(journalPage, 'journal-readback');
await journalPage.goto(`${baseUrl}/journal/`, { waitUntil: 'networkidle' });
const journalEntry = journalPage.locator('#journal-portrait-2026-11-10');
await journalEntry.waitFor({ state: 'visible' });
readbacks.journal.rendered = true;
readbacks.journal.hasJournal = await journalEntry.count() === 1;
readbacks.journal.hasTitle = (await journalEntry.innerText()).includes('The portrait cannot keep a straight answer.');
await journalContext.close();

const output = {
  label: 'portrait-v047-local',
  baseUrl,
  viewports: viewports.map(({ label }) => label),
  modes: ['normal', 'reduced-motion'],
  runs,
  interaction,
  blind,
  diagnostics,
  badResponses,
  readbacks
};
await writeFile(path.join(proofDir, 'results.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ runs: runs.length, diagnostics: diagnostics.length, badResponses: badResponses.length, interaction, blind: { svgVisible: blind.svgVisible, memory: blind.state?.memory?.length, scrollWidth: blind.scrollWidth }, readbacks }, null, 2));
if (runs.length !== 20) process.exitCode = 1;
if (diagnostics.length || badResponses.length) process.exitCode = 1;
if (runs.some((run) => run.innerWidth !== run.viewportTarget || run.clientWidth !== run.viewportTarget || run.scrollWidth > run.viewportTarget || !run.svgVisible || !run.stageVisible || run.ribCount !== 28 || run.minTouchTarget < 44)) process.exitCode = 1;
if (!interaction.straightRefused || !interaction.pendingGeometryNeutral || !interaction.committed || !interaction.wholeProfileChanged || !interaction.keyboardCommitted || !interaction.liftRestored || !interaction.released || !interaction.fourCompounded || interaction.ribCount !== 28) process.exitCode = 1;
if (!blind.svgVisible || blind.state?.memory?.length !== 4 || blind.controls !== 'none' || blind.readout !== 'none' || blind.hint !== 'none' || blind.scrollWidth > blind.innerWidth) process.exitCode = 1;
if (Object.values(readbacks).some((entry) => entry.status !== 200)) process.exitCode = 1;
if (!readbacks.works.hasWork || !readbacks.publicCatalog.hasWork || !readbacks.journal.hasJournal || !readbacks.journal.hasTitle || !readbacks.canonical.status || !readbacks.raw.hasTitle || readbacks.favicon.status !== 200) process.exitCode = 1;
await browser.close();
