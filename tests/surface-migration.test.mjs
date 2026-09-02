import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};
const currentPages = [
  'currents/handwriting/index.html',
  'currents/self-portrait/index.html',
  'currents/pure-svg/index.html',
  'currents/brush/index.html',
  'currents/naive-art/index.html',
  'currents/webgpu/index.html'
];
const rawRoutes = [
  ['studies/handwriting/v001/index.html', 'typography-2026-08-28'],
  ['studies/handwriting/v002/index.html', 'typography-2026-08-31'],
  ['studies/p5-brush/v001/index.html', 'brush-2026-08-28'],
  ['studies/p5-brush/v002/index.html', 'brush-2026-08-31'],
  ['studies/pure-svg/v001/index.html', 'svg-2026-08-31'],
  ['studies/self-portrait/v001/index.html', 'portrait-2026-08-31'],
  ['studies/naive-art/v001/index.html', 'naive-2026-08-31']
];

test('root is the only gallery entry and redundant indexes are redirected', async () => {
  assert.equal(await exists('index.html'), true);
  for (const path of ['galerie/index.html', 'courants/index.html', 'oeuvres/index.html', 'chantiers/index.html', 'atelier/index.html', 'studio/index.html']) assert.equal(await exists(path), false, path);
  const vercel = JSON.parse(await read('vercel.json'));
  assert.deepEqual(vercel.redirects.slice(0, 5).map((redirect) => [redirect.source, redirect.destination]), [
    ['/galerie/', '/'], ['/atelier/', '/'], ['/courants/', '/'], ['/oeuvres/', '/'], ['/chantiers/', '/']
  ]);
});

test('primary navigation exposes only Gallery and Journal', async () => {
  const paths = ['index.html', 'journal/index.html', ...currentPages, ...JSON.parse(await read('studio/data/works.json')).works.map((work) => `works/${work.id}/index.html`)];
  for (const path of paths) {
    const html = await read(path);
    const nav = html.match(/<nav class="(?:studio-nav|gallery-nav)"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(hrefs, ['/', '/journal/'], `${path} primary navigation`);
  }
});

test('canonical work pages expose a data-driven daily detail mount', async () => {
  const works = JSON.parse(await read('studio/data/works.json')).works;
  for (const work of works) {
    const html = await read(`works/${work.id}/index.html`);
    assert.match(html, new RegExp(`data-catalog-work-detail="${work.id}"`));
    assert.doesNotMatch(html, /data-catalog-version|\?version=/);
  }
});

test('raw tableau pages redirect direct visitors and preserve preview mode', async () => {
  for (const [path, workId] of rawRoutes) {
    const html = await read(path);
    assert.match(html, new RegExp(`data-raw-work-id="${workId}"`), path);
    assert.match(html, /raw-bridge\.js/);
    assert.match(html, /preview-mode/);
  }
});

test('HTML has no dead placeholder links or legacy primary routes', async () => {
  const files = [
    'index.html', 'journal/index.html', ...currentPages,
    ...JSON.parse(await read('studio/data/works.json')).works.map((work) => `works/${work.id}/index.html`)
  ];
  for (const path of files) {
    const html = await read(path);
    assert.doesNotMatch(html, /href="#"|href="null"/);
    assert.doesNotMatch(html, /href="\/(galerie|courants|oeuvres|chantiers|atelier)\/"/);
  }
});
