import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  applyReversal,
  buildFrame,
  buildTimeline,
  deleteLatestReversal,
  layoutForViewport,
  routeSignature
} = await import('../studies/naive-art/v006/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Naive v006 makes a retained mistake reverse before continuing', () => {
  const frame = buildTimeline()[8];
  const withoutMemory = buildFrame(frame.stage, []);
  const reversals = frame.scene.reversals;

  assert.ok(frame.memory.length >= 7);
  assert.ok(reversals.length >= 7);
  assert.notDeepEqual(reversals, withoutMemory.scene.reversals);
  assert.notEqual(routeSignature(frame), routeSignature(withoutMemory));
  assert.ok(reversals.some((point) => point.phase === 'return'), 'the kept route must visibly return into its own trace');
  assert.equal(frame.scene.house.reversalDriven, true);
});

test('Naive v006 visitor reversal changes the field and undo reconstructs it exactly', () => {
  const frame = buildTimeline()[6];
  const leftPlacement = applyReversal(frame, { x: 0.18, y: 0.30 });
  const rightPlacement = applyReversal(frame, { x: 0.82, y: 0.68 });
  const restored = deleteLatestReversal(leftPlacement);

  assert.equal(leftPlacement.memory.at(-1).source, 'visitor-reversal');
  assert.notDeepEqual(leftPlacement.scene.reversalRecords, rightPlacement.scene.reversalRecords);
  assert.notEqual(routeSignature(leftPlacement), routeSignature(frame));
  assert.equal(restored.memory.length, frame.memory.length);
  assert.deepEqual(restored.scene.reversals, frame.scene.reversals);
  assert.deepEqual(restored.scene.house.reversals, frame.scene.house.reversals);
  assert.equal(routeSignature(restored), routeSignature(frame));
});

test('Naive v006 tableau exposes structural reversal interaction and preview-safe settling', async () => {
  const index = await read('studies/naive-art/v006/index.html');
  const sketch = await read('studies/naive-art/v006/sketch.js');
  const style = await read('studies/naive-art/v006/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="reverse-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyReversal/);
  assert.match(sketch, /deleteLatestReversal/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-reversal/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v006 is recorded exactly once as the 2026-09-10 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-10');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'naive-2026-09-10');
  assert.equal(record.rawPath, '/studies/naive-art/v006/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-10');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /revers/);
  assert.equal(await read('studies/naive-art/v006/README.md').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-10/index.html').then(Boolean), true);
});
