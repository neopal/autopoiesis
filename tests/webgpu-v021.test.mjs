import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v021/engine.mjs', import.meta.url);
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v021 engine must exist before the chorus field can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v021 turns a tuned call into reciprocal geometry and lifts it exactly', async () => {
  const { armNode, buildFrame, callField, geometrySignature, liftLatestCall, tuneCarrier } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = tuneCarrier(armNode(frame, { node: 37 }), { carrier: 2 });
  const changed = callField(armed, { node: 37, carrier: 2 });
  const restored = liftLatestCall(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedNode, 37);
  assert.equal(armed.carrier, 2);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'chorus-call');
  assert.ok(changed.field.responses.length >= 1);
  assert.ok(changed.field.vacancies.length >= 1);
  assert.notEqual(changed.field.signature, frame.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('WebGPU v021 bounds chorus memory, keeps arming non-causal, and releases the field', async () => {
  const { CARRIERS, MEMORY_LIMIT, armNode, buildFrame, callField, releaseField, tuneCarrier } = await loadEngine();
  const frame = buildFrame(0, []);
  const armed = tuneCarrier(armNode(frame, { node: -99 }), { carrier: 99 });
  const selected = tuneCarrier(armed, { carrier: 3 });
  const first = callField(selected, { node: 999, carrier: 999 });
  const settled = [0, 1, 2, 3].reduce((current, index) => callField(current, { node: 12 + index * 31, carrier: index }), frame);
  const overfull = callField(settled, { node: 4, carrier: 0 });
  const released = releaseField();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armedNode, 0);
  assert.equal(armed.carrier, 3);
  assert.equal(selected.carrier, CARRIERS - 1);
  assert.equal(first.memory[0].node, 179);
  assert.equal(first.memory[0].carrier, 3);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.field.responses.length > 0, true);
  assert.equal(settled.field.vacancies.length > 0, true);
  assert.ok(settled.field.answeredLayers.length >= 1);
  assert.ok(settled.field.resistance > 0);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, frame.field.signature);
});

test('WebGPU v021 exposes a GPU-ready chorus lattice and explicit art-gate evidence', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v021/index.html');
  const sketch = await read('studies/webgpu/v021/sketch.js');
  const style = await read('studies/webgpu/v021/style.css');
  const readme = await read('studies/webgpu/v021/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v021/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v021/critiques.json'));

  assert.match(index, /id="gpu-field"/);
  assert.match(index, /id="field"/);
  assert.match(index, /data-gesture="call"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /tuneCarrier/);
  assert.match(sketch, /callField/);
  assert.match(sketch, /liftLatestCall/);
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
  assert.equal(metrics.renderer, 'WebGPU chorus lattice with Canvas reciprocal fallback');
  assert.match(metrics.memoryRule, /call|reply|vacan|carrier/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v021 is recorded exactly once for the 2026-10-03 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-03');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-03');
  assert.equal(record.rawPath, '/studies/webgpu/v021/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-03');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /call|reply|vacan|carrier/i);
  assert.equal(await read('works/webgpu-2026-10-03/index.html').then(Boolean), true);
});
