import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v016/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v016 engine must exist before its topology can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v016 turns a meaningful drag into a remembered graph splice and lifts it exactly', async () => {
  const {
    buildFrame,
    applyKnot,
    geometrySignature,
    liftLatestKnot
  } = await loadEngine();
  const frame = buildFrame(0, []);
  const gesture = { start: { x: 0.16, y: 0.28 }, end: { x: 0.82, y: 0.74 } };
  const changed = applyKnot(frame, gesture);
  const restored = liftLatestKnot(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'topological-knot');
  assert.ok(changed.graph.removedEdges.length >= 2);
  assert.ok(changed.graph.bridgeEdges.length >= 2);
  assert.notEqual(changed.graph.signature, frame.graph.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v016 refuses a short click, bounds gestures, and keeps a four-knot archive', async () => {
  const {
    MEMORY_LIMIT,
    applyKnot,
    buildFrame,
    buildTimeline,
    geometrySignature
  } = await loadEngine();
  const frame = buildFrame(0, []);
  const click = applyKnot(frame, { start: { x: 0.4, y: 0.4 }, end: { x: 0.42, y: 0.41 } });
  const bounded = applyKnot(frame, { start: { x: -2, y: 9 }, end: { x: 3, y: -4 } });
  const settled = buildTimeline().at(-1);

  assert.equal(geometrySignature(click), geometrySignature(frame));
  assert.equal(bounded.memory[0].start.x, 0.06);
  assert.equal(bounded.memory[0].start.y, 0.92);
  assert.equal(bounded.memory[0].end.x, 0.94);
  assert.equal(bounded.memory[0].end.y, 0.08);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.graph.spliceCount, MEMORY_LIMIT);
  assert.equal(settled.graph.removedEdges.length, MEMORY_LIMIT * 2);
  assert.equal(settled.graph.bridgeEdges.length, MEMORY_LIMIT * 2);
});

test('WebGPU v016 exposes a tableau-first lattice browser contract and evidence files', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v016/index.html');
  const sketch = await read('studies/webgpu/v016/sketch.js');
  const style = await read('studies/webgpu/v016/style.css');
  const readme = await read('studies/webgpu/v016/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v016/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v016/critiques.json'));

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="splice"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /webgl2|WebGPU/i);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyKnot/);
  assert.match(sketch, /liftLatestKnot/);
  assert.match(sketch, /releaseKnots/);
  assert.match(sketch, /blindMode/);
  assert.match(sketch, /webgl2/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic WebGL2 lattice');
  assert.match(metrics.memoryRule, /drag|splice|edge|knot/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v016 is recorded exactly once for the 2026-09-25 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-25');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-25');
  assert.equal(record.rawPath, '/studies/webgpu/v016/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-25');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /drag|splice|edge|knot/i);
  assert.equal(await read('works/webgpu-2026-09-25/index.html').then(Boolean), true);
});
