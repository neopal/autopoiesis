import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v017/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v017 engine must exist before temporal strata can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v017 turns a discrete advance into a remembered temporal deferral and lifts it exactly', async () => {
  const {
    advanceTurn,
    buildFrame,
    defaultCue,
    geometrySignature,
    liftLatestTurn
  } = await loadEngine();
  const frame = buildFrame(0, []);
  const changed = advanceTurn(frame, defaultCue());
  const restored = liftLatestTurn(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'temporal-deferral');
  assert.ok(changed.score.removedSegments.length >= 1);
  assert.ok(changed.score.delayedSegments.length >= 1);
  assert.ok(changed.score.gapCount >= 1);
  assert.notEqual(changed.score.signature, frame.score.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v017 bounds cues, refuses a full archive, and stores four displaced cohorts', async () => {
  const {
    MEMORY_LIMIT,
    advanceTurn,
    buildFrame,
    buildTimeline,
    geometrySignature,
    releaseTurns
  } = await loadEngine();
  const frame = buildFrame(0, []);
  const bounded = advanceTurn(frame, { band: -4, slot: 40, lag: 99 });
  const settled = buildTimeline().at(-1);
  const released = releaseTurns();
  const full = [0, 1, 2, 3].reduce((current) => advanceTurn(current, { band: 1, slot: 2 }), frame);
  const overfull = advanceTurn(full, { band: 5, slot: 7 });

  assert.equal(bounded.memory[0].cue.band, 0);
  assert.equal(bounded.memory[0].cue.slot, 8);
  assert.equal(bounded.memory[0].cue.lag, 1.6);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.score.delayedSegments.length, MEMORY_LIMIT);
  assert.equal(settled.score.gapCount, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(released), geometrySignature(frame));
});

test('WebGPU v017 exposes a tableau-first temporal browser contract and evidence files', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v017/index.html');
  const sketch = await read('studies/webgpu/v017/sketch.js');
  const style = await read('studies/webgpu/v017/style.css');
  const readme = await read('studies/webgpu/v017/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v017/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v017/critiques.json'));

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="advance"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /advanceTurn/);
  assert.match(sketch, /liftLatestTurn/);
  assert.match(sketch, /releaseTurns/);
  assert.match(sketch, /blindMode/);
  assert.match(sketch, /navigator\.gpu/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU-ready temporal strata with Canvas fallback');
  assert.match(metrics.memoryRule, /delay|temporal|cohort|band/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v017 is recorded exactly once for the 2026-09-26 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-26');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-26');
  assert.equal(record.rawPath, '/studies/webgpu/v017/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-26');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /delay|temporal|cohort|band/i);
  assert.equal(await read('works/webgpu-2026-09-26/index.html').then(Boolean), true);
});
