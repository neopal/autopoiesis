import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const OUT = 'research/qa/proofs/portrait-v008-2026-09-12';
const target = 'portrait-2026-09-12';

function eventsFor(page) {
  const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });
  return events;
}

async function open(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const events = eventsFor(page);
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  return { page, response, events };
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const registerResponse = await fetch(`${ROOT}/studio/data/works.json`);
  const register = await registerResponse.json();
  const matches = register.works.filter((work) => work.id === target);
  if (!registerResponse.ok || matches.length !== 1) throw new Error(`production register mismatch: ${registerResponse.status} / ${matches.length}`);

  const canonical = await open(browser, `${ROOT}/works/${target}/`);
  const frame = canonical.page.frames().find((candidate) => candidate.url().includes('/studies/self-portrait/v008/'));
  if (!frame) throw new Error('production v008 iframe did not attach');
  await frame.locator('#field').waitFor({ state: 'visible' });
  const canonicalData = await canonical.page.evaluate(() => ({
    title: document.querySelector('.work-inspect__heading h1')?.textContent.trim(),
    tableauFirst: (() => {
      const stage = document.querySelector('.work-inspect__stage iframe');
      const title = document.querySelector('.work-inspect__heading h1');
      return Boolean(stage && title && stage.getBoundingClientRect().top < title.getBoundingClientRect().top);
    })(),
    innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  const canonicalState = await frame.evaluate(() => window.__mutinePortraitV008?.getState());
  await canonical.page.screenshot({ path: `${OUT}/production-canonical-390x844.png`, fullPage: true });
  await canonical.page.close();

  const journal = await open(browser, `${ROOT}/journal/`);
  const journalAnchor = journal.page.locator(`#journal-${target}`);
  await journalAnchor.waitFor({ state: 'visible' });
  const journalData = await journal.page.evaluate((anchor) => {
    const entry = document.querySelector(`#${anchor}`);
    return {
      count: document.querySelectorAll(`#${anchor}`).length,
      title: entry?.querySelector('h2, h3, [data-journal-title]')?.textContent.trim() ?? null,
      titlePresent: entry?.textContent.includes('The face keeps a blind spot.') ?? false,
      href: entry?.querySelector('a[href*="/works/portrait-2026-09-12/"]')?.getAttribute('href') ?? null
    };
  }, `journal-${target}`);
  await journal.page.screenshot({ path: `${OUT}/production-journal-390x844.png`, fullPage: true });
  await journal.page.close();

  const raw = await open(browser, `${ROOT}/studies/self-portrait/v008/?preview=1&interaction=1`);
  const canvas = raw.page.locator('#field');
  await canvas.waitFor({ state: 'visible' });
  const initial = await raw.page.evaluate(() => window.__mutinePortraitV008?.getState());
  await canvas.click({ position: { x: 190, y: 320 } });
  const pointer = await raw.page.evaluate(() => window.__mutinePortraitV008?.getState());
  await canvas.focus();
  await canvas.press('Enter');
  const keyboard = await raw.page.evaluate(() => window.__mutinePortraitV008?.getState());
  await raw.page.locator('#undo-control').click();
  const lifted = await raw.page.evaluate(() => window.__mutinePortraitV008?.getState());
  await raw.page.locator('#release-control').click();
  const released = await raw.page.evaluate(() => window.__mutinePortraitV008?.getState());
  const rawData = {
    initial, pointer, keyboard, lifted, released,
    controls: await raw.page.locator('.field-controls button').evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent.trim(), height: rect.height };
    })),
    innerWidth: await raw.page.evaluate(() => innerWidth),
    clientWidth: await raw.page.evaluate(() => document.documentElement.clientWidth),
    scrollWidth: await raw.page.evaluate(() => document.documentElement.scrollWidth)
  };
  await raw.page.screenshot({ path: `${OUT}/production-raw-interaction-390x844.png`, fullPage: true });
  await raw.page.close();

  const favicon = await fetch(`${ROOT}/favicon.ico`);
  const result = {
    stableAlias: ROOT,
    register: { status: registerResponse.status, count: matches.length, id: matches[0].id, title: matches[0].title, rawPath: matches[0].rawPath, journalAnchor: matches[0].journal.anchor },
    canonical: { status: canonical.response.status(), ...canonicalData, state: canonicalState, ...canonical.events },
    journal: { status: journal.response.status(), ...journalData, ...journal.events },
    raw: { status: raw.response.status(), ...rawData, ...raw.events },
    favicon: { status: favicon.status },
    captures: ['production-canonical-390x844.png', 'production-journal-390x844.png', 'production-raw-interaction-390x844.png']
  };
  await writeFile(`${OUT}/production-results.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
