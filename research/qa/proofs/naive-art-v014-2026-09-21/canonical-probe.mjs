import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173';
const canonical = `${base}/works/naive-2026-09-21/`;
const proofDir = 'research/qa/proofs/naive-art-v014-2026-09-21';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 }
];

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];

function attachIssues(page) {
  const issues = { console: [], pageErrors: [], requestFailures: [], badResponses: [] };
  page.on('console', (message) => issues.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => issues.pageErrors.push(String(error)));
  page.on('requestfailed', (request) => issues.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', (response) => { if (response.status() >= 400) issues.badResponses.push(`${response.status()} ${response.url()}`); });
  return issues;
}

for (const viewport of viewports) {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const issues = attachIssues(page);
    const response = await page.goto(canonical, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-catalog-work-detail][data-ready="true"]');
    await page.waitForSelector('.work-inspect__stage iframe');
    await page.waitForFunction(() => document.querySelector('.work-inspect__stage iframe')?.contentDocument?.querySelector('#field'));
    await page.waitForTimeout(120);
    const snapshot = await page.evaluate(({ viewport, reduced, issues }) => {
      const mount = document.querySelector('[data-catalog-work-detail]');
      const iframe = mount?.querySelector('iframe');
      const heading = mount?.querySelector('h1');
      const firstElements = mount ? [...mount.querySelectorAll('*')] : [];
      const frameDocument = iframe?.contentDocument;
      const canvas = frameDocument?.querySelector('#field');
      const canvasRect = canvas?.getBoundingClientRect();
      const iframeRect = iframe?.getBoundingClientRect();
      const headingRect = heading?.getBoundingClientRect();
      const frameButtons = frameDocument ? [...frameDocument.querySelectorAll('button')].map((button) => ({ id: button.id, height: button.getBoundingClientRect().height })) : [];
      return {
        viewport,
        reducedMotion: reduced,
        responseStatus: 200,
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        iframeCount: mount?.querySelectorAll('iframe').length ?? 0,
        tableauFirst: iframe && heading ? firstElements.indexOf(iframe) < firstElements.indexOf(heading) : false,
        iframeVisible: Boolean(iframeRect?.width && iframeRect?.height),
        headingVisible: Boolean(headingRect?.width && headingRect?.height),
        frameCanvas: canvas ? { width: canvasRect.width, height: canvasRect.height, visible: Boolean(canvasRect.width && canvasRect.height), stage: frameDocument.querySelector('[data-stage]')?.textContent, memory: frameDocument.querySelector('[data-memory]')?.textContent } : null,
        frameButtons,
        console: [...issues.console],
        pageErrors: [...issues.pageErrors],
        requestFailures: [...issues.requestFailures],
        badResponses: [...issues.badResponses]
      };
    }, { viewport, reduced, issues });
    snapshot.responseStatus = response?.status() ?? null;
    await page.screenshot({ path: `${proofDir}/canonical-${viewport.width}x${viewport.height}-${reduced ? 'reduced' : 'normal'}.png`, fullPage: true });
    results.push(snapshot);
    await context.close();
  }
}

await browser.close();
await writeFile(`${proofDir}/canonical-results.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify({ runs: results.length, bad: results.reduce((sum, item) => sum + item.console.length + item.pageErrors.length + item.requestFailures.length + item.badResponses.length, 0) }));
