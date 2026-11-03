import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v043/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);


test('WebGPU v043 keeps a grain trace inert until material resistance is crossed', async () => {
  const {
    CELL_COUNT,
    RESISTANCE_THRESHOLD,
    buildFrame,
    beginTrace,
    updateTrace,
    finishTrace,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const started = beginTrace(quiet, { index: 2, time: 0 });
  const moving = updateTrace(started, {
    x: 0.52,
    y: 0.48,
    time: 320,
    span: 0.42,
    alignment: RESISTANCE_THRESHOLD - 0.08,
    direction: 1
  });

  assert.equal(CELL_COUNT, 12);
  assert.equal(geometrySignature(started), geometrySignature(quiet));
  assert.equal(geometrySignature(moving), geometrySignature(quiet));
  assert.equal(moving.memory.length, 0);

  const refused = finishTrace(moving, {
    span: 0.42,
    alignment: RESISTANCE_THRESHOLD - 0.08,
    confirmed: true
  });
  assert.equal(refused.memory.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(quiet));
  assert.match(refused.lastAction, /refused-resistance/);
});


test('WebGPU v043 transfers resistance into a remote facet while the traced cell stays exact', async () => {
  const {
    RESISTANCE_THRESHOLD,
    buildFrame,
    beginTrace,
    updateTrace,
    finishTrace,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const started = beginTrace(quiet, { index: 2, time: 0, direction: 1 });
  const committed = finishTrace(
    updateTrace(started, {
      x: 0.7,
      y: 0.3,
      time: 480,
      span: 0.82,
      alignment: RESISTANCE_THRESHOLD + 0.16,
      direction: 1
    }),
    { span: 0.82, alignment: RESISTANCE_THRESHOLD + 0.16, direction: 1, confirmed: true }
  );

  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'resistance-transfer');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.notEqual(committed.memory[0].receiverIndex, committed.memory[0].sourceIndex);
  assert.equal(committed.field.cells.length, 12);
  assert.deepEqual(
    committed.field.cells[committed.memory[0].sourceIndex],
    quiet.field.cells[committed.memory[0].sourceIndex]
  );
  assert.notDeepEqual(
    committed.field.cells[committed.memory[0].receiverIndex],
    quiet.field.cells[committed.memory[0].receiverIndex]
  );
  assert.ok(committed.field.cells[committed.memory[0].receiverIndex].facetCount > quiet.field.cells[committed.memory[0].receiverIndex].facetCount);
  assert.ok(committed.field.cells[committed.memory[0].receiverIndex].resistance > 0);
});


test('WebGPU v043 compounds four material transfers, lifts exactly, and releases the membrane', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    defaultTrace,
    beginTrace,
    finishTrace,
    liftLatestTrace,
    releaseArchive,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const preset = defaultTrace(frame);
    frame = beginTrace(frame, { index: preset.index, time: 0, direction: preset.direction });
    frame = finishTrace(frame, { ...preset, confirmed: true });
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestTrace(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(geometrySignature(releaseArchive()), geometrySignature(quiet));
});


test('WebGPU v043 exposes a 3D resistance-membrane tableau and an explicit art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v043/index.html');
  const sketch = await read('studies/webgpu/v043/sketch.js');
  const style = await read('studies/webgpu/v043/style.css');
  const readme = await read('studies/webgpu/v043/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v043/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v043/critiques.json'));

  assert.match(index, /id="resistance-field"/);
  assert.match(index, /data-gesture="trace"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /WEBGL/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /beginTrace|pointer|touch/);
  assert.match(sketch, /finishTrace/);
  assert.match(sketch, /WEBGL|box|beginShape/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'resistance-membrane');
  assert.match(metrics.memoryRule, /resistance|remote|facet|membrane/i);
  assert.ok(critiques.length >= 9);
});


test('WebGPU v043 is recorded exactly once for the 2026-11-03 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-03');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-03');
  assert.equal(record.rawPath, '/studies/webgpu/v043/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-03');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /material|pressure|direction|geometry/i);
  assert.match(record.source.translatedRule, /resistance|remote|facet|membrane/i);
  assert.match(record.metrics.memoryRule, /resistance|remote|facet|membrane/i);
  assert.equal(await read('works/webgpu-2026-11-03/index.html').then(Boolean), true);
});
