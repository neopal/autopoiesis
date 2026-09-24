import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_QA_BASE_URL ?? 'http://127.0.0.1:51415';
const routes = {
  journal: `${base}/journal/`,
  current: `${base}/currents/self-portrait/`
};
const output = new URL('./catalog-results.json', import.meta.url);

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
  await page.waitForTimeout(120);
  const evidence = await page.evaluate((pageKind) => {
    const anchor = document.querySelector('#journal-portrait-2026-09-24');
    const currentHeader = document.querySelector('.catalog-current-header__title');
    const firstWork = document.querySelector('[data-work-id="portrait-2026-09-24"]');
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      journalAnchor: Boolean(anchor),
      journalTitle: anchor?.querySelector('h3')?.textContent.trim() ?? null,
      currentHeader: currentHeader?.textContent.trim() ?? null,
      firstWork: Boolean(firstWork),
      firstWorkTitle: firstWork?.querySelector('h3')?.textContent.trim() ?? null,
      kind: pageKind
    };
  }, kind);
  const screenshot = new URL(`${kind}-390x844.png`, output);
  await page.screenshot({ path: fileURLToPath(screenshot) });
  await context.close();
  return { route, evidence, consoleMessages, pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = { journal: await check(browser, routes.journal, 'journal'), current: await check(browser, routes.current, 'current') };
await browser.close();
await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({
  journal: { evidence: results.journal.evidence, issues: [...results.journal.consoleMessages, ...results.journal.pageErrors, ...results.journal.requestFailures, ...results.journal.badResponses].length },
  current: { evidence: results.current.evidence, issues: [...results.current.consoleMessages, ...results.current.pageErrors, ...results.current.requestFailures, ...results.current.badResponses].length }
}));
