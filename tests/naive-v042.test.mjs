import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v042/engine.mjs';

test('Naive v042 keeps a depth scan latent until reversal, then misregisters remote solids', async () => {
  const {
    advanceScan,
    beginScan,
    buildFrame,
    commitScan,
    geometrySignature,
    blockSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const started = beginScan(baseline, { direction: 1 });
  assert.equal(started.memory.length, 0);
  assert.equal(geometrySignature(started), geometrySignature(baseline));

  const forward = advanceScan(started, { direction: 1, distance: 0.52 });
  assert.equal(forward.memory.length, 0);
  assert.equal(geometrySignature(forward), geometrySignature(baseline));

  const incomplete = commitScan(forward);
  assert.equal(incomplete.memory.length, 0);
  assert.equal(incomplete.interaction, 'scan-refused-incomplete');

  const reversed = advanceScan(forward, { direction: -1, distance: 0.52 });
  const committed = commitScan(reversed);
  const event = committed.memory.at(-1);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'scan-committed');
  assert.equal(event.direction, 1);
  assert.notEqual(event.source, event.swap);
  assert.notEqual(event.source, event.shear);
  assert.notEqual(event.source, event.hollow);
  assert.equal(blockSignature(committed.scene.blocks[event.source]), blockSignature(baseline.scene.blocks[event.source]));
  assert.ok(committed.scene.trace.changedBlockCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v042 compounds four depth errors and lifts the latest one exactly', async () => {
  const {
    MEMORY_WINDOW,
    advanceScan,
    beginScan,
    buildFrame,
    buildTimeline,
    commitScan,
    geometrySignature,
    liftLatestScan,
    releaseMemory
  } = await import(engineUrl);

  let state = buildFrame();
  for (const direction of buildTimeline()) {
    state = commitScan(advanceScan(beginScan(state, { direction }), { direction: -direction, distance: 0.66 }));
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.ok(state.scene.trace.changedBlockCount >= 3);

  const lifted = liftLatestScan(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(state));
  assert.deepEqual(releaseMemory(lifted).scene, buildFrame().scene);
});

test('Naive v042 is deterministic, volumetric, and wired to the daily record', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };

  for (const path of [
    'studies/naive-art/v042/index.html',
    'studies/naive-art/v042/engine.mjs',
    'studies/naive-art/v042/sketch.js',
    'studies/naive-art/v042/style.css',
    'studies/naive-art/v042/README.md',
    'studies/naive-art/v042/metrics.json',
    'studies/naive-art/v042/critiques.json',
    'works/naive-2026-11-02/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v042/index.html');
  const sketch = await read('studies/naive-art/v042/sketch.js');
  const style = await read('studies/naive-art/v042/style.css');
  const readme = await read('studies/naive-art/v042/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v042/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v042/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-02');
  const record = records[0];

  assert.match(index, /id="wrong-volume"/);
  assert.match(index, /data-action="invert"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-11-02"/);
  assert.match(sketch, /advanceScan/);
  assert.match(sketch, /commitScan/);
  assert.match(sketch, /window\.__mutineNaiveV042/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413432');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /webgl|volume|solid/i);
  assert.match(metrics.interactionRule, /scan|reverse|depth/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-11-02');
  assert.equal(record.rawPath, '/studies/naive-art/v042/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-11-02');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /depth|volume|reverse|pressure/i);
  assert.ok(record.critiques.length >= 9);
});
