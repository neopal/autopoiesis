import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the browser comparison keeps its module import stable after directory canonicalization', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

  assert.match(html, /from\s+['"]\/research\/qa\/proofs\/typography-caption-free-2026-09-02\/comparison\.mjs['"]/);
  assert.doesNotMatch(html, /from\s+['"]\.\/comparison\.mjs['"]/);
});
