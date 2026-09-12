import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const OUT = 'research/qa/proofs/portrait-v008-2026-09-12';
const target = 'portrait-2026-09-12';

async function observedPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => events.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
  page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  return { page, response, events };
}

const response = await fetch(`${ROOT}/studio/data/works.json`);
if (!response.ok) throw new Error(`works register HTTP ${response.status()}`);
const data = await response.json();
const matches = data.works.filter((work) => work.id === target);
if (matches.length !== 1) throw new Error(`expected one ${target}, found ${matches.length}`);

const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  const canonical = await observedPage(browser, `${ROOT}/works/${target}/`);
  const canonicalData = await canonical.page.evaluate(() => ({
    title: document.title,
    workTitle: document.querySelector('.work-inspect__heading h1')?.textContent.trim(),
    iframe: Boolean(document.querySelector('.work-inspect__stage iframe')),
    tableauFirst: (() => {
      const stage = document.querySelector('.work-inspect__stage iframe');
      const title = document.querySelector('.work-inspect__heading h1');
      return Boolean(stage && title && stage.getBoundingClientRect().top < title.getBoundingClientRect().top);
    })()
  }));
  await canonical.page.close();

  const journal = await observedPage(browser, `${ROOT}/journal/`);
  const journalData = await journal.page.evaluate((anchor) => {
    const entry = document.querySelector(`#${anchor}`);
    return {
      title: entry?.querySelector('h2, h3, [data-journal-title]')?.textContent.trim() ?? null,
      count: document.querySelectorAll(`#${anchor}`).length,
      href: entry?.querySelector('a[href*="/works/portrait-2026-09-12/"]')?.getAttribute('href') ?? null,
      bodyText: entry?.textContent.includes('The face keeps a blind spot.') ?? false
    };
  }, `journal-${target}`);
  await journal.page.close();

  const result = {
    register: { status: response.status, count: matches.length, id: matches[0].id, title: matches[0].title, rawPath: matches[0].rawPath, journalAnchor: matches[0].journal.anchor },
    canonical: { status: canonical.response.status(), ...canonicalData, ...canonical.events },
    journal: { status: journal.response.status(), ...journalData, ...journal.events }
  };
  await writeFile(`${OUT}/catalog-readback.json`, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
