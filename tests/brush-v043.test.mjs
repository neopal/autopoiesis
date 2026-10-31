import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v043/engine.mjs');

const {
  GATE_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyExchange,
  buildFrame,
  buildTimeline,
  commitTouch,
  geometrySignature,
  liftLatest,
  previewTouch,
  releaseField
} = engine;

const FIRST = { x: 0.18, y: 0.28 };
const SECOND = { x: 0.82, y: 0.68 };

 test('brush v043 begins as one deterministic perforated ink body', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'witness-chord');
  assert.equal(initial.renderer, 'deterministic p5.js Canvas 2D monolithic ink body');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.gates.length, GATE_COUNT);
  assert.ok(initial.body.shell.length > 6);
  assert.ok(initial.body.voids.length >= 3);
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v043 previews a situated call without changing the body', () => {
  const initial = buildFrame();
  const preview = previewTouch(initial, FIRST);

  assert.equal(preview.interaction, 'call-preview');
  assert.equal(preview.pending.gate, 0);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v043 arms a first call and requires a different second site', () => {
  const initial = buildFrame();
  const armed = commitTouch(initial, FIRST, 'test-first-call');
  const refused = commitTouch(armed, FIRST, 'test-self-reply');

  assert.equal(armed.interaction, 'call-armed');
  assert.equal(armed.pending.gate, 0);
  assert.equal(armed.memory.length, 0);
  assert.equal(refused.interaction, 'reply-refused-self');
  assert.equal(refused.pending.gate, 0);
  assert.equal(refused.memory.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(initial));
});

test('brush v043 closes a central fold only after reciprocal attention', () => {
  const initial = buildFrame();
  const armed = commitTouch(initial, FIRST, 'test-first-call');
  const changed = commitTouch(armed, SECOND, 'test-second-call');

  assert.equal(changed.interaction, 'exchange-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'witness-fold');
  assert.notEqual(changed.event.callGate, changed.event.replyGate);
  assert.ok(changed.body.folds.length > 0);
  assert.equal(changed.gates[changed.event.callGate].closed, false);
  assert.equal(changed.gates[changed.event.replyGate].closed, false);
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v043 refuses a miss and an invalid second site without mutating the body', () => {
  const initial = buildFrame();
  const miss = commitTouch(initial, { x: 0.02, y: 0.02 }, 'test-miss');
  const armed = commitTouch(initial, FIRST, 'test-first-call');
  const near = commitTouch(armed, { x: 0.22, y: 0.31 }, 'test-near-self');

  assert.equal(miss.interaction, 'call-refused-miss');
  assert.equal(miss.memory.length, 0);
  assert.equal(near.interaction, 'reply-refused-near');
  assert.equal(near.pending.gate, 0);
  assert.equal(near.memory.length, 0);
  assert.equal(geometrySignature(miss), geometrySignature(initial));
  assert.equal(geometrySignature(near), geometrySignature(initial));
});

test('brush v043 lifts the latest fold exactly and release returns to the sealed body', () => {
  const initial = buildFrame();
  const changed = applyExchange(initial, 0, 4, 'test-direct-exchange');
  const lifted = liftLatest(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(lifted.interaction, 'lifted');
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releaseField(changed).interaction, 'released');
  assert.equal(releaseField(changed).memory.length, 0);
});

test('brush v043 compounds four call-and-response folds deterministically', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.equal(settled.body.folds.length, MEMORY_LIMIT);
  assert.ok(settled.body.voids.some((hole) => hole.opening > 0.2));
});

test('brush v043 exposes a two-site Canvas encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v043/index.html');
  const sketch = await read('studies/p5-brush/v043/sketch.js');
  const style = await read('studies/p5-brush/v043/style.css');
  const readme = await read('studies/p5-brush/v043/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v043/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v043/critiques.json'));

  assert.match(html, /id="witness-canvas"/);
  assert.match(html, /data-gesture="call"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitTouch/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523433');
  assert.equal(metrics.grammar, 'witness-chord');
  assert.equal(metrics.renderer, 'deterministic p5.js Canvas 2D monolithic ink body');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v043 is registered exactly once for the 2026-10-31 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-31');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-31');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v043/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-31');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-30');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.changedRule, /call|reply|fold|witness/i);
  const canonical = await readFile(new URL('works/brush-2026-10-31/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-31"/);
});
