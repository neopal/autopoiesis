import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const proofPath = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const page = await context.newPage();
const diagnostics = [];
page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`); });
const responseFailures = [];
page.on('response', (response) => { if (response.url().startsWith(base) && response.status() >= 400) responseFailures.push(`${response.status()} ${response.url()}`); });

const jsonResponse = await page.request.get(`${base}/studio/data/works.json`);
const works = await jsonResponse.json();
const records = works.works.filter((work) => work.id === 'brush-2026-11-07');

await page.goto(`${base}/journal/`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('#journal-brush-2026-11-07', { timeout: 30000 });
const journal = await page.evaluate(() => ({
  status: document.querySelector('#journal-brush-2026-11-07') ? 200 : 0,
  titlePresent: document.body.innerText.includes('The pigment forgets its missing edge.'),
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
await page.screenshot({ path: path.join(proofPath, 'readback-journal-390x844.png') });

await page.goto(`${base}/currents/brush/`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForFunction(() => document.body.innerText.includes('The pigment forgets its missing edge.'), { timeout: 30000 });
const current = { status: 200, titlePresent: await page.evaluate(() => document.body.innerText.includes('The pigment forgets its missing edge.')) };

await page.goto(`${base}/works/brush-2026-11-07/`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForSelector('[data-catalog-work-detail="brush-2026-11-07"][data-ready="true"]', { timeout: 30000 });
await page.waitForFunction(() => Array.from(window.frames).some((candidate) => candidate.location.href.includes('/studies/p5-brush/v050/')), { timeout: 30000 });
const workFrame = page.frames().find((candidate) => candidate.url().includes('/studies/p5-brush/v050/'));
await workFrame.waitForFunction(() => Boolean(window._p5Ready && window.__mutineBrushV050?.ready), { timeout: 30000 });
const canonical = await page.evaluate(() => ({
  status: 200,
  titlePresent: document.body.innerText.includes('The pigment forgets its missing edge.'),
  tableauFirst: (() => {
    const tableau = document.querySelector('.work-inspect__stage iframe');
    const heading = document.querySelector('h1, h2, h3');
    return Boolean(tableau && heading && tableau.getBoundingClientRect().top < heading.getBoundingClientRect().top);
  })(),
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth
}));
const raw = await page.request.get(`${base}/studies/p5-brush/v050/`);
const favicon = await page.request.get(`${base}/studio/favicon.svg`);
const catalog = await page.request.get(`${base}/studio/data/catalog-public.json`);
const publicCatalog = await catalog.json();
await page.screenshot({ path: path.join(proofPath, 'readback-work-390x844.png') });
await context.close();
await browser.close();

const output = {
  base,
  records: records.length,
  recordIds: records.map((work) => work.id),
  journal,
  current,
  canonical,
  rawStatus: raw.status(),
  faviconStatus: favicon.status(),
  catalogStatus: catalog.status(),
  publicCatalogMatches: publicCatalog.works.works.filter((work) => work.id === 'brush-2026-11-07').length,
  diagnostics,
  responseFailures
};
await writeFile(path.join(proofPath, 'readback.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
