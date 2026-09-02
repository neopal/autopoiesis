import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the browser comparison is a canvas-only caption-free surface', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  assert.ok(body, 'the harness must contain a body');
  assert.deepEqual(
    [...body.matchAll(/<([a-z][\w-]*)\b/gi)].map(([, tag]) => tag.toLowerCase()),
    ['canvas', 'script']
  );
  assert.match(body, /^\s*<canvas\s+id="comparison"[^>]*><\/canvas>\s*<script\s+type=["']module["'][^>]*>[\s\S]*<\/script>\s*$/i);
  assert.doesNotMatch(body, /<(?:div|p|span|h[1-6]|heading|figure|section|nav|a|img|label)\b/i);
  assert.doesNotMatch(html, /<(?:button|input|select|textarea)\b/i);
  assert.doesNotMatch(html, /fillText|textContent|innerHTML\s*=/i);
});
