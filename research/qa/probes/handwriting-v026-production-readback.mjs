import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://autopoiesis-nine.vercel.app';
const evidenceDir = 'research/qa/proofs/typography-v026-2026-10-10-production';
const routes = {
  journal: '/journal/',
  current: '/currents/handwriting/',
  work: '/works/typography-2026-10-10/'
};
await mkdir(evidenceDir, { recursive: true });
const fetchChecks = [];
for (const [name, path] of Object.entries({
  works: '/studio/data/works.json',
  favicon: '/studio/favicon.svg'
})) {
  const response = await fetch(`${BASE}${path}`);
  const body = await response.text();
  fetchChecks.push({ name, path, status: response.status, contentType: response.headers.get('content-type'), bytes: body.length, recordCount: name === 'works' ? JSON.parse(body).works.filter((work) => work.id === 'typography-2026-10-10').length : undefined, hasSvg: name === 'favicon' ? body.includes('<svg') : undefined });
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  if (name === 'works' && JSON.parse(body).works.filter((work) => work.id === 'typography-2026-10-10').length !== 1) throw new Error('works record count mismatch');
  if (name === 'favicon' && !body.includes('<svg')) throw new Error('favicon is not SVG');
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const pages = [];
for (const [name, path] of Object.entries(routes)) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  const readback = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    title: document.title,
    text: document.body.innerText,
    workDetail: document.querySelector('[data-catalog-work-detail]')?.getAttribute('data-catalog-work-detail') ?? null,
    journalAnchor: Boolean(document.getElementById('journal-typography-2026-10-10'))
  }));
  await page.screenshot({ path: `${evidenceDir}/${name}-390x844-reduced.png`, fullPage: false });
  pages.push({ name, path, status: response?.status() ?? null, readback: { ...readback, textIncludesTarget: readback.text.includes('The margin keeps the spare.') }, errors, failed });
  await context.close();
}
await browser.close();
const result = { base: BASE, fetchChecks, pages, status: pages.every((entry) => entry.status === 200 && entry.errors.length === 0 && entry.failed.length === 0 && entry.readback.scrollWidth === entry.readback.clientWidth && entry.readback.textIncludesTarget && (entry.name !== 'journal' || entry.readback.journalAnchor)) ? 'passed' : 'failed' };
await writeFile(`${evidenceDir}/catalog-readback.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'passed') process.exitCode = 1;
