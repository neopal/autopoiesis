import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v031/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v031 engine must exist before the pressure archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v031 keeps a pressure hold neutral until release redistributes mass away from the pressed grain', async () => {
  const { buildFrame, pressGrain, releasePressure, geometrySignature } = await loadEngine();
  const quiet = buildFrame(0, []);
  const pressed = pressGrain(quiet, { grain: 4, at: 40 });
  const released = releasePressure(pressed, { releasedAt: 520 });

  assert.equal(geometrySignature(pressed), geometrySignature(quiet), 'a pressure hold must not deform the field');
  assert.equal(pressed.memory.length, 0, 'pressure must not write memory before release');
  assert.equal(released.memory.length, 1);
  assert.equal(released.memory[0].mode, 'pressure-collapse');
  assert.notEqual(released.memory[0].input, released.memory[0].gap, 'the pressed grain cannot be the only consequence');
  assert.notEqual(released.memory[0].gap, released.memory[0].merge, 'the remote absence and merge must be different grains');
  assert.notEqual(released.field.signature, quiet.field.signature);
  assert.ok(released.field.grains.some((grain, index) => grain.mass !== quiet.field.grains[index].mass));
  assert.ok(released.field.grains.some((grain, index) => grain.radius !== quiet.field.grains[index].radius));
});

test('WebGPU v031 refuses short pressure, bounds material memory, and lifts the exact preceding field', async () => {
  const { MEMORY_LIMIT, buildFrame, pressGrain, releasePressure, geometrySignature, liftLatestPressure, releaseArchive } = await loadEngine();
  const quiet = buildFrame(0, []);
  const short = releasePressure(pressGrain(quiet, { grain: 2, at: 20 }), { releasedAt: 90 });
  assert.equal(short.memory.length, 0);
  assert.match(short.lastAction, /refused/);

  let frame = quiet;
  for (let serial = 0; serial < MEMORY_LIMIT + 1; serial += 1) {
    frame = releasePressure(pressGrain(frame, { grain: (serial * 7) % 36, at: 0 }), { releasedAt: 420 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestPressure(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v031 settles a grain archive with four gaps, mergers, and depth echoes', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);
  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.grains.filter((grain) => grain.mass < 0.48).length >= 2);
  assert.ok(settled.field.grains.some((grain) => grain.radius > 1.1));
  assert.ok(settled.field.grains.some((grain) => Math.abs(grain.depthShift) > 0.04));
});

test('WebGPU v031 exposes a grain-pressure tableau, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v031/index.html');
  const sketch = await read('studies/webgpu/v031/sketch.js');
  const style = await read('studies/webgpu/v031/style.css');
  const readme = await read('studies/webgpu/v031/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v031/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v031/critiques.json'));

  assert.match(index, /id="grain-field"/);
  assert.match(index, /data-gesture="compress"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /releasePressure/);
  assert.match(sketch, /liftLatestPressure/);
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
  assert.equal(metrics.renderer, 'WebGPU pressure-grain archive with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /pressure|grain|merge|gap/i);
  assert.equal(critiques.length, 7);
});

test('WebGPU v031 is recorded exactly once for the 2026-10-22 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-22');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-22');
  assert.equal(record.rawPath, '/studies/webgpu/v031/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-22');
  assert.ok(record.critiques.length >= 7);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|material|geometry/i);
  assert.match(record.source.translatedRule, /grain|pressure|merge|gap/i);
  assert.match(record.metrics.memoryRule, /pressure|grain|merge|gap/i);
  assert.equal(await read('works/webgpu-2026-10-22/index.html').then(Boolean), true);
});
