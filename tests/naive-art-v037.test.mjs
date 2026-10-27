import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v037/engine.mjs';

test('Naive v037 turns a three-mark chord into a remote false imprint', async () => {
  const {
    buildFrame,
    beginChord,
    commitChord,
    geometrySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginChord(baseline, { anchors: [1, 4, 8] });
  const committed = commitChord(armed, { anchors: [1, 4, 8], pressure: 0.58 });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'arming a chord must not write a mistake');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must be geometry-neutral');
  assert.equal(committed.memory.length, 1);
  assert.deepEqual(event.anchors, [1, 4, 8]);
  assert.ok(!event.anchors.includes(event.falseImprint), 'the false imprint must be non-local');
  assert.ok(!event.anchors.includes(event.vacancy), 'the vacancy must be non-local');
  assert.ok(!event.anchors.includes(event.ridge), 'the pressure ridge must be non-local');
  assert.equal(committed.scene.stamps[event.falseImprint].role, 'false-imprint');
  assert.equal(committed.scene.stamps[event.vacancy].role, 'vacancy');
  assert.equal(committed.scene.stamps[event.ridge].role, 'pressure-ridge');
  assert.ok(committed.scene.trace.changedStampCount >= 4);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v037 refuses incomplete chords and lifts the exact prior print', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    buildTimeline,
    beginChord,
    commitChord,
    geometrySignature,
    liftLatestChord,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginChord(baseline, { anchors: [2, 5] });
  const refused = commitChord(armed, { anchors: [2, 5], pressure: 0.58 });
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'chord-refused-incomplete');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  let state = baseline;
  for (const chord of buildTimeline()) {
    state = commitChord(beginChord(state, chord), chord);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestChord(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const replayed = commitChord(beginChord(buildFrame(), buildTimeline()[0]), buildTimeline()[0]);
  const repeated = commitChord(beginChord(buildFrame(), buildTimeline()[0]), buildTimeline()[0]);
  assert.deepEqual(replayed, repeated);
});

test('Naive v037 is a p5.js pressure-print tableau with an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v037/index.html',
    'studies/naive-art/v037/engine.mjs',
    'studies/naive-art/v037/sketch.js',
    'studies/naive-art/v037/style.css',
    'studies/naive-art/v037/README.md',
    'studies/naive-art/v037/metrics.json',
    'studies/naive-art/v037/critiques.json',
    'works/naive-2026-10-27/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v037/index.html');
  const sketch = await read('studies/naive-art/v037/sketch.js');
  const readme = await read('studies/naive-art/v037/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v037/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v037/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-27');
  const record = records[0];

  assert.match(index, /id="print-field"/);
  assert.match(index, /data-action="misread"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-27"/);
  assert.match(index, /p5\.js\/1\.11\.3/);
  assert.match(sketch, /beginChord/);
  assert.match(sketch, /commitChord/);
  assert.match(sketch, /window\.__mutineNaiveV037/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413337');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /p5\.js|raster|print/i);
  assert.match(metrics.interactionRule, /three|chord|pressure/i);
  assert.equal(critiques.length, 9);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-27');
  assert.equal(record.rawPath, '/studies/naive-art/v037/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-27');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|imprint|geometry/i);
  assert.ok(record.critiques.length >= 8);
});
