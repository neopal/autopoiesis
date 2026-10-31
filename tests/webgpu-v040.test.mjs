import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v040/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v040 keeps a three-witness accord geometry-neutral until commit, then changes a remote depth layer', async () => {
  const {
    buildFrame,
    beginWitness,
    geometrySignature,
    finishAccord,
    WITNESS_COUNT
  } = await loadEngine();
  const quiet = buildFrame();
  const first = beginWitness(quiet, { x: 0.18, y: 0.25 });
  const second = beginWitness(first, { x: 0.78, y: 0.27 });
  const third = beginWitness(second, { x: 0.52, y: 0.78 });

  assert.equal(WITNESS_COUNT, 9);
  assert.equal(geometrySignature(first), geometrySignature(quiet));
  assert.equal(geometrySignature(second), geometrySignature(quiet));
  assert.equal(geometrySignature(third), geometrySignature(quiet));
  assert.equal(third.memory.length, 0);
  assert.equal(third.attention.witnesses.length, 3);
  assert.equal(new Set(third.attention.witnesses).size, 3);

  const committed = finishAccord(third, { confirmed: true, pressure: 0.74 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'depth-accord');
  assert.ok(committed.field.bands.length >= 7);
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.bands.some((band, index) => band.depth !== quiet.field.bands[index].depth));
});

test('WebGPU v040 refuses repeated or incomplete witnesses, bounds accords, and lifts the exact prior field', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    beginWitness,
    finishAccord,
    liftLatestAccord,
    releaseArchive,
    defaultAccord,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const repeated = beginWitness(beginWitness(quiet, { x: 0.18, y: 0.21 }), { x: 0.18, y: 0.21 });
  assert.match(repeated.lastAction, /refused-repeat/);
  const incomplete = finishAccord(beginWitness(quiet, { x: 0.18, y: 0.21 }), { confirmed: true });
  assert.equal(incomplete.memory.length, 0);
  assert.match(incomplete.lastAction, /refused-incomplete/);

  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const preset = defaultAccord(frame);
    frame = preset.witnesses.reduce((next, witness) => beginWitness(next, witness), frame);
    frame = finishAccord(frame, { confirmed: true, pressure: preset.pressure });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestAccord(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(geometrySignature(releaseArchive()), geometrySignature(quiet));
});

test('WebGPU v040 stores the collective response as a changed depth order while the three witnesses remain exact', async () => {
  const { buildFrame, beginWitness, finishAccord } = await loadEngine();
  const quiet = buildFrame();
  const selected = [0, 4, 7];
  const armed = selected.reduce((frame, index) => beginWitness(frame, { index }), quiet);
  const committed = finishAccord(armed, { confirmed: true, pressure: 0.82 });

  assert.deepEqual(quiet.field.depthOrder, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.notDeepEqual(committed.field.depthOrder, quiet.field.depthOrder);
  selected.forEach((index) => {
    assert.deepEqual(committed.field.bands[index], quiet.field.bands[index]);
  });
});

test('WebGPU v040 exposes a shader tableau and explicit art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v040/index.html');
  const sketch = await read('studies/webgpu/v040/sketch.js');
  const style = await read('studies/webgpu/v040/style.css');
  const readme = await read('studies/webgpu/v040/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v040/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v040/critiques.json'));

  assert.match(index, /id="accord-field"/);
  assert.match(index, /data-gesture="accord"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /createShader|WEBGL/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /beginWitness|touchStarted|pointer/);
  assert.match(sketch, /finishAccord/);
  assert.match(sketch, /createShader|frag/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'p5.js WebGL fragment shader depth accord with WebGPU capability signal');
  assert.match(metrics.memoryRule, /depth|accord|remote|witness/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v040 is recorded exactly once for the 2026-10-31 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-31');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-31');
  assert.equal(record.rawPath, '/studies/webgpu/v040/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-31');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /proximity|attention|agent/i);
  assert.match(record.source.translatedRule, /depth|accord|remote|witness/i);
  assert.match(record.metrics.memoryRule, /depth|accord|remote|witness/i);
  assert.equal(await read('works/webgpu-2026-10-31/index.html').then(Boolean), true);
});
