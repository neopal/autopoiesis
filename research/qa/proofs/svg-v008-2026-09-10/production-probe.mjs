import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/ASUS/AppData/Local/Temp/mutine-playwright/node_modules/playwright');
const executablePath = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe';
const base = 'https://autopoiesis-nine.vercel.app';
const urls = {
  canonical: `${base}/works/svg-2026-09-10/`,
  journal: `${base}/journal/`,
  raw: `${base}/studies/pure-svg/v008/?preview=1&interaction=1`
};
const browser = await chromium.launch({ headless: true, executablePath });
const output = { urls, issues: [], canonical: null, journal: null, raw: null };

async function issueCapture(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  return { consoleMessages, pageErrors, requestFailures, badResponses };
}

const canonicalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const canonicalIssues = await issueCapture(canonicalPage);
const canonicalResponse = await canonicalPage.goto(urls.canonical, { waitUntil: 'networkidle' });
await canonicalPage.waitForSelector('.work-inspect__stage iframe');
const canonicalFrame = canonicalPage.frames().find((frame) => frame.url().includes('/studies/pure-svg/v008/'));
output.canonical = {
  status: canonicalResponse?.status(),
  title: await canonicalPage.locator('.work-inspect__heading h1').textContent(),
  iframe: Boolean(canonicalFrame),
  stageBeforeHeading: await canonicalPage.evaluate(() => document.querySelector('.work-inspect__stage iframe').getBoundingClientRect().top < document.querySelector('.work-inspect__heading h1').getBoundingClientRect().top),
  overflow: await canonicalPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
  issues: canonicalIssues
};
if (canonicalFrame) output.canonical.tableau = await canonicalFrame.evaluate(() => ({ svg: Boolean(document.querySelector('svg#field')), memory: document.querySelector('[data-memory]')?.textContent }));
await canonicalPage.close();

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const journalIssues = await issueCapture(journalPage);
const journalResponse = await journalPage.goto(urls.journal, { waitUntil: 'networkidle' });
output.journal = {
  status: journalResponse?.status(),
  anchorCount: await journalPage.locator('#journal-svg-2026-09-10').count(),
  anchorTitleCount: await journalPage.locator('#journal-svg-2026-09-10').getByText('The animal passes it on.', { exact: true }).count(),
  titleCount: await journalPage.getByText('The animal passes it on.', { exact: true }).count(),
  overflow: await journalPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
  issues: journalIssues
};
await journalPage.close();

const rawPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const rawIssues = await issueCapture(rawPage);
const rawResponse = await rawPage.goto(urls.raw, { waitUntil: 'networkidle' });
await rawPage.waitForSelector('svg#field');
output.raw = {
  status: rawResponse?.status(),
  preview: await rawPage.evaluate(() => document.documentElement.classList.contains('preview-mode')),
  interactive: await rawPage.evaluate(() => document.documentElement.classList.contains('interactive-preview')),
  svg: true,
  overflow: await rawPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })),
  issues: rawIssues
};
await rawPage.close();

const issueArrays = [output.canonical.issues, output.journal.issues, output.raw.issues];
output.passed = Boolean(output.canonical.status === 200 && output.canonical.iframe && output.canonical.tableau?.svg && output.canonical.stageBeforeHeading && output.journal.status === 200 && output.journal.anchorCount === 1 && output.journal.anchorTitleCount >= 1 && output.raw.status === 200 && output.raw.preview && output.raw.interactive && output.raw.svg && issueArrays.every((issues) => Object.values(issues).every((entries) => entries.length === 0)));
await writeFile(new URL('./production-results.json', import.meta.url), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
await browser.close();
if (!output.passed) process.exitCode = 1;
