import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v041/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v041 keeps a held pause geometry-neutral, then hardens a remote aperture on release', async () => {
  const {
    HOLD_THRESHOLD_MS,
    APERTURE_COUNT,
    buildFrame,
    beginHold,
    updateHold,
    finishHold,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const held = beginHold(quiet, { x: 0.24, y: 0.38, time: 0 });
  const moving = updateHold(held, { x: 0.27, y: 0.4, time: HOLD_THRESHOLD_MS + 180 });

  assert.equal(APERTURE_COUNT, 13);
  assert.equal(geometrySignature(held), geometrySignature(quiet));
  assert.equal(geometrySignature(moving), geometrySignature(quiet));
  assert.equal(moving.memory.length, 0);
  assert.ok(moving.gesture.elapsedMs >= HOLD_THRESHOLD_MS);

  const committed = finishHold(moving, { x: 0.27, y: 0.4, time: HOLD_THRESHOLD_MS + 180, confirmed: true });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'fossil-hardening');
  assert.ok(committed.memory[0].durationMs >= HOLD_THRESHOLD_MS);
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.equal(committed.field.apertures.length, APERTURE_COUNT);
  assert.ok(committed.field.remoteIndex !== committed.memory[0].sourceIndex);
  assert.notDeepEqual(committed.field.apertures[committed.field.remoteIndex], quiet.field.apertures[committed.field.remoteIndex]);
  assert.deepEqual(committed.field.apertures[committed.memory[0].sourceIndex], quiet.field.apertures[committed.memory[0].sourceIndex]);
});

test('WebGPU v041 refuses a short pause and makes duration materially change the fossil', async () => {
  const { HOLD_THRESHOLD_MS, buildFrame, beginHold, updateHold, finishHold, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const short = finishHold(updateHold(beginHold(quiet, { x: 0.52, y: 0.68, time: 100 }), { x: 0.52, y: 0.68, time: 100 + HOLD_THRESHOLD_MS - 1 }), { x: 0.52, y: 0.68, time: 100 + HOLD_THRESHOLD_MS - 1, confirmed: true });
  assert.equal(short.memory.length, 0);
  assert.match(short.lastAction, /refused-short/);
  assert.equal(geometrySignature(short), geometrySignature(quiet));

  const brief = finishHold(updateHold(beginHold(quiet, { x: 0.52, y: 0.68, time: 0 }), { x: 0.52, y: 0.68, time: HOLD_THRESHOLD_MS + 60 }), { x: 0.52, y: 0.68, time: HOLD_THRESHOLD_MS + 60, confirmed: true });
  const long = finishHold(updateHold(beginHold(quiet, { x: 0.52, y: 0.68, time: 0 }), { x: 0.52, y: 0.68, time: HOLD_THRESHOLD_MS + 900 }), { x: 0.52, y: 0.68, time: HOLD_THRESHOLD_MS + 900, confirmed: true });
  assert.notEqual(brief.memory[0].hardness, long.memory[0].hardness);
  assert.notEqual(brief.field.signature, long.field.signature);
  assert.equal(brief.memory[0].sourceIndex, long.memory[0].sourceIndex);
});

test('WebGPU v041 compounds four fossil events, lifts the exact prior image, and releases to the seed', async () => {
  const { MEMORY_LIMIT, buildFrame, defaultHold, beginHold, finishHold, liftLatestHold, releaseArchive, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const preset = defaultHold(frame);
    frame = beginHold(frame, { x: preset.x, y: preset.y, time: 0 });
    frame = finishHold(frame, { x: preset.x, y: preset.y, time: preset.durationMs, confirmed: true });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestHold(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(geometrySignature(releaseArchive()), geometrySignature(quiet));
});

test('WebGPU v041 exposes a raster fossil tableau and an explicit art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v041/index.html');
  const sketch = await read('studies/webgpu/v041/sketch.js');
  const style = await read('studies/webgpu/v041/style.css');
  const readme = await read('studies/webgpu/v041/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v041/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v041/critiques.json'));

  assert.match(index, /id="fossil-field"/);
  assert.match(index, /data-gesture="harden"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.js\/1\.11\.3|p5\.min\.js/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /beginHold|touchStarted|pointer/);
  assert.match(sketch, /finishHold/);
  assert.match(sketch, /createGraphics|beginShape|raster/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'p5.js Canvas 2D raster fossil with WebGPU capability signal');
  assert.match(metrics.memoryRule, /hold|hardening|remote|aperture/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v041 is recorded exactly once for the 2026-11-01 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-01');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-01');
  assert.equal(record.rawPath, '/studies/webgpu/v041/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-01');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|material|geometry/i);
  assert.match(record.source.translatedRule, /hold|hardening|remote|aperture/i);
  assert.match(record.metrics.memoryRule, /hold|hardening|remote|aperture/i);
  assert.equal(await read('works/webgpu-2026-11-01/index.html').then(Boolean), true);
});
