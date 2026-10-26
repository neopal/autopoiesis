import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v036/engine.mjs';

test('Naive v036 turns a full page-turn into a non-local fold error, not a pointer mark', async () => {
  const {
    buildFrame,
    beginTurn,
    commitTurn,
    geometrySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginTurn(baseline, { focus: 2, direction: 1 });
  const committed = commitTurn(armed, { focus: 2, direction: 1, distance: 0.46 });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'a reader position must not write before the turn completes');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must be geometry-neutral');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.focus, 2);
  assert.notEqual(event.open, event.focus, 'an unread fold must answer remotely');
  assert.notEqual(event.echo, event.focus, 'a third fold must inherit the wrong crease');
  assert.equal(committed.scene.folds[event.focus].role, 'shut');
  assert.equal(committed.scene.folds[event.open].role, 'invented-open');
  assert.equal(committed.scene.folds[event.echo].role, 'echo-fold');
  assert.ok(committed.scene.trace.changedFoldCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v036 refuses shallow turns and reconstructs the exact prior accordion', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    buildTimeline,
    beginTurn,
    commitTurn,
    geometrySignature,
    liftLatestTurn,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginTurn(baseline, { focus: 1, direction: -1 });
  const refused = commitTurn(armed, { focus: 1, direction: -1, distance: 0.08 });
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'turn-refused-shallow');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  let state = baseline;
  for (const turn of buildTimeline()) {
    const pending = beginTurn(state, turn);
    state = commitTurn(pending, turn);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestTurn(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const replayed = commitTurn(beginTurn(buildFrame(), buildTimeline()[0]), buildTimeline()[0]);
  const repeated = commitTurn(beginTurn(buildFrame(), buildTimeline()[0]), buildTimeline()[0]);
  assert.deepEqual(replayed, repeated);
});

test('Naive v036 is a browser-native fold tableau with an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v036/index.html',
    'studies/naive-art/v036/engine.mjs',
    'studies/naive-art/v036/sketch.js',
    'studies/naive-art/v036/style.css',
    'studies/naive-art/v036/README.md',
    'studies/naive-art/v036/metrics.json',
    'studies/naive-art/v036/critiques.json',
    'works/naive-2026-10-26/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v036/index.html');
  const sketch = await read('studies/naive-art/v036/sketch.js');
  const style = await read('studies/naive-art/v036/style.css');
  const readme = await read('studies/naive-art/v036/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v036/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v036/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-26');
  const record = records[0];

  assert.match(index, /id="fold-field"/);
  assert.match(index, /data-action="turn"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-26"/);
  assert.doesNotMatch(index, /<canvas|<svg/i);
  assert.match(sketch, /wheel/);
  assert.match(sketch, /scroll|Arrow/i);
  assert.match(sketch, /commitTurn/);
  assert.match(sketch, /window\.__mutineNaiveV036/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413336');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /DOM|accordion|fold/i);
  assert.match(metrics.interactionRule, /scroll|turn|Arrow/i);
  assert.equal(critiques.length, 9);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-26');
  assert.equal(record.rawPath, '/studies/naive-art/v036/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-26');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /fold|unseen|attention/i);
  assert.ok(record.critiques.length >= 8);
});
