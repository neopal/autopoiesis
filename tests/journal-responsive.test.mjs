import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalogCss = await readFile(new URL('../studio/catalog.css', import.meta.url), 'utf8');

test('journal calendar events can shrink inside narrow day cells', () => {
  assert.match(catalogCss, /\.journal-calendar__event\s*\{[^}]*min-width:\s*0;/s);
  assert.match(catalogCss, /\.journal-calendar__event\s+strong\s*\{[^}]*min-width:\s*0;/s);
});
