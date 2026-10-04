import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v020/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v020 engine must exist before the crease sheet can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v020 turns a selected pressure pulse into a real fold and a distant seal, then lifts it exactly', async () => {
  const { armSlice, buildFrame, geometrySignature, liftLatestPulse, pulseSheet } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSlice(frame, { slice: 3 });
  const changed = pulseSheet(armed, { slice: 3, pressure: 0.82 });
  const restored = liftLatestPulse(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedSlice, 3);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'crease-pulse');
  assert.ok(changed.sheet.faults.length >= 1);
  assert.ok(changed.sheet.seals.length >= 1);
  assert.notEqual(changed.sheet.signature, frame.sheet.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v020 bounds pressure, keeps selection non-causal, and accumulates binder resistance', async () => {
  const { MEMORY_LIMIT, armSlice, buildFrame, buildTimeline, pulseSheet, releaseSheet } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSlice(frame, { slice: -99 });
  const bounded = pulseSheet(armed, { slice: 99, pressure: 99 });
  const settled = buildTimeline().at(-1);
  const full = [0, 1, 2, 3].reduce((current, slice) => pulseSheet(current, { slice, pressure: 0.7 }), frame);
  const overfull = pulseSheet(full, { slice: 8, pressure: 0.2 });
  const released = releaseSheet();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedSlice, 0);
  assert.equal(bounded.memory[0].cue.slice, 8);
  assert.equal(bounded.memory[0].cue.pressure, 1.4);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.sheet.faults.length, MEMORY_LIMIT);
  assert.equal(settled.sheet.seals.length, MEMORY_LIMIT);
  assert.ok(settled.sheet.binder > 0);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.sheet.signature, frame.sheet.signature);
});

test('WebGPU v020 exposes a GPU-ready crease sheet, two-step encounter, and art-gate evidence', async () => {
  const index = await read('studies/webgpu/v020/index.html');
  const sketch = await read('studies/webgpu/v020/sketch.js');
  const style = await read('studies/webgpu/v020/style.css');
  const readme = await read('studies/webgpu/v020/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v020/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v020/critiques.json'));

  assert.match(index, /id="gpu-field"/);
  assert.match(index, /id="field"/);
  assert.match(index, /data-gesture="pulse"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /wheel/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pulseSheet/);
  assert.match(sketch, /liftLatestPulse/);
  assert.match(sketch, /releaseSheet/);
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
  assert.equal(metrics.renderer, 'WebGPU oblique crease sheet with Canvas geometry fallback');
  assert.match(metrics.memoryRule, /fold|seal|binder|crease/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v020 is recorded exactly once for the 2026-10-02 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-02');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-02');
  assert.equal(record.rawPath, '/studies/webgpu/v020/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-02');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.metrics.memoryRule, /fold|seal|binder|crease/i);
  assert.equal(await read('works/webgpu-2026-10-02/index.html').then(Boolean), true);
});
