import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v018/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v018 engine must exist before the witness field can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v018 turns situated attention into a real local vacancy and a remote aperture, then lifts it exactly', async () => {
  const { armWitness, buildFrame, commitWitness, geometrySignature, liftLatestWitness } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armWitness(frame, { node: 2 });
  const changed = commitWitness(armed, { node: 2 });
  const restored = liftLatestWitness(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedNode, 2);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'wrong-witness');
  assert.equal(changed.field.vacancies.length, 1);
  assert.equal(changed.field.apertures.length, 1);
  assert.notEqual(changed.field.signature, frame.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v018 bounds witness cues, preserves an armed-only state, and keeps four remote replies', async () => {
  const { MEMORY_LIMIT, armWitness, buildFrame, commitWitness, buildTimeline, releaseField } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armWitness(frame, { node: -99 });
  const bounded = commitWitness(armed, { node: 99 });
  const settled = buildTimeline().at(-1);
  const full = [0, 1, 2, 3].reduce((current, node) => commitWitness(current, { node }), frame);
  const overfull = commitWitness(full, { node: 8 });
  const released = releaseField();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedNode, 0);
  assert.equal(bounded.memory[0].cue.node, 12);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.field.vacancies.length, MEMORY_LIMIT);
  assert.equal(settled.field.apertures.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, frame.field.signature);
});

test('WebGPU v018 exposes a radial GPU tableau, sustained attention controls, and art-gate evidence', async () => {
  const index = await read('studies/webgpu/v018/index.html');
  const sketch = await read('studies/webgpu/v018/sketch.js');
  const style = await read('studies/webgpu/v018/style.css');
  const readme = await read('studies/webgpu/v018/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v018/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v018/critiques.json'));

  assert.match(index, /id="gpu-field"/);
  assert.match(index, /id="field"/);
  assert.match(index, /data-gesture="witness"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /liftLatestWitness/);
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
  assert.equal(metrics.renderer, 'WebGPU radial field with Canvas geometry fallback');
  assert.match(metrics.memoryRule, /vacan|aperture|witness/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v018 is recorded exactly once for the 2026-09-30 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-30');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-30');
  assert.equal(record.rawPath, '/studies/webgpu/v018/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-30');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /vacan|aperture|witness/i);
  assert.equal(await read('works/webgpu-2026-09-30/index.html').then(Boolean), true);
});
