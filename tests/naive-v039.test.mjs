import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v039/engine.mjs';

test('Naive v039 marks one quiet cell, then miscounts a remote patch', async () => {
  const {
    beginRead,
    buildFrame,
    commitRead,
    geometrySignature,
    cellSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginRead(baseline, { cell: 127 });
  const committed = commitRead(armed, { cell: 127, confidence: 0.68 });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'marking a cell must not write before the correction is committed');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'marking must be geometry-neutral');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.cell, 127);
  assert.notEqual(event.target, event.cell, 'the wrong patch must be remote');
  assert.ok(event.distance >= 0.24, 'the wrong patch must be materially displaced');
  assert.notDeepEqual(cellSignature(committed.scene.cells[event.cell]), cellSignature(committed.scene.cells[event.target]));
  assert.equal(cellSignature(committed.scene.cells[event.cell]), cellSignature(baseline.scene.cells[event.cell]), 'the marked cell stays quiet');
  assert.equal(committed.scene.cells[event.target].role, 'wrong-patch');
  assert.equal(committed.scene.cells[event.vacancy].role, 'false-void');
  assert.ok(committed.scene.trace.changedCellCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v039 refuses an incomplete mark and replays four miscounts exactly', async () => {
  const {
    MEMORY_WINDOW,
    beginRead,
    buildFrame,
    buildTimeline,
    commitRead,
    geometrySignature,
    liftLatestRead,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginRead(baseline, { cell: 24 });
  const refused = commitRead(armed, { cell: 24, confidence: 0.08 });
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'read-refused-light');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  let state = baseline;
  for (const readEvent of buildTimeline()) {
    state = commitRead(beginRead(state, readEvent), readEvent);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestRead(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const first = buildTimeline()[0];
  const replayed = commitRead(beginRead(buildFrame(), first), first);
  const repeated = commitRead(beginRead(buildFrame(), first), first);
  assert.deepEqual(replayed, repeated);
});

test('Naive v039 is a deterministic cellular miscount tableau with an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v039/index.html',
    'studies/naive-art/v039/engine.mjs',
    'studies/naive-art/v039/sketch.js',
    'studies/naive-art/v039/style.css',
    'studies/naive-art/v039/README.md',
    'studies/naive-art/v039/metrics.json',
    'studies/naive-art/v039/critiques.json',
    'works/naive-2026-10-29/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v039/index.html');
  const sketch = await read('studies/naive-art/v039/sketch.js');
  const style = await read('studies/naive-art/v039/style.css');
  const readme = await read('studies/naive-art/v039/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v039/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v039/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-29');
  const record = records[0];

  assert.match(index, /id="miscount-field"/);
  assert.match(index, /data-action="miscount"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-29"/);
  assert.match(index, /p5\.js\/1\.11\.3/);
  assert.match(sketch, /beginRead/);
  assert.match(sketch, /commitRead/);
  assert.match(sketch, /createGraphics/);
  assert.match(sketch, /window\.__mutineNaiveV039/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413339');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /cell|raster|pixel/i);
  assert.match(metrics.interactionRule, /mark|commit|cell/i);
  assert.equal(critiques.length, 9);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-29');
  assert.equal(record.rawPath, '/studies/naive-art/v039/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-29');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /cell|attention|miscount/i);
  assert.ok(record.critiques.length >= 8);
});
