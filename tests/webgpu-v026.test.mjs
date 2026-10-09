import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v026/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v026 engine must exist before the witness register can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v026 keeps a first witness non-causal and seals a non-local pair into real register excisions', async () => {
  const { armWitness, buildFrame, commitPair, geometrySignature, liftLatestPair } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armWitness(quiet, 4);
  const paired = commitPair(armed, { source: 4, target: 25 });
  const restored = liftLatestPair(paired);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.slot, 4);
  assert.equal(paired.memory.length, 1);
  assert.equal(paired.memory[0].mode, 'witness-pair');
  assert.ok(paired.register.entries.some((entry) => entry.slot === 4 && entry.excision > quiet.register.entries[entry.id].excision));
  assert.ok(paired.register.entries.some((entry) => entry.slot === 25 && entry.reply > quiet.register.entries[entry.id].reply));
  assert.ok(paired.register.entries.some((entry) => entry.slot !== 4 && entry.slot !== 25 && entry.bridge !== quiet.register.entries[entry.id].bridge));
  assert.notEqual(paired.register.signature, quiet.register.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v026 refuses a same-place tap and compounds bounded pair memory', async () => {
  const { MEMORY_LIMIT, armWitness, buildFrame, commitPair, releaseRegister } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armWitness(quiet, 9);
  const refused = commitPair(armed, { source: 9, target: 9 });
  const first = commitPair(refused, { source: 2, target: 31 });
  const second = commitPair(first, { source: 12, target: 20 });
  const settled = [0, 1].reduce((frame, serial) => commitPair(frame, { source: serial * 7 + 1, target: 38 - serial * 5 }), second);
  const overfull = commitPair(settled, { source: 5, target: 34 });
  const released = releaseRegister();

  assert.equal(armed.memory.length, 0);
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.lastAction, 'same-place-refused');
  assert.notEqual(second.register.route, first.register.route);
  assert.ok(second.register.excisionTotal > first.register.excisionTotal);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.register.signature, quiet.register.signature);
});

test('WebGPU v026 settles a 13-stage preview with four remembered pairs and distributed cuts', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(13).at(-1);

  assert.equal(settled.stage, 12);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.register.entries.filter((entry) => entry.excision > 0).length >= 4);
  assert.ok(settled.register.entries.some((entry) => entry.reply > 0));
  assert.ok(settled.register.entries.some((entry) => entry.bridge !== 0));
});

test('WebGPU v026 exposes a typographic register tableau, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v026/index.html');
  const sketch = await read('studies/webgpu/v026/sketch.js');
  const style = await read('studies/webgpu/v026/style.css');
  const readme = await read('studies/webgpu/v026/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v026/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v026/critiques.json'));

  assert.match(index, /id="register-field"/);
  assert.match(index, /data-gesture="pair"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitPair/);
  assert.match(sketch, /liftLatestPair/);
  assert.match(sketch, /releaseRegister/);
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
  assert.equal(metrics.renderer, 'WebGPU witness register with Canvas typographic fallback');
  assert.match(metrics.memoryRule, /pair|excision|reply|register/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v026 is recorded exactly once for the 2026-10-09 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-09');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-09');
  assert.equal(record.rawPath, '/studies/webgpu/v026/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-09');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|directional|geometry/i);
  assert.match(record.source.translatedRule, /invert|deferred|non-local/i);
  assert.match(record.metrics.memoryRule, /pair|excision|reply|register/i);
  assert.equal(await read('works/webgpu-2026-10-09/index.html').then(Boolean), true);
});
