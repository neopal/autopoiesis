import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
const root = resolve('C:/Users/ASUS/autopoiesis');
const port = 4186;
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = resolve(root, `.${normalize(p)}`);
    const info = await stat(file);
    res.writeHead(200, {'content-type': mime[extname(file)] ?? 'application/octet-stream'});
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('console', (message) => console.log('console', message.type(), message.text()));
page.on('pageerror', (error) => console.log('pageerror', error.message));
page.on('response', (response) => { if (response.status() >= 400) console.log('bad', response.status(), response.url()); });
await page.goto(`http://127.0.0.1:${port}/works/naive-2026-09-25/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-catalog-work-detail][data-ready="true"]'), null, { timeout: 10000 });
console.log(await page.evaluate(() => ({
  mount: document.querySelector('[data-catalog-work-detail]')?.innerHTML.slice(0, 500),
  iframe: document.querySelector('.work-inspect__stage iframe')?.outerHTML.slice(0, 400),
  allIframes: [...document.querySelectorAll('iframe')].map((frame) => frame.src),
  headings: [...document.querySelectorAll('h1')].map((heading) => heading.textContent)
})));
await browser.close();
server.close();
