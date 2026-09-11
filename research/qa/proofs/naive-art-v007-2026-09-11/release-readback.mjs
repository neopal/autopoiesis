import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const OUT = 'research/qa/proofs/naive-art-v007-2026-09-11/release-readback.json';
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => events.pageErrors.push(String(error)));
page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto(`${ROOT}/journal/`, { waitUntil: 'networkidle' });
  const journal = await page.locator('#journal-naive-2026-09-11').evaluate((entry) => ({
    count: 1,
    title: entry.querySelector('h3')?.textContent.trim(),
    href: entry.querySelector('a')?.getAttribute('href')
  })).catch(() => ({ count: 0 }));
  await page.goto(`${ROOT}/studies/naive-art/v007/`, { waitUntil: 'networkidle' });
  const directRaw = {
    finalUrl: page.url(),
    redirectedToCanonical: page.url().endsWith('/works/naive-2026-09-11/')
  };
  const result = { journal, directRaw, events };
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await page.close();
  await browser.close();
}
