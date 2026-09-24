import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const base = 'https://autopoiesis-nine.vercel.app';
const output = new URL('./production-render-results.json', import.meta.url);
const routes = {
  journal: `${base}/journal/`,
  current: `${base}/currents/self-portrait/`,
  work: `${base}/works/portrait-2026-09-24/`
};

async function check(browser, route, kind) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on('console', (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(180);
  const evidence = await page.evaluate((pageKind) => {
    const anchor = document.querySelector('#journal-portrait-2026-09-24');
    const currentHeader = document.querySelector('.catalog-current-header__title');
    const firstWork = document.querySelector('[data-work-id="portrait-2026-09-24"]');
    const workTitle = document.querySelector('h1');
    return {
      kind: pageKind,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      journalAnchor: Boolean(anchor),
      journalTitle: anchor?.querySelector('h3')?.textContent.trim() ?? null,
      currentHeader: currentHeader?.textContent.trim() ?? null,
      firstWork: Boolean(firstWork),
      firstWorkTitle: firstWork?.querySelector('h3')?.textContent.trim() ?? null,
      workTitle: workTitle?.textContent.trim() ?? null,
      workMount: Boolean(document.querySelector('[data-catalog-work-detail]'))
    };
  }, kind);
  await context.close();
  return { route, evidence, consoleMessages, pageErrors, requestFailures, badResponses };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = {};
for (const [kind, route] of Object.entries(routes)) results[kind] = await check(browser, route, kind);
await browser.close();
await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([kind, result]) => [kind, {
  evidence: result.evidence,
  issues: [...result.consoleMessages, ...result.pageErrors, ...result.requestFailures, ...result.badResponses]
}]))));
