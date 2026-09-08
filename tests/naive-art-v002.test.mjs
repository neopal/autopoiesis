import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { applyCorrection, buildFrame, buildTimeline, deleteLatestCorrection, distance, layoutForViewport } = await import('../studies/naive-art/v002/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Naive v002 turns retained correction into a visible spatial displacement', () => {
  const frame = buildTimeline()[5];
  const withoutMemory = buildFrame(frame.stage, []);
  const houseDelta = Math.abs(frame.scene.houseX - withoutMemory.scene.houseX);
  const doorDelta = Math.abs(frame.scene.door.x - withoutMemory.scene.door.x);
  const pathDelta = Math.abs(frame.scene.pathBend - withoutMemory.scene.pathBend);

  assert.ok(frame.memory.length >= 3);
  assert.ok(houseDelta > 0.035, `expected house displacement, got ${houseDelta}`);
  assert.ok(doorDelta > 0.035, `expected door displacement, got ${doorDelta}`);
  assert.ok(pathDelta > 0.045, `expected path displacement, got ${pathDelta}`);
  assert.ok(distance(frame.scene.door, withoutMemory.scene.door) > 0.035);
});

test('Naive v002 keeps refused and kept compositions separated at narrow sizes', () => {
  const mobile = layoutForViewport(390, 844);
  const desktop = layoutForViewport(1280, 800);

  assert.equal(mobile.mode, 'stacked');
  assert.ok(mobile.panels[1].y - (mobile.panels[0].y + mobile.panels[0].h) >= 0.08);
  assert.equal(desktop.mode, 'diptych');
  assert.ok(desktop.panels[1].x - (desktop.panels[0].x + desktop.panels[0].w) >= 0.08);
});

test('Naive v002 correction interaction changes inherited geometry and can be undone', () => {
  const frame = buildTimeline()[4];
  const corrected = applyCorrection(frame, { x: 0.82, y: 0.38 });
  const repeated = applyCorrection(frame, { x: 0.82, y: 0.38 });
  const restored = deleteLatestCorrection(corrected);

  assert.equal(corrected.memory.length, frame.memory.length + 1);
  assert.equal(corrected.memory.at(-1).source, 'visitor-correction');
  assert.deepEqual(corrected.memory.at(-1).point, { x: 0.82, y: 0.38 });
  assert.deepEqual(repeated, corrected);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.ok(Math.abs(corrected.scene.houseX - restored.scene.houseX) > 0.02);
});

test('Naive v002 tableau exposes a real interaction and preview-safe reduced-motion path', async () => {
  const index = await read('studies/naive-art/v002/index.html');
  const sketch = await read('studies/naive-art/v002/sketch.js');
  const style = await read('studies/naive-art/v002/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="correction-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /setAttribute\('viewBox'/);
  assert.match(sketch, /applyCorrection/);
  assert.match(sketch, /deleteLatestCorrection/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v002 is recorded as the 2026-09-02 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const record = works.works.find((work) => work.id === 'naive-2026-09-02');

  assert.ok(record);
  assert.equal(record.currentId, 'naive');
  assert.equal(record.date, '2026-09-02');
  assert.equal(record.rawPath, '/studies/naive-art/v002/');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-02');
  assert.ok(record.critiques.length >= 3);
  assert.ok(record.metrics.memoryRule.includes('spatial displacement'));
  assert.equal(await read('studies/naive-art/v002/index.html').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-02/index.html').then(Boolean), true);
});
