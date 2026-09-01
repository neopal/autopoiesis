import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const results = JSON.parse(readFileSync(new URL('./results.json', import.meta.url), 'utf8'));
const route = 'http://127.0.0.1:4179/research/qa/proofs/naive-art-recomposition-2026-09-01/';

test('the browser probe records the final navigated study URL for each viewport', () => {
  for (const item of results.matrix) {
    const [width, height] = item.requested;
    assert.equal(item.state.url, `${route}?study=${width}x${height}`);
  }
});

test('the browser probe proves that artwork pixels differ from the paper field', () => {
  for (const item of results.matrix) {
    assert.ok(item.state.artworkPixels > 0, `artwork pixels missing at ${item.requested.join('x')}`);
  }
});
