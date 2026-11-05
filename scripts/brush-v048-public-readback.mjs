import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = 'https://autopoiesis-nine.vercel.app';
const proofDir = new URL('../research/qa/proofs/brush-v048-2026-11-05-production-final/', import.meta.url);
await mkdir(proofDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const response = await page.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-catalog="journal"][data-ready="true"]', { timeout: 30000 });
  const result = await page.evaluate(() => {
    const journal = document.querySelector('[data-catalog="journal"]');
    const text = journal?.textContent ?? '';
    return {
      status: document.title ? 200 : 0,
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      anchorCount: document.querySelectorAll('#journal-brush-2026-11-05').length,
      titleCount: text.split('The wash grows where it was not touched.').length - 1,
      rendered: text.includes('The wash grows where it was not touched.'),
      ready: journal?.dataset.ready === 'true'
    };
  });
  const evidence = { responseStatus: response?.status(), result, diagnostics: errors };
  await writeFile(new URL('journal-readback.json', proofDir), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(evidence, null, 2));
  if (response?.status() !== 200 || result.anchorCount !== 1 || result.titleCount < 1 || result.scrollWidth > result.innerWidth || errors.length) process.exitCode = 1;
  await context.close();
} finally {
  await browser.close();
}
