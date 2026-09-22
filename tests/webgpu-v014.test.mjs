import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v014/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v014 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const fieldDelta = (a, b) => a.reduce((sum, node, index) => {
  const other = b[index];
  return sum + Math.hypot(node.x - other.x, node.y - other.y) + Math.abs(node.height - other.height);
}, 0);

test('WebGPU v014 compacts a crowd into a pressure archive with real surface memory', async () => {
  const {
    MEMORY_LIMIT,
    NODE_COUNT,
    STAGES,
    buildTimeline,
    liftLatestPressure
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = liftLatestPressure(frame);
  const latest = frame.memory.at(-1);

  assert.equal(frame.surface.nodes.length, NODE_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.compactedNodes > 0);
  assert.ok(frame.aggregate.creasedNodes > 0);
  assert.ok(frame.aggregate.archivedPressure > 0);
  assert.ok(fieldDelta(frame.surface.nodes, withoutLatest.surface.nodes) > 0.9);
  assert.ok(latest.pressure > 0);
  assert.ok(latest.path.length >= 3);
  assert.ok(frame.surface.faces.length > NODE_COUNT / 2);
});

test('WebGPU v014 visitor pressure is bounded, deterministic, and exactly reversible', async () => {
  const {
    applyPressure,
    buildFrame,
    buildTimeline,
    geometrySignature,
    liftLatestPressure,
    releasePressures
  } = await loadEngine();
  const frame = buildTimeline()[4];
  const path = [
    { x: -0.4, y: 0.18 },
    { x: 0.42, y: 0.48 },
    { x: 1.4, y: 0.82 }
  ];
  const next = applyPressure(frame, path, 1.8);
  const replay = applyPressure(frame, path, 1.8);
  const restored = liftLatestPressure(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).pointBounds, { minX: 0.08, minY: 0.18, maxX: 0.92, maxY: 0.82 });
  assert.equal(next.memory.at(-1).source, 'visitor-pressure');
  assert.ok(next.memory.at(-1).pressure <= 1);
  assert.ok(next.memory.at(-1).path.every((point) => point.x >= 0.06 && point.x <= 0.94));
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
  assert.equal(geometrySignature(releasePressures(next)), geometrySignature(buildFrame(0, [])));
});

test('WebGPU v014 exposes a tableau-first pressure browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v014/index.html');
  const sketch = await read('studies/webgpu/v014/sketch.js');
  const style = await read('studies/webgpu/v014/style.css');
  const readme = await read('studies/webgpu/v014/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v014/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v014/critiques.json'));

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="press"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /liftLatestPressure/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.match(metrics.memoryRule, /pressure|compact|crease|archive/i);
  assert.equal(critiques.length, 4);
});

test('WebGPU v014 is recorded exactly once as the 2026-09-22 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-22');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-22');
  assert.equal(record.rawPath, '/studies/webgpu/v014/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-22');
  assert.ok(record.critiques.length >= 4);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.metrics.memoryRule, /pressure|compact|crease|archive/i);
  assert.equal(await read('works/webgpu-2026-09-22/index.html').then(Boolean), true);
});
