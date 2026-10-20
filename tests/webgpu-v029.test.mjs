import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v029/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v029 engine must exist before the compression field can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v029 keeps a cut observational and redistributes a valid traverse into three remote field changes', async () => {
  const { armCut, buildFrame, commitCompression, geometrySignature, liftLatestCompression } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armCut(quiet, { start: 0.19, end: 0.82, startedAt: 10, releasedAt: 280 });
  const compressed = commitCompression(armed);
  const restored = liftLatestCompression(compressed);

  assert.equal(armed.memory.length, 0, 'the cut must not write history before release');
  assert.equal(armed.armed.start, 0.19);
  assert.equal(armed.armed.end, 0.82);
  assert.equal(compressed.memory.length, 1);
  assert.equal(compressed.memory[0].mode, 'redistributed-compression');
  assert.notEqual(compressed.memory[0].knot, compressed.memory[0].startBand, 'the local entry must not directly select the compressed knot');
  assert.ok(compressed.field.fibers.filter((fiber, index) => fiber.pressure !== quiet.field.fibers[index].pressure || fiber.slip !== quiet.field.fibers[index].slip || fiber.gap !== quiet.field.fibers[index].gap || fiber.wake !== quiet.field.fibers[index].wake).length >= 3, 'three real fiber states must change');
  assert.ok(compressed.field.fibers.some((fiber, index) => fiber.gap > quiet.field.fibers[index].gap), 'a remote silent gap must become material');
  assert.notEqual(compressed.field.signature, quiet.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v029 refuses a short traverse, compounds a bounded archive, and releases exactly', async () => {
  const { MEMORY_LIMIT, armCut, buildFrame, commitCompression, releaseArchive } = await loadEngine();
  const quiet = buildFrame(0, []);
  const refused = commitCompression(armCut(quiet, { start: 0.4, end: 0.43, startedAt: 10, releasedAt: 80 }));
  let frame = refused;
  for (const pair of [[0.08, 0.67], [0.22, 0.9], [0.14, 0.48], [0.62, 0.18], [0.31, 0.77]]) {
    frame = commitCompression(armCut(frame, { start: pair[0], end: pair[1], startedAt: 10, releasedAt: 280 }));
  }
  const released = releaseArchive();

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.lastAction, 'compression-refused-short');
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, quiet.field.signature);
  assert.equal(released.lastAction, 'archive-released');
});

test('WebGPU v029 settles a nine-stage preview with four remembered compressions and a changed relay field', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);

  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.fibers.filter((fiber) => fiber.pressure > 0).length >= 3);
  assert.ok(settled.field.fibers.filter((fiber) => fiber.gap > 0).length >= 2);
  assert.ok(settled.field.fibers.some((fiber) => Math.abs(fiber.slip) > 0));
});

test('WebGPU v029 exposes a braided pressure-field tableau, optional GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v029/index.html');
  const sketch = await read('studies/webgpu/v029/sketch.js');
  const style = await read('studies/webgpu/v029/style.css');
  const readme = await read('studies/webgpu/v029/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v029/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v029/critiques.json'));

  assert.match(index, /id="pressure-field"/);
  assert.match(index, /data-gesture="compress"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitCompression/);
  assert.match(sketch, /liftLatestCompression/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /navigator\.gpu/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU braided pressure field with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /compression|knot|gap|relay/i);
  assert.equal(critiques.length, 6);
});

test('WebGPU v029 is recorded exactly once for the 2026-10-20 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-20');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-20');
  assert.equal(record.rawPath, '/studies/webgpu/v029/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-20');
  assert.ok(record.critiques.length >= 6);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|density|grain|field/i);
  assert.match(record.source.translatedRule, /compression|resistance|knot|gap/i);
  assert.match(record.metrics.memoryRule, /compression|knot|gap|relay/i);
  assert.equal(await read('works/webgpu-2026-10-20/index.html').then(Boolean), true);
});
