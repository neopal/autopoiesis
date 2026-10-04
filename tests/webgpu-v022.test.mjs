import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v022/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v022 engine must exist before the field archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v022 turns a released sweep into a rerouted field and lifts it exactly', async () => {
  const { armSweep, buildFrame, geometrySignature, liftLatestSweep, releaseSweep } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSweep(frame, { start: [-0.72, -0.42], end: [0.66, 0.38] });
  const changed = releaseSweep(armed, { start: [-0.72, -0.42], end: [0.66, 0.38], force: 0.86 });
  const restored = liftLatestSweep(changed);

  assert.equal(armed.memory.length, 0);
  assert.deepEqual(armed.armed.start, [-0.72, -0.42]);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'field-sweep');
  assert.ok(changed.field.wakes.length >= 1);
  assert.ok(changed.field.cells.some((cell) => cell.bend !== 0 || cell.open > 0));
  assert.notEqual(changed.field.signature, frame.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v022 bounds sweep memory, keeps arming non-causal, and makes later routes inherit residue', async () => {
  const { MEMORY_LIMIT, armSweep, buildFrame, releaseField, releaseSweep } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSweep(frame, { start: [-99, 99], end: [99, -99] });
  const first = releaseSweep(armed, { start: [-99, 99], end: [99, -99], force: 99 });
  const second = releaseSweep(first, { start: [-0.4, 0.7], end: [0.5, -0.6], force: 0.42 });
  const settled = [0, 1, 2, 3].reduce((current, index) => releaseSweep(current, {
    start: [-0.82 + index * 0.2, -0.62],
    end: [0.68 - index * 0.12, 0.58],
    force: 0.55 + index * 0.05
  }), frame);
  const overfull = releaseSweep(settled, { start: [0, 0], end: [1, 1], force: 1 });
  const released = releaseField();

  assert.equal(armed.memory.length, 0);
  assert.deepEqual(armed.armed.start, [-1, 1]);
  assert.equal(first.memory[0].sweep.force, 1);
  assert.notEqual(second.field.route, first.field.route);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.field.residue > 0);
  assert.ok(settled.field.wakes.length > 0);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, frame.field.signature);
});

test('WebGPU v022 settles the 19-stage preview with four sweeps and 29 wake records', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(19).at(-1);

  assert.equal(settled.stage, 18);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.field.wakes.length, 29);
});

test('WebGPU v022 exposes a GPU-ready adaptive field and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v022/index.html');
  const sketch = await read('studies/webgpu/v022/sketch.js');
  const style = await read('studies/webgpu/v022/style.css');
  const readme = await read('studies/webgpu/v022/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v022/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v022/critiques.json'));

  assert.match(index, /id="gpu-field"/);
  assert.match(index, /id="field"/);
  assert.match(index, /data-gesture="sweep"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /releaseSweep/);
  assert.match(sketch, /liftLatestSweep/);
  assert.match(sketch, /releaseField/);
  assert.match(sketch, /navigator\.gpu/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU adaptive field with Canvas contour fallback');
  assert.match(metrics.memoryRule, /sweep|wake|residue|route/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v022 is recorded exactly once for the 2026-10-04 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-04');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-04');
  assert.equal(record.rawPath, '/studies/webgpu/v022/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-04');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.metrics.memoryRule, /sweep|wake|residue|route/i);
  assert.equal(await read('works/webgpu-2026-10-04/index.html').then(Boolean), true);
});
