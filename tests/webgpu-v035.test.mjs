import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v035/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v035 engine must exist before the pressure vault can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v035 keeps the first pressure beat neutral, then makes a remote vault panel answer', async () => {
  const { buildFrame, primeVault, tickVault, commitPressure, geometrySignature, MIN_PRESSURE } = await loadEngine();
  const quiet = buildFrame();
  const primed = primeVault(quiet, { at: 100 });
  const waiting = tickVault(primed, { at: 100 + MIN_PRESSURE * 1.8 });

  assert.equal(geometrySignature(primed), geometrySignature(quiet), 'the first beat must not deform the vault');
  assert.equal(geometrySignature(waiting), geometrySignature(quiet), 'waiting between beats must remain geometry-neutral');
  assert.equal(waiting.memory.length, 0, 'pressure must not write history before the second beat');

  const committed = commitPressure(waiting, { committedAt: 100 + MIN_PRESSURE * 1.8 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'double-tap-pressure');
  assert.notEqual(committed.memory[0].sourcePanel, committed.memory[0].responsePanel, 'the answer must be remote from the pressure origin');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.panels.some((panel, index) => panel.depth !== quiet.field.panels[index].depth));
  assert.ok(committed.field.panels.some((panel, index) => panel.aperture !== quiet.field.panels[index].aperture));
  assert.ok(committed.field.panels.some((panel, index) => panel.slip !== quiet.field.panels[index].slip));
});

test('WebGPU v035 refuses unbounded pressure, bounds memory, and lifts the exact preceding vault', async () => {
  const { MEMORY_LIMIT, buildFrame, primeVault, commitPressure, geometrySignature, liftLatestPressure, releaseArchive, MIN_PRESSURE, MAX_PRESSURE } = await loadEngine();
  const quiet = buildFrame();
  const refusedShort = commitPressure(primeVault(quiet, { at: 0 }), { committedAt: MIN_PRESSURE - 1 });
  assert.equal(refusedShort.memory.length, 0);
  assert.match(refusedShort.lastAction, /refused/);
  const refusedLong = commitPressure(primeVault(quiet, { at: 0 }), { committedAt: MAX_PRESSURE + 1 });
  assert.equal(refusedLong.memory.length, 0);
  assert.match(refusedLong.lastAction, /refused/);

  let frame = quiet;
  for (const interval of [180, 360, 740, 520, 280]) {
    frame = commitPressure(primeVault(frame, { at: 0 }), { committedAt: interval });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestPressure(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v035 settles four pressure decisions with depth, aperture, and slip variation', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);
  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.panels.some((panel) => panel.depth > 0.92));
  assert.ok(settled.field.panels.some((panel) => panel.depth < 0.08));
  assert.ok(settled.field.panels.some((panel) => panel.aperture > 0.76));
  assert.ok(settled.field.panels.some((panel) => panel.slip > 0.3));
});

test('WebGPU v035 exposes a pressure vault tableau and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v035/index.html');
  const sketch = await read('studies/webgpu/v035/sketch.js');
  const style = await read('studies/webgpu/v035/style.css');
  const readme = await read('studies/webgpu/v035/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v035/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v035/critiques.json'));

  assert.match(index, /id="vault-field"/);
  assert.match(index, /data-gesture="pressure"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /primeVault/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /liftLatestPressure/);
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
  assert.equal(metrics.renderer, 'WebGPU pressure vault with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /pressure|remote|vault|panel/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v035 is recorded exactly once for the 2026-10-26 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-26');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-26');
  assert.equal(record.rawPath, '/studies/webgpu/v035/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-26');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|material|geometry|field/i);
  assert.match(record.source.translatedRule, /pressure|panel|vault|remote/i);
  assert.match(record.metrics.memoryRule, /pressure|remote|vault|panel/i);
  assert.equal(await read('works/webgpu-2026-10-26/index.html').then(Boolean), true);
});
