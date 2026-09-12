import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const OUT = 'research/qa/proofs/naive-art-v008-2026-09-12/production';
const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => events.pageErrors.push(String(error)));
page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });

async function geometry(targetPage = page) {
  return targetPage.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight
  }));
}

let result;
try {
  const registerResponse = await page.goto(`${ROOT}/studio/data/works.json`, { waitUntil: 'networkidle' });
  const register = await page.evaluate(() => document.body.innerText).then(JSON.parse);
  const matches = register.works.filter((work) => work.id === 'naive-2026-09-12');
  const canonicalResponse = await page.goto(`${ROOT}/works/naive-2026-09-12/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
  const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v008/'));
  if (!frame) throw new Error('production v008 tableau iframe did not attach');
  await frame.waitForSelector('#field');
  const canonical = await page.evaluate(async () => {
    const stage = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('.work-inspect__heading h1');
    return {
      title: heading?.textContent.trim(),
      tableauFirst: Boolean(stage && heading && stage.getBoundingClientRect().top < heading.getBoundingClientRect().top),
      ready: document.querySelector('[data-catalog-work-detail][data-ready="true"]')?.getAttribute('data-ready') === 'true'
    };
  });
  const canonicalState = await frame.evaluate(() => window.__mutineNaiveV008?.getState());
  const canonicalGeometry = await geometry();
  await page.screenshot({ path: `${OUT}/canonical-390x844.png`, fullPage: true });

  const rawPage = await context.newPage();
  const rawEvents = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  rawPage.on('console', (message) => rawEvents.console.push(`${message.type()}: ${message.text()}`));
  rawPage.on('pageerror', (error) => rawEvents.pageErrors.push(String(error)));
  rawPage.on('requestfailed', (request) => rawEvents.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
  rawPage.on('response', (response) => { if (response.status() >= 400) rawEvents.httpErrors.push(`${response.status()} ${response.url()}`); });
  const rawResponse = await rawPage.goto(`${ROOT}/studies/naive-art/v008/?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  const rawFrame = rawPage.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v008/'));
  if (!rawFrame) throw new Error('production raw v008 frame did not attach');
  await rawFrame.waitForSelector('#field');
  const rawInitial = await rawFrame.evaluate(() => window.__mutineNaiveV008.getState());
  await rawFrame.locator('#field').click({ position: { x: 72, y: 310 } });
  const rawPointer = await rawFrame.evaluate(() => window.__mutineNaiveV008.getState());
  await rawFrame.locator('#field').focus();
  await rawFrame.locator('#field').press('Enter');
  const rawKeyboard = await rawFrame.evaluate(() => window.__mutineNaiveV008.getState());
  await rawFrame.locator('#undo-control').click();
  const rawUndo = await rawFrame.evaluate(() => window.__mutineNaiveV008.getState());
  await rawFrame.locator('#release-control').click();
  const rawRelease = await rawFrame.evaluate(() => window.__mutineNaiveV008.getState());
  const controls = await rawFrame.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), height: button.getBoundingClientRect().height })));
  const rawGeometry = await geometry(rawPage);
  await rawPage.screenshot({ path: `${OUT}/raw-interaction-390x844.png`, fullPage: true });
  const rawResult = { status: rawResponse?.status(), initial: rawInitial, pointer: rawPointer, keyboard: rawKeyboard, undo: rawUndo, release: rawRelease, controls, geometry: rawGeometry, events: rawEvents };
  await rawPage.close();

  const journalResponse = await page.goto(`${ROOT}/journal/`, { waitUntil: 'networkidle' });
  const entry = page.locator('#journal-naive-2026-09-12');
  const journal = await entry.evaluate((node) => ({ title: node.querySelector('h3')?.textContent.trim(), href: node.querySelector('a')?.getAttribute('href') }));
  await page.screenshot({ path: `${OUT}/journal-390x844.png`, fullPage: true });
  const favicon = await page.request.get(`${ROOT}/studio/favicon.svg`);
  result = {
    stableAlias: ROOT,
    register: { status: registerResponse?.status(), matches: matches.length, id: matches[0]?.id, title: matches[0]?.title, rawPath: matches[0]?.rawPath, journalAnchor: matches[0]?.journal?.anchor },
    canonical: { status: canonicalResponse?.status(), ...canonical, state: canonicalState, geometry: canonicalGeometry, capture: 'canonical-390x844.png' },
    raw: { ...rawResult, capture: 'raw-interaction-390x844.png' },
    journal: { status: journalResponse?.status(), entry: journal, capture: 'journal-390x844.png' },
    favicon: { status: favicon.status() },
    events: { canonical: events, raw: rawResult.events },
  };
  result.assertions = {
    recordExactlyOnce: result.register.status === 200 && result.register.matches === 1 && result.register.title === 'The mistake keeps a knot.' && result.register.rawPath === '/studies/naive-art/v008/' && result.register.journalAnchor === 'journal-naive-2026-09-12',
    canonical: result.canonical.status === 200 && result.canonical.ready && result.canonical.tableauFirst && result.canonical.geometry.innerWidth === result.canonical.geometry.clientWidth && result.canonical.geometry.scrollWidth <= result.canonical.geometry.innerWidth,
    raw: result.raw.status === 200 && result.raw.initial.memory === 2 && result.raw.pointer.memory === 3 && result.raw.keyboard.memory === 4 && result.raw.undo.memory === 3 && result.raw.release.memory === 0 && result.raw.controls.every((control) => control.height >= 44) && result.raw.geometry.scrollWidth <= result.raw.geometry.innerWidth,
    journal: result.journal.status === 200 && result.journal.entry.title === 'The mistake keeps a knot.' && result.journal.entry.href === '/works/naive-2026-09-12/#journal',
    favicon: result.favicon.status === 200,
    network: [...result.events.canonical.console, ...result.events.canonical.pageErrors, ...result.events.canonical.requestFailures, ...result.events.canonical.httpErrors, ...result.events.raw.console, ...result.events.raw.pageErrors, ...result.events.raw.requestFailures, ...result.events.raw.httpErrors].length === 0
  };
  result.pass = Object.values(result.assertions).every(Boolean);
  await writeFile(`${OUT}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  result = { stableAlias: ROOT, pass: false, error: String(error), events };
  await writeFile(`${OUT}/results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
