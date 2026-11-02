import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v042/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v042 keeps an open circuit inert and commits a remote shadow quorum only when the orbit closes', async () => {
  const {
    LOOP_THRESHOLD,
    WITNESS_COUNT,
    buildFrame,
    beginCircuit,
    updateCircuit,
    finishCircuit,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const started = beginCircuit(quiet, { x: 0.84, y: 0.5, time: 0 });
  const moving = updateCircuit(started, { x: 0.2, y: 0.66, time: 420, arc: LOOP_THRESHOLD + 0.08, closure: 0.09 });

  assert.equal(WITNESS_COUNT, 18);
  assert.equal(geometrySignature(started), geometrySignature(quiet));
  assert.equal(geometrySignature(moving), geometrySignature(quiet));
  assert.equal(moving.memory.length, 0);
  assert.ok(moving.gesture.arc >= LOOP_THRESHOLD);

  const committed = finishCircuit(moving, { arc: LOOP_THRESHOLD + 0.08, closure: 0.09, confirmed: true });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'shadow-quorum');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.equal(committed.field.witnesses.length, WITNESS_COUNT);
  assert.notEqual(committed.memory[0].receiverIndex, committed.memory[0].sourceIndex);
  assert.notDeepEqual(
    committed.field.witnesses[committed.memory[0].receiverIndex],
    quiet.field.witnesses[committed.memory[0].receiverIndex]
  );
  assert.deepEqual(
    committed.field.witnesses[committed.memory[0].sourceIndex],
    quiet.field.witnesses[committed.memory[0].sourceIndex]
  );
});

test('WebGPU v042 refuses an incomplete circuit and direction changes the produced remote shadow', async () => {
  const { LOOP_THRESHOLD, buildFrame, beginCircuit, updateCircuit, finishCircuit, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const open = finishCircuit(
    updateCircuit(beginCircuit(quiet, { x: 0.8, y: 0.5, time: 100 }), { x: 0.44, y: 0.35, time: 280, arc: LOOP_THRESHOLD - 0.08, closure: 0.3 }),
    { arc: LOOP_THRESHOLD - 0.08, closure: 0.3, confirmed: true }
  );
  assert.equal(open.memory.length, 0);
  assert.match(open.lastAction, /refused-open/);
  assert.equal(geometrySignature(open), geometrySignature(quiet));

  const clockwise = finishCircuit(
    updateCircuit(beginCircuit(quiet, { x: 0.84, y: 0.5, time: 0 }), { x: 0.2, y: 0.66, time: 400, arc: LOOP_THRESHOLD + 0.04, closure: 0.08, direction: 1 }),
    { arc: LOOP_THRESHOLD + 0.04, closure: 0.08, direction: 1, confirmed: true }
  );
  const counterclockwise = finishCircuit(
    updateCircuit(beginCircuit(quiet, { x: 0.84, y: 0.5, time: 0 }), { x: 0.2, y: 0.66, time: 400, arc: LOOP_THRESHOLD + 0.04, closure: 0.08, direction: -1 }),
    { arc: LOOP_THRESHOLD + 0.04, closure: 0.08, direction: -1, confirmed: true }
  );
  assert.notEqual(clockwise.memory[0].direction, counterclockwise.memory[0].direction);
  assert.notEqual(clockwise.field.signature, counterclockwise.field.signature);
});

test('WebGPU v042 compounds four shadow quorums, lifts the exact prior frame, and releases to the deterministic seed', async () => {
  const { MEMORY_LIMIT, buildFrame, defaultCircuit, beginCircuit, finishCircuit, liftLatestCircuit, releaseArchive, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const preset = defaultCircuit(frame);
    frame = beginCircuit(frame, { x: preset.x, y: preset.y, time: 0 });
    frame = finishCircuit(frame, { arc: preset.arc, closure: preset.closure, direction: preset.direction, confirmed: true });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestCircuit(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(geometrySignature(releaseArchive()), geometrySignature(quiet));
});

test('WebGPU v042 exposes a kinetic shadow-quorum tableau and an explicit art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v042/index.html');
  const sketch = await read('studies/webgpu/v042/sketch.js');
  const style = await read('studies/webgpu/v042/style.css');
  const readme = await read('studies/webgpu/v042/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v042/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v042/critiques.json'));

  assert.match(index, /id="shadow-field"/);
  assert.match(index, /data-gesture="circuit"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.js\/1\.11\.3|p5\.min\.js/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /beginCircuit|touchStarted|pointer/);
  assert.match(sketch, /finishCircuit/);
  assert.match(sketch, /createGraphics|beginShape|shadow/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'shadow-quorum');
  assert.match(metrics.memoryRule, /circuit|remote|shadow|quorum/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v042 is recorded exactly once for the 2026-11-02 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-02');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-02');
  assert.equal(record.rawPath, '/studies/webgpu/v042/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-02');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /situated|proximity|attention|agent/i);
  assert.match(record.source.translatedRule, /circuit|shadow|remote|quorum/i);
  assert.match(record.metrics.memoryRule, /circuit|shadow|quorum/i);
  assert.equal(await read('works/webgpu-2026-11-02/index.html').then(Boolean), true);
});
