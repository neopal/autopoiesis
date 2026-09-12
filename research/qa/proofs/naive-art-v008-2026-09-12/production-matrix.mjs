import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT = 'https://autopoiesis-nine.vercel.app';
const OUT = 'research/qa/proofs/naive-art-v008-2026-09-12/production';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const results = [];

for (const [width, height] of viewports) {
  for (const reducedMotion of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const events = { console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
    page.on('console', (message) => events.console.push(`${message.type()}: ${message.text()}`));
    page.on('pageerror', (error) => events.pageErrors.push(String(error)));
    page.on('requestfailed', (request) => events.requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`));
    page.on('response', (response) => { if (response.status() >= 400) events.httpErrors.push(`${response.status()} ${response.url()}`); });
    await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    try {
      const response = await page.goto(`${ROOT}/works/naive-2026-09-12/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
      const frame = page.frames().find((candidate) => candidate.url().includes('/studies/naive-art/v008/'));
      if (!frame) throw new Error('production v008 tableau iframe did not attach');
      await frame.waitForSelector('#field');
      const evidence = await page.evaluate(() => {
        const stage = document.querySelector('.work-inspect__stage iframe');
        const title = document.querySelector('.work-inspect__heading h1');
        return {
          innerWidth: window.innerWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          tableauFirst: Boolean(stage && title && stage.getBoundingClientRect().top < title.getBoundingClientRect().top),
          ready: document.querySelector('[data-catalog-work-detail][data-ready="true"]')?.getAttribute('data-ready') === 'true'
        };
      });
      const state = await frame.evaluate(() => window.__mutineNaiveV008?.getState());
      const file = `matrix-${width}x${height}-${reducedMotion ? 'reduced' : 'normal'}.png`;
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
      results.push({ width, height, reducedMotion, status: response?.status(), evidence, state: { stage: state?.stage, memory: state?.memory, structuralMemory: state?.structuralMemory }, events, capture: file });
    } catch (error) {
      results.push({ width, height, reducedMotion, pass: false, error: String(error), events });
    } finally {
      await page.close();
    }
  }
}

await browser.close();
const pass = results.length === 10 && results.every((run) => run.status === 200 && run.evidence?.ready && run.evidence?.innerWidth === run.evidence?.clientWidth && run.evidence?.scrollWidth <= run.evidence?.innerWidth && run.evidence?.tableauFirst && run.events.console.length === 0 && run.events.pageErrors.length === 0 && run.events.requestFailures.length === 0 && run.events.httpErrors.length === 0);
const output = { stableAlias: ROOT, route: `${ROOT}/works/naive-2026-09-12/`, results, pass };
await writeFile(`${OUT}/matrix-results.json`, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ pass, runs: results.length, failures: results.filter((run) => run.pass === false).length, captures: results.map((run) => run.capture) })}\n`);
if (!pass) process.exitCode = 1;
