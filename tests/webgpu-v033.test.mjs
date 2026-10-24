import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v033/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v033 engine must exist before the propagation surface can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v033 keeps a directional drag neutral until release, then propagates a local-neighbour beat through the surface', async () => {
  const { buildFrame, armSurface, releaseSurface, geometrySignature, MIN_SWIPE } = await loadEngine();
  const quiet = buildFrame();
  const armed = armSurface(quiet, { x: 0.2, y: 0.5, at: 40 });
  assert.equal(geometrySignature(armed), geometrySignature(quiet), 'arming must not deform the surface');
  assert.equal(armed.memory.length, 0, 'a sweep must not write memory before release');

  const refused = releaseSurface(armed, { x: 0.2 + MIN_SWIPE * 0.2, y: 0.5, releasedAt: 120 });
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused/);

  const ready = armSurface(quiet, { x: 0.18, y: 0.52, at: 40 });
  const committed = releaseSurface(ready, { x: 0.82, y: 0.52, releasedAt: 520 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'propagation-beat');
  assert.equal(committed.memory[0].direction, 'east');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.samples.some((sample, index) => sample.height !== quiet.field.samples[index].height));
  assert.ok(committed.field.samples.some((sample, index) => sample.phase !== quiet.field.samples[index].phase));
});

test('WebGPU v033 rejects a short sweep, bounds temporal memory, and lifts the exact preceding field', async () => {
  const { MEMORY_LIMIT, buildFrame, armSurface, releaseSurface, geometrySignature, liftLatestBeat, releaseArchive } = await loadEngine();
  const quiet = buildFrame();
  const short = releaseSurface(armSurface(quiet, { x: 0.5, y: 0.5, at: 0 }), { x: 0.53, y: 0.5, releasedAt: 420 });
  assert.equal(short.memory.length, 0);
  assert.match(short.lastAction, /refused/);

  let frame = quiet;
  const directions = [
    [0.15, 0.5, 0.85, 0.5],
    [0.5, 0.16, 0.5, 0.84],
    [0.84, 0.5, 0.16, 0.5],
    [0.5, 0.84, 0.5, 0.16],
    [0.15, 0.48, 0.85, 0.52]
  ];
  for (const [x0, y0, x1, y1] of directions) {
    frame = releaseSurface(armSurface(frame, { x: x0, y: y0, at: 0 }), { x: x1, y: y1, releasedAt: 420 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestBeat(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v033 settles four inherited propagation beats with continuous terrain variation', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(5).at(-1);
  assert.equal(settled.stage, 4);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.samples.some((sample) => sample.height > 0.72));
  assert.ok(settled.field.samples.some((sample) => sample.height < 0.28));
  assert.ok(settled.field.samples.some((sample) => Math.abs(sample.phase) > 0.08));
  assert.ok(settled.field.samples.some((sample) => sample.inheritance > 0.2));
});

test('WebGPU v033 exposes a continuous propagation tableau and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v033/index.html');
  const sketch = await read('studies/webgpu/v033/sketch.js');
  const style = await read('studies/webgpu/v033/style.css');
  const readme = await read('studies/webgpu/v033/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v033/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v033/critiques.json'));

  assert.match(index, /id="propagation-field"/);
  assert.match(index, /data-gesture="pulse"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /releaseSurface/);
  assert.match(sketch, /liftLatestBeat/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU propagation surface with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /neighbou?r|propagat|surface|inherit/i);
  assert.equal(critiques.length, 7);
});

test('WebGPU v033 is recorded exactly once for the 2026-10-24 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-24');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-24');
  assert.equal(record.rawPath, '/studies/webgpu/v033/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-24');
  assert.ok(record.critiques.length >= 7);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /attention|proximity|social|agent/i);
  assert.match(record.source.translatedRule, /neighbou?r|propagat|surface|local/i);
  assert.match(record.metrics.memoryRule, /neighbou?r|propagat|surface|inherit/i);
  assert.equal(await read('works/webgpu-2026-10-24/index.html').then(Boolean), true);
});
