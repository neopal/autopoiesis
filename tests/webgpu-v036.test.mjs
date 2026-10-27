import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v036/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v036 keeps situated attention neutral until departure, then opens a remote gate', async () => {
  const {
    buildFrame,
    attendGate,
    moveAttention,
    releaseAttention,
    geometrySignature,
    MIN_DWELL
  } = await loadEngine();
  const quiet = buildFrame();
  const armed = attendGate(quiet, { gate: 3, at: 100 });
  const moved = moveAttention(armed, { gate: 7, at: 100 + MIN_DWELL * 0.8 });

  assert.equal(geometrySignature(armed), geometrySignature(quiet), 'attention must not deform the ribbon');
  assert.equal(geometrySignature(moved), geometrySignature(quiet), 'moving attention must remain geometry-neutral');
  assert.equal(moved.memory.length, 0, 'attention must not write history before departure');

  const committed = releaseAttention(moved, { gate: 7, releasedAt: 100 + MIN_DWELL * 1.8 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'situated-reciprocity');
  assert.notEqual(committed.memory[0].sourceGate, committed.memory[0].answerGate, 'the reply must be remote from the witnessed gate');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.gates.some((gate, index) => gate.opening !== quiet.field.gates[index].opening));
  assert.ok(committed.field.gates.some((gate, index) => gate.fold !== quiet.field.gates[index].fold));
});

test('WebGPU v036 refuses impossible attention spans, bounds memory, and lifts the exact preceding ribbon', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    attendGate,
    releaseAttention,
    geometrySignature,
    liftLatestAttention,
    releaseArchive,
    MIN_DWELL,
    MAX_DWELL
  } = await loadEngine();
  const quiet = buildFrame();
  const refusedShort = releaseAttention(attendGate(quiet, { gate: 1, at: 0 }), { releasedAt: MIN_DWELL - 1 });
  assert.equal(refusedShort.memory.length, 0);
  assert.match(refusedShort.lastAction, /refused/);
  const refusedLong = releaseAttention(attendGate(quiet, { gate: 1, at: 0 }), { releasedAt: MAX_DWELL + 1 });
  assert.equal(refusedLong.memory.length, 0);
  assert.match(refusedLong.lastAction, /refused/);

  let frame = quiet;
  for (const gate of [1, 5, 9, 13, 2]) {
    frame = releaseAttention(attendGate(frame, { gate, at: 0 }), { releasedAt: 360 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestAttention(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v036 builds one continuous ribbon whose gates are situated along its body', async () => {
  const { GATE_COUNT, buildFrame, buildTimeline } = await loadEngine();
  const quiet = buildFrame();
  assert.equal(quiet.field.ribbon.kind, 'continuous-ribbon');
  assert.ok(quiet.field.ribbon.centerline.length >= 12, 'the field must have a continuous spatial body');
  assert.equal(quiet.field.gates.length, GATE_COUNT);
  assert.ok(quiet.field.gates.every((gate) => gate.u >= 0 && gate.u <= 1));

  const settled = buildTimeline(9).at(-1);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.gates.some((gate) => gate.opening > 0.62));
  assert.ok(settled.field.gates.some((gate) => gate.fold > 0.18 || gate.fold < -0.18));
});

test('WebGPU v036 exposes a reciprocal ribbon tableau and explicit art-gate evidence', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v036/index.html');
  const sketch = await read('studies/webgpu/v036/sketch.js');
  const style = await read('studies/webgpu/v036/style.css');
  const readme = await read('studies/webgpu/v036/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v036/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v036/critiques.json'));

  assert.match(index, /id="ribbon-field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /releaseAttention/);
  assert.match(sketch, /liftLatestAttention/);
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
  assert.equal(metrics.renderer, 'WebGPU reciprocal ribbon with inline SVG fallback');
  assert.match(metrics.memoryRule, /attention|remote|ribbon|gate/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v036 is recorded exactly once for the 2026-10-27 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-27');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-27');
  assert.equal(record.rawPath, '/studies/webgpu/v036/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-27');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /attention|proximity|social|agent/i);
  assert.match(record.source.translatedRule, /attention|ribbon|gate|remote/i);
  assert.match(record.metrics.memoryRule, /attention|remote|ribbon|gate/i);
  assert.equal(await read('works/webgpu-2026-10-27/index.html').then(Boolean), true);
});

test('WebGPU v036 keeps ribbon widths under the ribbon field so the browser renderer has no undefined geometry path', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const sketch = await read('studies/webgpu/v036/sketch.js');
  assert.match(sketch, /field\.ribbon\.widths/);
  assert.doesNotMatch(sketch, /field\.widths/);
  assert.match(sketch, /const armed = state\.frame\.attention \? state\.frame : attendGate/);
});
