import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { applyCorrection, buildFrame, buildTimeline, deleteLatestCorrection, layoutForViewport } = await import('../studies/naive-art/v003/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function routeSignature(frame) {
  return frame.scene.route.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|');
}

test('Naive v003 turns remembered corrections into a migrated architectural threshold', () => {
  const frame = buildTimeline()[6];
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 5);
  assert.notEqual(frame.scene.opening.wall, 'front');
  assert.notEqual(frame.scene.opening.wall, withoutMemory.scene.opening.wall);
  assert.notEqual(routeSignature(frame), routeSignature(withoutMemory));
  assert.ok(frame.scene.opening.crossesBody, 'the kept opening must cross the house body');
  assert.ok(frame.scene.route.some((point) => point.inside), 'the route must enter the kept house');
});

test('Naive v003 visitor correction chooses a new opening topology and undo restores it', () => {
  const frame = buildTimeline()[4];
  const leftCorrection = applyCorrection(frame, { x: 0.18, y: 0.42 });
  const rightCorrection = applyCorrection(frame, { x: 0.82, y: 0.42 });
  const restored = deleteLatestCorrection(leftCorrection);

  assert.equal(leftCorrection.memory.at(-1).source, 'visitor-threshold');
  assert.equal(leftCorrection.memory.at(-1).wallStep, 1);
  assert.equal(rightCorrection.memory.at(-1).wallStep, 2);
  assert.notEqual(leftCorrection.scene.opening.wall, rightCorrection.scene.opening.wall);
  assert.notEqual(routeSignature(leftCorrection), routeSignature(frame));
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(restored.scene.opening.wall, frame.scene.opening.wall);
  assert.equal(routeSignature(restored), routeSignature(frame));
});

test('Naive v003 keeps the refused and migrated thresholds separated on narrow screens', () => {
  const mobile = layoutForViewport(390, 844);
  const desktop = layoutForViewport(1280, 800);

  assert.equal(mobile.mode, 'stacked');
  assert.ok(mobile.panels[1].y - (mobile.panels[0].y + mobile.panels[0].h) >= 0.08);
  assert.equal(desktop.mode, 'diptych');
  assert.ok(desktop.panels[1].x - (desktop.panels[0].x + desktop.panels[0].w) >= 0.08);
});

test('Naive v003 tableau exposes threshold interaction and preview-safe settling', async () => {
  const index = await read('studies/naive-art/v003/index.html');
  const sketch = await read('studies/naive-art/v003/sketch.js');
  const style = await read('studies/naive-art/v003/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="threshold-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyCorrection/);
  assert.match(sketch, /deleteLatestCorrection/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v003 renders the kept route crossing above the house body', async () => {
  const sketch = await read('studies/naive-art/v003/sketch.js');
  assert.ok(sketch.indexOf('${house}') < sketch.indexOf('route-crossing'), 'the interior crossing must be painted after the house');
});

test('Naive v003 gives the visible interior crossing a structural contrast', async () => {
  const style = await read('studies/naive-art/v003/style.css');
  assert.match(style, /\.route-crossing\{[^}]*stroke:#4f7e8b/);
});

test('Naive v003 is recorded as the 2026-09-04 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const record = works.works.find((work) => work.id === 'naive-2026-09-04');

  assert.ok(record);
  assert.equal(record.currentId, 'naive');
  assert.equal(record.date, '2026-09-04');
  assert.equal(record.rawPath, '/studies/naive-art/v003/');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-04');
  assert.ok(record.critiques.length >= 3);
  assert.ok(record.metrics.memoryRule.includes('threshold'));
  assert.equal(await read('studies/naive-art/v003/index.html').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-04/index.html').then(Boolean), true);
});
