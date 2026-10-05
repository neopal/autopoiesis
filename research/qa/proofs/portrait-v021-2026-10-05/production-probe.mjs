import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = 'https://autopoiesis-nine.vercel.app';
const raw = '/studies/self-portrait/v021/?preview=1&interaction=1';
const canonical = '/works/portrait-2026-10-05/';
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const runs = [];

function diagnosticsFor(page) {
  const diagnostics = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => diagnostics.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', (request) => diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`); });
  return diagnostics;
}

for (const reducedMotion of [false, true]) {
  for (const [width, height] of viewports) {
    for (const [kind, path] of [['raw', raw], ['canonical', canonical]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
      const diagnostics = diagnosticsFor(page);
      await page.goto(base + path, { waitUntil: 'networkidle' });
      let metrics;
      if (kind === 'raw') {
        await page.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
        metrics = await page.evaluate(() => {
          const field = document.querySelector('#blind-field');
          const canvas = field?.querySelector('canvas');
          const rect = canvas?.getBoundingClientRect();
          return { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, canvasVisible: Boolean(rect && rect.width > 0 && rect.height > 0), state: window.__mutinePortraitV021.getState() };
        });
        assert.equal(metrics.canvasVisible, true);
      } else {
        await page.locator('iframe').first().waitFor({ state: 'visible', timeout: 20000 });
        const frame = page.frames().find((candidate) => candidate !== page.mainFrame() && candidate.url().includes('/studies/self-portrait/v021/'));
        assert.ok(frame, `production canonical iframe missing at ${width}x${height}`);
        await frame.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
        metrics = await page.evaluate(() => {
          const iframe = document.querySelector('iframe');
          const heading = document.querySelector('h1');
          const frameRect = iframe?.getBoundingClientRect();
          const headingRect = heading?.getBoundingClientRect();
          return { innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, tableauFirst: Boolean(frameRect && headingRect && frameRect.top <= headingRect.top), title: heading?.textContent?.trim() || '' };
        });
        assert.equal(metrics.tableauFirst, true);
      }
      assert.equal(metrics.innerWidth, metrics.clientWidth);
      assert.ok(metrics.scrollWidth <= metrics.innerWidth);
      assert.deepEqual(diagnostics, { console: [], pageErrors: [], requestFailures: [], badResponses: [] });
      runs.push({ kind, reducedMotion, width, height, metrics, diagnostics });
      await page.close();
    }
  }
}

const interactionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await interactionPage.emulateMedia({ reducedMotion: 'no-preference' });
const interactionDiagnostics = diagnosticsFor(interactionPage);
await interactionPage.goto(base + raw, { waitUntil: 'networkidle' });
await interactionPage.waitForFunction(() => window._p5Ready === true, null, { timeout: 20000 });
const interactionField = interactionPage.locator('#blind-field');
await interactionField.focus();
const state = () => interactionPage.evaluate(() => window.__mutinePortraitV021.getState());
const baseline = await state();
await interactionPage.mouse.click(195, 420);
const afterTap = await state();
assert.equal(afterTap.memory, baseline.memory);
await interactionPage.getByRole('button', { name: 'leave a blind side' }).click();
const afterButton = await state();
assert.equal(afterButton.memory, 1);
await interactionField.focus();
await interactionPage.keyboard.press('Enter');
const afterEnter = await state();
assert.equal(afterEnter.memory, 2);
await interactionPage.keyboard.press('Delete');
const afterDelete = await state();
assert.equal(afterDelete.memory, 1);
assert.equal(afterDelete.signature, afterButton.signature);
await interactionPage.keyboard.press('R');
const afterRelease = await state();
assert.equal(afterRelease.memory, 0);
await interactionPage.mouse.move(195, 420);
await interactionPage.mouse.move(395, 420);
const afterDepart = await state();
assert.equal(afterDepart.memory, 1);
assert.deepEqual(interactionDiagnostics, { console: [], pageErrors: [], requestFailures: [], badResponses: [] });
await interactionPage.close();

const journalPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
const journalDiagnostics = diagnosticsFor(journalPage);
await journalPage.goto(base + '/journal/', { waitUntil: 'networkidle' });
await journalPage.locator('#journal-portrait-2026-10-05').waitFor({ state: 'visible', timeout: 20000 });
const journal = await journalPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('#journal-portrait-2026-10-05 h3')?.textContent?.trim() || '' }));
assert.equal(journal.title, 'The portrait keeps a blind side.');
assert.ok(journal.scrollWidth <= journal.innerWidth);
assert.deepEqual(journalDiagnostics, { console: [], pageErrors: [], requestFailures: [], badResponses: [] });
await journalPage.close();

const currentPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
const currentDiagnostics = diagnosticsFor(currentPage);
await currentPage.goto(base + '/currents/self-portrait/', { waitUntil: 'networkidle' });
await currentPage.getByText('The portrait keeps a blind side.', { exact: true }).first().waitFor({ state: 'visible', timeout: 20000 });
const current = await currentPage.evaluate(() => ({ innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, title: document.body.innerText.includes('The portrait keeps a blind side.') }));
assert.equal(current.title, true);
assert.ok(current.scrollWidth <= current.innerWidth);
assert.deepEqual(currentDiagnostics, { console: [], pageErrors: [], requestFailures: [], badResponses: [] });
await currentPage.close();
await browser.close();
console.log(JSON.stringify({ production: base, viewportRuns: `${runs.length}/${runs.length}`, requiredViewports: viewports.map(([width, height]) => `${width}x${height}`), diagnosticsCount: 0, overflowCount: 0, interaction: 'tap 0; button 0→1; Enter 1→2; Delete 2→1 exact; R →0; approach/departure 0→1', journal, current }, null, 2));
