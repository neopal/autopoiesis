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
} = await import('../studies/naive-art/v005/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Naive v005 turns retained mistakes into a shared route-and-house hinge', () => {
  const frame = buildTimeline()[7];
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 6);
  assert.ok(frame.scene.turns.length >= 2);
  assert.notDeepEqual(frame.scene.turns, withoutMemory.scene.turns);
  assert.notEqual(routeSignature(frame), routeSignature(withoutMemory));
  assert.notDeepEqual(frame.scene.house.hinges, withoutMemory.scene.house.hinges);
  assert.ok(frame.scene.route.some((point) => point.turn), 'the kept route must carry the remembered turn');
  assert.equal(frame.scene.house.hingeDriven, true);
});

test('Naive v005 visitor correction changes hinge geometry and undo reconstructs the exact field', () => {
  const frame = buildTimeline()[5];
  const leftPlacement = applyCorrection(frame, { x: 0.18, y: 0.30 });
  const rightPlacement = applyCorrection(frame, { x: 0.82, y: 0.68 });
  const restored = deleteLatestCorrection(leftPlacement);

  assert.equal(leftPlacement.memory.at(-1).source, 'visitor-wrong-turn');
  assert.notDeepEqual(leftPlacement.scene.turns, rightPlacement.scene.turns);
  assert.notEqual(routeSignature(leftPlacement), routeSignature(frame));
  assert.equal(restored.memory.length, frame.memory.length);
  assert.deepEqual(restored.scene.turns, frame.scene.turns);
  assert.deepEqual(restored.scene.house.hinges, frame.scene.house.hinges);
  assert.equal(routeSignature(restored), routeSignature(frame));
});

test('Naive v005 keeps proposal and consequence separated on narrow and wide screens', () => {
  const mobile = layoutForViewport(320, 568);
  const desktop = layoutForViewport(1920, 1080);

  assert.equal(mobile.mode, 'stacked');
  assert.ok(mobile.panels[1].y - (mobile.panels[0].y + mobile.panels[0].h) >= 0.08);
  assert.equal(desktop.mode, 'diptych');
  assert.ok(desktop.panels[1].x - (desktop.panels[0].x + desktop.panels[0].w) >= 0.08);
});

test('Naive v005 tableau exposes meaningful interaction and preview-safe settling', async () => {
  const index = await read('studies/naive-art/v005/index.html');
  const sketch = await read('studies/naive-art/v005/sketch.js');
  const style = await read('studies/naive-art/v005/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="turn-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyCorrection/);
  assert.match(sketch, /deleteLatestCorrection/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v005 keeps the changed rule visible in rendered source', async () => {
  const sketch = await read('studies/naive-art/v005/sketch.js');
  assert.ok(sketch.indexOf('${house}') < sketch.indexOf('route-turn'), 'the turned route must be painted after the house');
  assert.match(sketch, /hinge/);
  assert.match(sketch, /turns/);
});

test('Naive v005 is recorded as the 2026-09-08 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const record = works.works.find((work) => work.id === 'naive-2026-09-08');

  assert.ok(record);
  assert.equal(record.currentId, 'naive');
  assert.equal(record.date, '2026-09-08');
  assert.equal(record.rawPath, '/studies/naive-art/v005/');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-08');
  assert.ok(record.critiques.length >= 3);
  assert.ok(record.metrics.memoryRule.includes('turn'));
  assert.equal(await read('studies/naive-art/v005/index.html').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-08/index.html').then(Boolean), true);
});
