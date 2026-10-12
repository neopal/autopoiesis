import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v027/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v027 engine must exist before the watershed volume can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v027 keeps proximity observational and commits a collective wake chosen away from the witness', async () => {
  const { armWitness, buildFrame, commitWake, geometrySignature, liftLatestWake } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armWitness(quiet, { basin: 4, trace: [4, 5, 8], travel: 0.62 });
  const awake = commitWake(armed);
  const restored = liftLatestWake(awake);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.basin, 4);
  assert.equal(awake.memory.length, 1);
  assert.equal(awake.memory[0].mode, 'collective-wake');
  assert.notEqual(awake.memory[0].elected, 4, 'the witness must not directly select the basin that changes');
  assert.ok(awake.field.basins.some((basin, index) => basin.swell > quiet.field.basins[index].swell));
  assert.ok(awake.field.basins.some((basin, index) => basin.contraction > quiet.field.basins[index].contraction));
  assert.ok(awake.field.basins.some((basin, index) => basin.relay !== quiet.field.basins[index].relay));
  assert.notEqual(awake.field.signature, quiet.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v027 refuses a shallow witness, compounds bounded collective memory, and releases exactly', async () => {
  const { MEMORY_LIMIT, armWitness, buildFrame, commitWake, releaseVolume } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armWitness(quiet, { basin: 2, trace: [2], travel: 0.04 });
  const refused = commitWake(armed);
  const first = commitWake(armWitness(refused, { basin: 2, trace: [2, 6, 7], travel: 0.76 }));
  const second = commitWake(armWitness(first, { basin: 7, trace: [7, 3, 0], travel: 0.58 }));
  const third = commitWake(armWitness(second, { basin: 1, trace: [1, 4, 8], travel: 0.81 }));
  const fourth = commitWake(armWitness(third, { basin: 6, trace: [6, 5, 2], travel: 0.67 }));
  const overfull = commitWake(armWitness(fourth, { basin: 8, trace: [8, 4, 1], travel: 0.63 }));
  const released = releaseVolume();

  assert.equal(armed.memory.length, 0);
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.lastAction, 'wake-refused-shallow');
  assert.equal(fourth.memory.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, quiet.field.signature);
  assert.equal(released.lastAction, 'volume-released');
});

test('WebGPU v027 settles a 17-stage preview with four remembered wakes and distributed basin changes', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(17).at(-1);

  assert.equal(settled.stage, 16);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.basins.filter((basin) => basin.swell > 0).length >= 2);
  assert.ok(settled.field.basins.filter((basin) => basin.contraction > 0).length >= 2);
  assert.ok(settled.field.basins.some((basin) => basin.relay !== 0));
  assert.ok(settled.field.channels.some((channel) => channel.opening > 0));
});

test('WebGPU v027 exposes a volumetric watershed tableau, optional GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v027/index.html');
  const sketch = await read('studies/webgpu/v027/sketch.js');
  const style = await read('studies/webgpu/v027/style.css');
  const readme = await read('studies/webgpu/v027/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v027/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v027/critiques.json'));

  assert.match(index, /id="volume-field"/);
  assert.match(index, /data-gesture="wake"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitWake/);
  assert.match(sketch, /liftLatestWake/);
  assert.match(sketch, /releaseVolume/);
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
  assert.equal(metrics.renderer, 'WebGPU watershed volume with Canvas 2D flow fallback');
  assert.match(metrics.memoryRule, /wake|basin|relay|channel/i);
  assert.equal(critiques.length, 6);
});

test('WebGPU v027 is recorded exactly once for the 2026-10-12 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-12');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-12');
  assert.equal(record.rawPath, '/studies/webgpu/v027/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-12');
  assert.ok(record.critiques.length >= 6);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /proximity|attention|agents/i);
  assert.match(record.source.translatedRule, /wake|basin|witness|collective/i);
  assert.match(record.browserEvidence.status, /production/i);
  assert.match(record.browserEvidence.viewportRuns, /20\/20 production/i);
  assert.ok(record.browserEvidence.unresolved.includes('independent caption-free perceptual comparison with labels, readout, controls, annotations, and prose hidden'));
  assert.match(record.metrics.memoryRule, /wake|basin|relay|channel/i);
  assert.equal(await read('works/webgpu-2026-10-12/index.html').then(Boolean), true);
});
