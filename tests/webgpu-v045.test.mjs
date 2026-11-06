import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v045/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v045 keeps a material charge inert until a sustained release threshold is crossed', async () => {
  const {
    LOAD_THRESHOLD_MS,
    buildFrame,
    beginCharge,
    updateCharge,
    finishCharge,
    geometrySignature
  } = await loadEngine();
  const quiet = buildFrame();
  const started = beginCharge(quiet, { index: 17, time: 0 });
  const holding = updateCharge(started, { index: 17, time: LOAD_THRESHOLD_MS - 80 });
  const refused = finishCharge(holding, { index: 17, time: LOAD_THRESHOLD_MS - 80, confirmed: true });

  assert.ok(LOAD_THRESHOLD_MS >= 500);
  assert.equal(geometrySignature(started), geometrySignature(quiet));
  assert.equal(geometrySignature(holding), geometrySignature(quiet));
  assert.equal(geometrySignature(refused), geometrySignature(quiet));
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused|incomplete/);
});

test('WebGPU v045 turns a sustained charge into nonlocal stratigraphy while the loaded cell stays exact', async () => {
  const { LOAD_THRESHOLD_MS, buildFrame, beginCharge, updateCharge, finishCharge, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const sourceIndex = 17;
  const charged = finishCharge(
    updateCharge(beginCharge(quiet, { index: sourceIndex, time: 0 }), { index: sourceIndex, time: LOAD_THRESHOLD_MS + 220 }),
    { index: sourceIndex, time: LOAD_THRESHOLD_MS + 220, confirmed: true }
  );
  const changedCells = charged.field.cells.filter((cell, index) => JSON.stringify(cell) !== JSON.stringify(quiet.field.cells[index]));

  assert.equal(charged.memory.length, 1);
  assert.equal(charged.memory[0].type, 'sediment-load');
  assert.equal(charged.memory[0].sourceIndex, sourceIndex);
  assert.equal(geometrySignature(charged) === geometrySignature(quiet), false);
  assert.deepEqual(charged.field.cells[sourceIndex], quiet.field.cells[sourceIndex]);
  assert.ok(changedCells.length >= 20);
  assert.ok(charged.field.cells.some((cell) => cell.layers > quiet.field.cells[cell.id].layers || cell.load > 0));
});

test('WebGPU v045 turns the release direction into a different compaction grammar', async () => {
  const { LOAD_THRESHOLD_MS, buildFrame, beginCharge, updateCharge, finishCharge } = await loadEngine();
  const commit = (direction) => finishCharge(
    updateCharge(beginCharge(buildFrame(), { index: 31, time: 0 }), { index: 31, time: LOAD_THRESHOLD_MS + 220 }),
    { index: 31, time: LOAD_THRESHOLD_MS + 220, direction, confirmed: true }
  );
  const forward = commit(1);
  const reverse = commit(-1);

  assert.equal(forward.memory[0].direction, 1);
  assert.equal(reverse.memory[0].direction, -1);
  assert.notEqual(forward.field.signature, reverse.field.signature);
});

test('WebGPU v045 cancels an unfinished charge without leaving a ghost layer', async () => {
  const { LOAD_THRESHOLD_MS, buildFrame, beginCharge, updateCharge, cancelCharge, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const holding = updateCharge(beginCharge(quiet, { index: 7, time: 0 }), { index: 7, time: LOAD_THRESHOLD_MS + 40 });
  const cancelled = cancelCharge(holding);

  assert.equal(cancelled.memory.length, 0);
  assert.equal(geometrySignature(cancelled), geometrySignature(quiet));
  assert.equal(cancelled.lastAction, 'charge-cancelled');
});

test('WebGPU v045 compounds four strata, lifts the latest load exactly, and releases to seed', async () => {
  const { MEMORY_LIMIT, STAGES, buildFrame, buildTimeline, liftLatestCharge, releaseArchive, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatestCharge(settled);
  const released = releaseArchive();

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.field.layers.length, MEMORY_LIMIT);
  assert.equal(settled.memory.every((event) => event.reason === 'timeline'), true);
  assert.notEqual(geometrySignature(settled), geometrySignature(quiet));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(geometrySignature(released), geometrySignature(quiet));
  assert.equal(geometrySignature(buildTimeline().at(-1)), geometrySignature(timeline.at(-1)));
});

test('WebGPU v045 exposes a stratigraphic 3D tableau with a full art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v045/index.html');
  const sketch = await read('studies/webgpu/v045/sketch.js');
  const style = await read('studies/webgpu/v045/style.css');
  const readme = await read('studies/webgpu/v045/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v045/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v045/critiques.json'));

  assert.match(index, /id="strata-field"/);
  assert.match(index, /data-gesture="charge"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /beginCharge|pointerdown|touch/);
  assert.match(sketch, /finishCharge/);
  assert.match(sketch, /WEBGL|box|strata/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'sediment-strata');
  assert.match(metrics.memoryRule, /charge|strata|compaction/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v045 is recorded exactly once for the 2026-11-06 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-06');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'webgpu-2026-11-06');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-06');
  assert.equal(record.rawPath, '/studies/webgpu/v045/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-06');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /material|pressure|direction|geometry/i);
  assert.match(record.source.translatedRule, /load|charge|strata|compaction/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/webgpu-2026-11-06/index.html').then(Boolean), true);
});
