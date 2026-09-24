import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v015/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v015 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const fieldDelta = (a, b) => a.reduce((sum, node, index) => {
  const other = b[index];
  return sum + Math.hypot(node.x - other.x, node.y - other.y) + Math.abs(node.depth - other.depth) + Math.abs(node.hidden - other.hidden);
}, 0);

test('WebGPU v015 turns attention into a remembered cavity rather than a brighter crowd', async () => {
  const {
    BODY_COUNT,
    MEMORY_LIMIT,
    STAGES,
    buildTimeline,
    deleteAttention
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteAttention(frame);
  const latest = frame.memory.at(-1);

  assert.equal(frame.bodies.length, BODY_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.cavityBodies > 0);
  assert.ok(frame.aggregate.hiddenBodies > 0);
  assert.ok(frame.aggregate.reorientedBodies > 0);
  assert.ok(fieldDelta(frame.bodies, withoutLatest.bodies) > 1.5);
  assert.ok(frame.archive.cavities.length >= MEMORY_LIMIT);
  assert.equal(latest.source, 'visitor-witness');
  assert.equal(latest.mode, 'concealment');
  assert.ok(latest.cavity.radius > 0);
});

test('WebGPU v015 visitor attention is bounded, replayable, and exactly reversible', async () => {
  const {
    applyAttention,
    buildFrame,
    buildTimeline,
    deleteAttention,
    geometrySignature,
    releaseAttention
  } = await loadEngine();
  const frame = buildTimeline()[4];
  const point = { x: 1.4, y: -0.2 };
  const next = applyAttention(frame, point);
  const replay = applyAttention(frame, point);
  const restored = deleteAttention(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-witness');
  assert.equal(next.memory.at(-1).mode, 'concealment');
  assert.ok(next.memory.at(-1).hiddenLoad > 0);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
  assert.equal(geometrySignature(releaseAttention(next)), geometrySignature(buildFrame(0, [])));
});

test('WebGPU v015 exposes a tableau-first cavity browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v015/index.html');
  const sketch = await read('studies/webgpu/v015/sketch.js');
  const style = await read('studies/webgpu/v015/style.css');
  const readme = await read('studies/webgpu/v015/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v015/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v015/critiques.json'));

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="witness"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /deleteAttention/);
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
  assert.match(metrics.memoryRule, /witness|hide|cavity|archive/i);
  assert.equal(critiques.length, 4);
});

test('WebGPU v015 sketch imports the stage constant used by its readout', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/webgpu/v015/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /import \{[\s\S]*STAGES[\s\S]*\} from '\.\/engine\.mjs'/);
});

test('WebGPU v015 is recorded exactly once as the 2026-09-24 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-24');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-24');
  assert.equal(record.rawPath, '/studies/webgpu/v015/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-24');
  assert.ok(record.critiques.length >= 4);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /witness|hide|cavity|archive/i);
  assert.equal(await read('works/webgpu-2026-09-24/index.html').then(Boolean), true);
});
