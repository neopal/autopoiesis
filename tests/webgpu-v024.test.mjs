import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v024/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v024 engine must exist before the interval archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v024 turns a measured pause into actual loop delay geometry and lifts it exactly', async () => {
  const { armPause, buildFrame, commitPause, geometrySignature, liftLatestPause } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armPause(quiet, 4);
  const changed = commitPause(armed, { ring: 4, duration: 860 });
  const restored = liftLatestPause(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.ring, 4);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'temporal-pause');
  assert.ok(changed.archive.loops.some((loop) => loop.opening > 0 || loop.lag !== 0));
  assert.ok(changed.archive.loops.some((loop) => loop.delay > 0));
  assert.notEqual(changed.archive.signature, quiet.archive.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v024 keeps arming and short pauses non-causal while later intervals inherit phase residue', async () => {
  const { MEMORY_LIMIT, armPause, buildFrame, commitPause, releaseArchive } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armPause(quiet, 99);
  const tooShort = commitPause(armed, { ring: 99, duration: 120 });
  const first = commitPause(armed, { ring: 2, duration: 620 });
  const second = commitPause(first, { ring: 8, duration: 930 });
  const settled = [0, 1].reduce((current, index) => commitPause(current, { ring: index * 3 + 1, duration: 700 + index * 80 }), second);
  const overfull = commitPause(settled, { ring: 12, duration: 990 });
  const released = releaseArchive();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.ring, 14);
  assert.equal(tooShort.memory.length, 0);
  assert.equal(tooShort.lastAction, 'pause-too-short');
  assert.notEqual(second.archive.route, first.archive.route);
  assert.ok(second.archive.residue > first.archive.residue);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.archive.signature, quiet.archive.signature);
});

test('WebGPU v024 settles a 17-stage preview with four remembered pauses and visible delay loops', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(17).at(-1);

  assert.equal(settled.stage, 16);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.archive.loops.filter((loop) => loop.delay > 0).length >= 4);
  assert.ok(settled.archive.loops.some((loop) => loop.opening > 0));
});

test('WebGPU v024 exposes a temporal loop encounter, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v024/index.html');
  const sketch = await read('studies/webgpu/v024/sketch.js');
  const style = await read('studies/webgpu/v024/style.css');
  const readme = await read('studies/webgpu/v024/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v024/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v024/critiques.json'));

  assert.match(index, /id="gpu-veil"/);
  assert.match(index, /id="archive-field"/);
  assert.match(index, /data-gesture="measure"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /commitPause/);
  assert.match(sketch, /liftLatestPause/);
  assert.match(sketch, /releaseArchive/);
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
  assert.equal(metrics.renderer, 'WebGPU temporal loop archive with Canvas projection fallback');
  assert.match(metrics.memoryRule, /pause|delay|phase|loop/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v024 keeps keyboard commits single-shot when the canvas is focused', async () => {
  const sketch = await read('studies/webgpu/v024/sketch.js');
  assert.match(sketch, /document\.addEventListener\('keydown'/);
  assert.doesNotMatch(sketch, /canvas\.addEventListener\('keydown', handleKey\)/);
});

test('WebGPU v024 is recorded exactly once for the 2026-10-06 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-06');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-06');
  assert.equal(record.rawPath, '/studies/webgpu/v024/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-06');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /pause|delay|phase|loop/i);
  assert.equal(await read('works/webgpu-2026-10-06/index.html').then(Boolean), true);
});
