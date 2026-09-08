import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  applyCorrection,
  buildFrame,
  buildTimeline,
  deleteLatestCorrection,
  layoutForViewport,
  routeSignature
} = await import('../studies/naive-art/v004/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Naive v004 makes a remembered correction move the shared vanishing point', () => {
  const frame = buildTimeline()[7];
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 6);
  assert.notDeepEqual(frame.scene.vanishingPoint, withoutMemory.scene.vanishingPoint);
  assert.notDeepEqual(frame.scene.house.recedingEdge, withoutMemory.scene.house.recedingEdge);
  assert.notEqual(routeSignature(frame), routeSignature(withoutMemory));
  assert.ok(frame.scene.route.some((point) => point.recedes), 'the kept route must carry the perspective rule');
  assert.equal(frame.scene.house.perspectiveDriven, true);
});

test('Naive v004 exposes one vanishing point to both house guides and the scene', () => {
  const frame = buildTimeline()[8];

  assert.deepEqual(frame.scene.house.vanishingPoint, frame.scene.vanishingPoint);
});

test('Naive v004 visitor placement changes perspective and undo reconstructs the exact field', () => {
  const frame = buildTimeline()[5];
  const leftPlacement = applyCorrection(frame, { x: 0.18, y: 0.28 });
  const rightPlacement = applyCorrection(frame, { x: 0.82, y: 0.68 });
  const restored = deleteLatestCorrection(leftPlacement);

  assert.equal(leftPlacement.memory.at(-1).source, 'visitor-vanishing-point');
  assert.notDeepEqual(leftPlacement.scene.vanishingPoint, rightPlacement.scene.vanishingPoint);
  assert.notEqual(routeSignature(leftPlacement), routeSignature(frame));
  assert.equal(restored.memory.length, frame.memory.length);
  assert.deepEqual(restored.scene.vanishingPoint, frame.scene.vanishingPoint);
  assert.equal(routeSignature(restored), routeSignature(frame));
});

test('Naive v004 keeps proposal and consequence separated on narrow and wide screens', () => {
  const mobile = layoutForViewport(320, 568);
  const desktop = layoutForViewport(1920, 1080);

  assert.equal(mobile.mode, 'stacked');
  assert.ok(mobile.panels[1].y - (mobile.panels[0].y + mobile.panels[0].h) >= 0.08);
  assert.equal(desktop.mode, 'diptych');
  assert.ok(desktop.panels[1].x - (desktop.panels[0].x + desktop.panels[0].w) >= 0.08);
});

test('Naive v004 tableau exposes vanishing-point interaction and preview-safe settling', async () => {
  const index = await read('studies/naive-art/v004/index.html');
  const sketch = await read('studies/naive-art/v004/sketch.js');
  const style = await read('studies/naive-art/v004/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="vanishing-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyCorrection/);
  assert.match(sketch, /deleteLatestCorrection/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v004 draws the perspective consequence over the house as a changed structure', async () => {
  const sketch = await read('studies/naive-art/v004/sketch.js');
  assert.ok(sketch.indexOf('${house}') < sketch.indexOf('route-receding'), 'the receding route must be painted after the house');
  assert.match(sketch, /vanishingPoint/);
  assert.match(sketch, /recedingEdge/);
});

test('Naive v004 is recorded as the 2026-09-07 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const record = works.works.find((work) => work.id === 'naive-2026-09-07');

  assert.ok(record);
  assert.equal(record.currentId, 'naive');
  assert.equal(record.date, '2026-09-07');
  assert.equal(record.rawPath, '/studies/naive-art/v004/');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-07');
  assert.ok(record.critiques.length >= 3);
  assert.ok(record.metrics.memoryRule.includes('vanishing'));
  assert.equal(await read('studies/naive-art/v004/index.html').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-07/index.html').then(Boolean), true);
});
