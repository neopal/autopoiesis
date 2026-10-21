import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v030/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v030 engine must exist before the exposure archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v030 keeps looking observational until departure commits a non-local exposure reversal', async () => {
  const { armAttention, buildFrame, commitDeparture, geometrySignature } = await loadEngine();
  const quiet = buildFrame(0, []);
  let observed = armAttention(quiet, { witness: 2, at: 40 });
  observed = armAttention(observed, { witness: 7, at: 160 });
  observed = armAttention(observed, { witness: 4, at: 290 });
  const departed = commitDeparture(observed, { releasedAt: 520 });

  assert.equal(observed.memory.length, 0, 'attention must not write history before departure');
  assert.deepEqual(observed.attention.visits, [2, 7, 4]);
  assert.equal(departed.memory.length, 1);
  assert.equal(departed.memory[0].mode, 'departure-exposure');
  assert.notEqual(departed.memory[0].closed, departed.memory[0].entry, 'the watched witness must not be the direct material answer');
  assert.notEqual(departed.memory[0].open, departed.memory[0].closed, 'the remote aperture must be a different witness');
  assert.notEqual(departed.field.signature, quiet.field.signature);
  assert.ok(departed.field.plates.some((plate, index) => plate.open !== quiet.field.plates[index].open));
  assert.ok(departed.field.plates.some((plate, index) => plate.tilt !== quiet.field.plates[index].tilt));
  assert.equal(geometrySignature(departed), geometrySignature(commitDeparture(observed, { releasedAt: 520 })));
});

test('WebGPU v030 refuses insufficient departure, bounds exposure memory, and lifts exactly', async () => {
  const { MEMORY_LIMIT, armAttention, buildFrame, commitDeparture, geometrySignature, liftLatestDeparture, releaseArchive } = await loadEngine();
  const quiet = buildFrame(0, []);
  const still = armAttention(quiet, { witness: 3, at: 30 });
  const refused = commitDeparture(still, { releasedAt: 70 });
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused/);

  let frame = quiet;
  for (let serial = 0; serial < MEMORY_LIMIT + 1; serial += 1) {
    let attended = frame;
    for (const [witness, at] of [[serial % 12, 0], [(serial + 3) % 12, 140], [(serial + 6) % 12, 280]]) {
      attended = armAttention(attended, { witness, at });
    }
    frame = commitDeparture(attended, { releasedAt: 520 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestDeparture(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v030 settles a ten-stage exposure archive with four changed apertures', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(10).at(-1);
  assert.equal(settled.stage, 9);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.plates.filter((plate) => plate.open < 0.5).length >= 2);
  assert.ok(settled.field.plates.some((plate) => Math.abs(plate.tilt) > 0.05));
  assert.ok(settled.field.plates.some((plate) => plate.exposure > 0));
});

test('WebGPU v030 exposes a shutter-aperture tableau, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v030/index.html');
  const sketch = await read('studies/webgpu/v030/sketch.js');
  const style = await read('studies/webgpu/v030/style.css');
  const readme = await read('studies/webgpu/v030/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v030/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v030/critiques.json'));

  assert.match(index, /id="exposure-field"/);
  assert.match(index, /data-gesture="depart"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /liftLatestDeparture/);
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
  assert.equal(metrics.renderer, 'WebGPU exposure shutters with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /departure|aperture|shutter/i);
  assert.equal(critiques.length, 7);
});

test('WebGPU v030 is recorded exactly once for the 2026-10-21 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-21');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-21');
  assert.equal(record.rawPath, '/studies/webgpu/v030/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-21');
  assert.ok(record.critiques.length >= 7);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /proximity|attention|reciprocal/i);
  assert.match(record.source.translatedRule, /departure|aperture|shutter/i);
  assert.match(record.metrics.memoryRule, /departure|aperture|shutter/i);
  assert.equal(await read('works/webgpu-2026-10-21/index.html').then(Boolean), true);
});
