import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const workId = 'brush-2026-09-10';
const expectedTitle = 'The brush shares the pigment.';
const pageErrors = [];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => pageErrors.push(String(error)));
const response = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
await page.locator(`#journal-${workId}`).waitFor({ state: 'visible' });
const journal = await page.evaluate(({ workId, expectedTitle }) => {
  const entry = document.querySelector(`#journal-${workId}`);
  return {
    entryCount: document.querySelectorAll(`#journal-${workId}`).length,
    titleCount: [...(entry?.querySelectorAll('h3') ?? [])].filter((node) => node.textContent?.trim() === expectedTitle).length,
    titleText: entry?.querySelector('h3')?.textContent?.trim() ?? null,
    anchor: entry?.id ?? null,
    href: entry?.querySelector('h3 a')?.getAttribute('href') ?? null,
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  };
}, { workId, expectedTitle });
const jsonResponse = await page.evaluate(async () => {
  const response = await fetch('/studio/data/works.json');
  return { status: response.status, data: await response.json() };
});
const work = jsonResponse.data.works.find((entry) => entry.id === workId);
const json = {
  base,
  workId,
  expectedTitle,
  journalHTTP: response.status(),
  journal,
  jsonHTTP: jsonResponse.status,
  jsonRecord: work ? { id: work.id, currentId: work.currentId, date: work.date, title: work.title, rawPath: work.rawPath, journalAnchor: work.journal?.anchor } : null,
  pageErrors,
  passed: response.status() === 200
    && journal.entryCount === 1
    && journal.titleCount === 1
    && journal.anchor === `journal-${workId}`
    && journal.titleText === expectedTitle
    && journal.href === `/works/${workId}/#journal`
    && journal.scrollWidth <= journal.innerWidth
    && jsonResponse.status === 200
    && work?.title === expectedTitle
    && work?.rawPath === '/studies/p5-brush/v008/'
    && work?.journal?.anchor === `journal-${workId}`
    && pageErrors.length === 0
};
await writeFile('research/qa/proofs/brush-v008-2026-09-10/production-journal-readback.json', `${JSON.stringify(json, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(json, null, 2));
await browser.close();
if (!json.passed) process.exitCode = 1;
