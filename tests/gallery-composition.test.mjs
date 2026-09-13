import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery intro is a compact statement-led threshold', async () => {
  const html = await read('index.html');
  const source = await read('studio/catalog.js');

  assert.match(html, /<h1 id="artist-title">Mutine<\/h1>/);
  assert.match(source, /gallery-artist__statement/);
  assert.doesNotMatch(source, /artist-principles/);
});

test('gallery-first composition keeps home and current headers compact', async () => {
  const css = await read('studio/catalog.css');

  assert.match(css, /\.gallery-artist \{[\s\S]*padding: clamp\(24px, 4vw, 42px\) 0 clamp\(20px, 3vw, 34px\)/);
  assert.match(css, /\.gallery-artist h1 \{[^}]*clamp\(38px, 5\.5vw, 78px\)/);
  assert.match(css, /\.current-page \.studio-main \{[^}]*padding-top: clamp\(18px, 3vw, 36px\)/);
  assert.match(css, /\.current-page \.catalog-current-header__title \{[^}]*clamp\(42px, 6vw, 82px\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.gallery-artist \{[^}]*padding: clamp\(22px, 6vw, 34px\) 0/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.current-page \.catalog-current-header__title \{[^}]*clamp\(34px, 10vw, 48px\)/);
});

test('current headers keep the current name primary and the proposition secondary', async () => {
  const source = await read('studio/catalog.js');

  assert.match(source, /<h1 class="catalog-current-header__title" id="current-title">\$\{escapeHtml\(current\.title\)\}<\/h1>/);
  assert.match(source, /catalog-current-header__subtitle/);
  assert.doesNotMatch(source, /current\.title\)\}<br><i>/);
});
