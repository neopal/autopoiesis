import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v039/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v039 keeps a pressure pair geometry-neutral until compression, then changes a remote reservoir and the shared void', async () => {
  const {
    buildFrame,
    beginPair,
    aimPair,
    finishPair,
    geometrySignature,
    RESERVOIR_COUNT
  } = await loadEngine();
  const quiet = buildFrame();
  const first = beginPair(quiet, { x: 0.18, y: 0.67 });
  const paired = aimPair(first, { x: 0.78, y: 0.3 });

  assert.equal(geometrySignature(first), geometrySignature(quiet), 'choosing the first body must not deform the field');
  assert.equal(geometrySignature(paired), geometrySignature(quiet), 'choosing the second body must remain view state');
  assert.equal(paired.memory.length, 0, 'a pair must not write history before compression');
  assert.equal(paired.pair.sourceIndex !== paired.pair.targetIndex, true);

  const compressed = finishPair(paired, { confirmed: true, pressure: 0.72 });
  assert.equal(compressed.memory.length, 1);
  assert.equal(compressed.memory[0].mode, 'pressure-pair');
  assert.ok(compressed.field.bodies.length === RESERVOIR_COUNT);
  assert.notEqual(compressed.memory[0].receiverIndex, compressed.memory[0].sourceIndex, 'the changed reservoir must be displaced from the first selected body');
  assert.notEqual(compressed.memory[0].receiverIndex, compressed.memory[0].targetIndex, 'the changed reservoir must be displaced from the second selected body');
  assert.notEqual(compressed.field.signature, quiet.field.signature);
  assert.notEqual(compressed.field.voidSignature, quiet.field.voidSignature, 'the collective void must be produced by the pressure event');
});

test('WebGPU v039 refuses incomplete pairs, bounds memory, and lifts the exact previous pressure body', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    beginPair,
    aimPair,
    finishPair,
    geometrySignature,
    liftLatestPair,
    releaseArchive,
    defaultPair
  } = await loadEngine();
  const quiet = buildFrame();
  const refused = finishPair(beginPair(quiet, { x: 0.2, y: 0.5 }), { confirmed: true, pressure: 0.72 });
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused/);

  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const pair = defaultPair(frame);
    frame = finishPair(aimPair(beginPair(frame, pair.source), pair.target), { confirmed: true, pressure: pair.pressure });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestPair(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v039 produces a non-grid pressure-reservoir field with deterministic collective memory', async () => {
  const { RESERVOIR_COUNT, buildFrame, buildTimeline } = await loadEngine();
  const quiet = buildFrame();
  assert.equal(quiet.field.kind, 'pressure-reservoir');
  assert.equal(quiet.field.bodies.length, RESERVOIR_COUNT);
  assert.ok(quiet.field.bodies.every((body) => body.vertices.length >= 7));
  assert.ok(quiet.field.void.points.length >= 7);
  assert.ok(quiet.field.bodies.some((body) => body.notch > 0), 'the bodies must carry produced negative cuts');

  const settled = buildTimeline(5).at(-1);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.bodies.some((body) => body.scale > 1.08 || body.scale < 0.92));
  assert.notEqual(settled.field.voidSignature, quiet.field.voidSignature);
});

test('WebGPU v039 exposes the pressure-reservoir tableau and explicit art-gate evidence', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v039/index.html');
  const sketch = await read('studies/webgpu/v039/sketch.js');
  const style = await read('studies/webgpu/v039/style.css');
  const readme = await read('studies/webgpu/v039/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v039/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v039/critiques.json'));

  assert.match(index, /id="reservoir-field"/);
  assert.match(index, /data-gesture="compress"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.js/i);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /mousePressed|touchStarted/);
  assert.match(sketch, /finishPair/);
  assert.match(sketch, /liftLatestPair/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /pressure-reservoir/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'p5.js Canvas 2D pressure reservoir with WebGPU capability signal');
  assert.match(metrics.memoryRule, /pressure|reservoir|remote|void/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v039 is recorded exactly once for the 2026-10-30 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-30');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-30');
  assert.equal(record.rawPath, '/studies/webgpu/v039/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-30');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /pressure|material|geometry|field/i);
  assert.match(record.source.translatedRule, /pressure|reservoir|void|remote/i);
  assert.match(record.metrics.memoryRule, /pressure|reservoir|void|remote/i);
  assert.equal(await read('works/webgpu-2026-10-30/index.html').then(Boolean), true);
});

test('WebGPU v039 keeps produced pressure bodies on the canvas rather than a CSS poster', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v039/index.html');
  const sketch = await read('studies/webgpu/v039/sketch.js');
  assert.match(index, /<canvas[^>]+id="reservoir-field"/);
  assert.match(sketch, /state\.frame\.field\.bodies/);
  assert.match(sketch, /p\.beginShape|p\.vertex/);
  assert.doesNotMatch(sketch, /querySelector\('#reservoir-field'\).*innerHTML/);
});
