import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('handwriting v029 uses a DOM word archipelago before its explanation', async () => {
  const html = await read('studies/handwriting/v029/index.html');
  const sketch = await read('studies/handwriting/v029/sketch.js');
  const style = await read('studies/handwriting/v029/style.css');

  assert.match(html, /id="attention-field"/);
  assert.match(html, /id="word-archipelago"/);
  assert.match(html, /id="take-census"/);
  assert.match(html, /id="lift-census"/);
  assert.match(html, /id="release-census"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-20"/);
  assert.match(sketch, /takeCensus/);
  assert.match(sketch, /__mutineHandwritingV029/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /min-height: 44px/);
  assert.doesNotMatch(html, /p5\.min\.js/);
});

test('handwriting v029 makes attention observational until a census changes DOM word bodies', async () => {
  const html = await read('studies/handwriting/v029/index.html');
  const sketch = await read('studies/handwriting/v029/sketch.js');
  assert.match(html, /role="application"/);
  assert.match(html, /wander the words/);
  assert.match(sketch, /observeTile/);
  assert.match(sketch, /textContent/);
  assert.match(sketch, /takeCensus/);
});
