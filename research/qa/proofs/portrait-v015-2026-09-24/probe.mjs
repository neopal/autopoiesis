import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = process.env.MUTINE_QA_BASE_URL ?? 'http://127.0.0.1:51415';
const raw = `${base}/studies/self-portrait/v015/`;
const canonical = `${base}/works/portrait-2026-09-24/`;
const viewports = [[320, 568], [390, 844], [768, 1024], [1280, 800], [1920, 1080]];
const proofUrl = new URL('./', import.meta.url);
await mkdir(proofUrl, { recursive: true });

function cleanConsole(messages) { return messages.map((message) => message.slice(0, 400)); }

async function inspectPage(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#field');
    const rect = canvas?.getBoundingClientRect();
    const controls = [...document.querySelectorAll('.field-controls button')].map((button) => {
      const bounds = button.getBoundingClientRect();
      return { label: button.textContent.trim(), width: bounds.width, height: bounds.height };
    });
    return {
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      canvas: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      state: window.__mutinePortraitV015?.getState?.() ?? null,
      controls
    };
  });
}

async function runRoute(browser, route, label, viewport, reduced) {
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
  await page.waitForTimeout(reduced ? 100 : 180);
  let initial = await inspectPage(page);
  let tableauOrder = null;
  if (label === 'canonical') {
    await page.waitForSelector('iframe');
    await page.waitForTimeout(140);
    const embeddedFrame = page.frames().find((frame) => frame.url().includes('/studies/self-portrait/v015/'));
    const embedded = embeddedFrame ? await inspectPage(embeddedFrame) : null;
    tableauOrder = await page.evaluate(() => {
      const mount = document.querySelector('[data-catalog-work-detail]');
      const iframe = mount?.querySelector('iframe');
      const title = mount?.querySelector('h1');
      return {
        iframePresent: Boolean(iframe),
        iframeBeforeTitle: Boolean(iframe && title && iframe.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING),
        iframeRect: iframe?.getBoundingClientRect().toJSON() ?? null,
        titleRect: title?.getBoundingClientRect().toJSON() ?? null
      };
    });
    initial = { outer: initial, embedded, tableauOrder };
  }
  const screenshot = new URL(`./${label}-${viewport[0]}x${viewport[1]}-${reduced ? 'reduced' : 'normal'}.png`, proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot) });
  const result = { label, viewport: `${viewport[0]}x${viewport[1]}`, reduced, initial, consoleMessages: cleanConsole(consoleMessages), pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

async function runInteraction(browser) {
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
  await page.goto(`${raw}?preview=1&interaction=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(100);
  const initial = await inspectPage(page);
  await page.getByRole('button', { name: 'release pressure' }).click();
  await page.waitForTimeout(40);
  const released = await inspectPage(page);
  await page.mouse.click(310, 300);
  await page.waitForTimeout(50);
  const pointer = await inspectPage(page);
  const canvas = page.locator('#field');
  await canvas.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(50);
  const keyboard = await inspectPage(page);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(50);
  const lifted = await inspectPage(page);
  await page.getByRole('button', { name: 'release pressure' }).click();
  await page.waitForTimeout(50);
  const releasedAgain = await inspectPage(page);
  const screenshot = new URL('./raw-interaction-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot) });
  const result = {
    initial, released, pointer, keyboard, lifted, releasedAgain,
    liftedMatchesPointer: lifted.state?.signature === pointer.state?.signature,
    releaseClearsMemory: releasedAgain.state?.memory === 0,
    touchTargets: keyboard.controls,
    consoleMessages: cleanConsole(consoleMessages), pageErrors, requestFailures, badResponses,
    screenshot: fileURLToPath(screenshot)
  };
  await context.close();
  return result;
}

async function runBlind(browser) {
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
  await page.goto(`${raw}?preview=1&static=1&blind=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(80);
  const inspection = await inspectPage(page);
  const visibility = await page.evaluate(() => ({
    readout: getComputedStyle(document.querySelector('.surface-readout')).display,
    controls: getComputedStyle(document.querySelector('.field-controls')).display,
    canvasVisible: getComputedStyle(document.querySelector('#field')).display !== 'none'
  }));
  const screenshot = new URL('./static-blind-390x844.png', proofUrl);
  await page.screenshot({ path: fileURLToPath(screenshot) });
  const result = { inspection, visibility, consoleMessages: cleanConsole(consoleMessages), pageErrors, requestFailures, badResponses, screenshot: fileURLToPath(screenshot) };
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = { raw: [], canonical: [], interaction: null, blind: null };
for (const reduced of [false, true]) for (const viewport of viewports) results.raw.push(await runRoute(browser, `${raw}?preview=1`, 'raw', viewport, reduced));
results.interaction = await runInteraction(browser);
results.blind = await runBlind(browser);
for (const reduced of [false, true]) for (const viewport of viewports) results.canonical.push(await runRoute(browser, canonical, 'canonical', viewport, reduced));
await browser.close();
const summary = {
  rawRuns: results.raw.length,
  canonicalRuns: results.canonical.length,
  rawIssues: results.raw.flatMap((run) => [...run.consoleMessages, ...run.pageErrors, ...run.requestFailures, ...run.badResponses]),
  canonicalIssues: results.canonical.flatMap((run) => [...run.consoleMessages, ...run.pageErrors, ...run.requestFailures, ...run.badResponses]),
  interactionIssues: [...results.interaction.consoleMessages, ...results.interaction.pageErrors, ...results.interaction.requestFailures, ...results.interaction.badResponses],
  blindIssues: [...results.blind.consoleMessages, ...results.blind.pageErrors, ...results.blind.requestFailures, ...results.blind.badResponses],
  results
};
await writeFile(new URL('./results.json', proofUrl), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({
  rawRuns: summary.rawRuns,
  canonicalRuns: summary.canonicalRuns,
  rawIssues: summary.rawIssues.length,
  canonicalIssues: summary.canonicalIssues.length,
  interactionIssues: summary.interactionIssues.length,
  blindIssues: summary.blindIssues.length,
  interaction: { released: results.interaction.released.state, pointer: results.interaction.pointer.state, keyboard: results.interaction.keyboard.state, liftedMatchesPointer: results.interaction.liftedMatchesPointer, releasedAgain: results.interaction.releasedAgain.state },
  blind: results.blind.visibility
}));
