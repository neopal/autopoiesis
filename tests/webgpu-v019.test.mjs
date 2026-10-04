import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v019/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v019 engine must exist before the broadcast loom can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v019 broadcasts a borrowed phase through the cube loom and lifts it exactly', async () => {
  const { armSignal, buildFrame, commitBroadcast, geometrySignature, liftLatestBroadcast } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSignal(frame, { signal: 2 });
  const changed = commitBroadcast(armed, { signal: 2 });
  const restored = liftLatestBroadcast(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedSignal, 2);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'borrowed-phase');
  assert.equal(changed.loom.transmissions.length, 1);
  assert.equal(changed.loom.seams.length, 1);
  assert.equal(changed.loom.echoes.length, 1);
  assert.notEqual(changed.loom.signature, frame.loom.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v019 bounds broadcasts, keeps canvas taps non-causal, and releases the loom', async () => {
  const { MEMORY_LIMIT, armSignal, buildFrame, commitBroadcast, buildTimeline, releaseLoom } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = armSignal(frame, { signal: -99 });
  const bounded = commitBroadcast(armed, { signal: 99 });
  const settled = buildTimeline().at(-1);
  const full = [0, 1, 2, 3].reduce((current, signal) => commitBroadcast(current, { signal }), frame);
  const overfull = commitBroadcast(full, { signal: 8 });
  const released = releaseLoom();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedSignal, 0);
  assert.equal(bounded.memory[0].cue.signal, 0);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.loom.transmissions.length, MEMORY_LIMIT);
  assert.equal(settled.loom.echoes.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.loom.signature, frame.loom.signature);
});

test('WebGPU v019 is a cube loom with a broadcast encounter and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v019/index.html');
  const sketch = await read('studies/webgpu/v019/sketch.js');
  const style = await read('studies/webgpu/v019/style.css');
  const readme = await read('studies/webgpu/v019/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v019/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v019/critiques.json'));

  assert.match(index, /id="gpu-field"/);
  assert.match(index, /id="field"/);
  assert.match(index, /data-gesture="broadcast"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitBroadcast/);
  assert.match(sketch, /liftLatestBroadcast/);
  assert.match(sketch, /releaseLoom/);
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
  assert.equal(metrics.renderer, 'WebGPU cube loom with Canvas geometry fallback');
  assert.match(metrics.memoryRule, /phase|seam|echo|loom/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v019 is recorded exactly once for the 2026-10-01 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-01');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-01');
  assert.equal(record.rawPath, '/studies/webgpu/v019/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-01');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /broadcast|phase|echo|crowd/i);
  assert.equal(await read('works/webgpu-2026-10-01/index.html').then(Boolean), true);
});
