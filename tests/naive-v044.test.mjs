import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v044/engine.mjs';

test('Naive v044 keeps noticed shutters exact and only a departure of three creates a remote absence', async () => {
  const {
    beginVisit,
    buildFrame,
    commitDeparture,
    geometrySignature,
    noticeShutter,
    shutterSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  let pending = beginVisit(baseline);
  for (const id of [1, 5, 8]) pending = noticeShutter(pending, id);
  assert.equal(pending.memory.length, 0);
  assert.deepEqual(pending.pending, [1, 5, 8]);
  assert.equal(geometrySignature(pending), geometrySignature(baseline));

  const committed = commitDeparture(pending);
  const event = committed.memory.at(-1);
  assert.equal(committed.interaction, 'departure-committed');
  assert.deepEqual(event.shutters, [1, 5, 8]);
  assert.equal(committed.scene.trace.changedShutterCount, 0);
  for (const id of event.shutters) {
    assert.equal(shutterSignature(committed.scene.shutters[id]), shutterSignature(baseline.scene.shutters[id]));
  }
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.equal(event.kind, 'remote-absence');
});

test('Naive v044 refuses an incomplete departure and compounds four liftable absences', async () => {
  const {
    MEMORY_WINDOW,
    beginVisit,
    buildFrame,
    buildTimeline,
    commitDeparture,
    liftLatestDeparture,
    noticeShutter,
    releaseMemory
  } = await import(engineUrl);

  let state = beginVisit(buildFrame());
  state = noticeShutter(state, 2);
  const refused = commitDeparture(state);
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'departure-refused-incomplete');
  assert.deepEqual(refused.pending, [2]);

  state = buildFrame();
  for (const shutters of buildTimeline()) {
    let next = beginVisit(state);
    for (const id of shutters) next = noticeShutter(next, id);
    state = commitDeparture(next);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.equal(state.scene.trace.absenceCount, MEMORY_WINDOW);

  const lifted = liftLatestDeparture(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(lifted.scene.trace.absenceCount, state.scene.trace.absenceCount);
  assert.deepEqual(releaseMemory(lifted).scene, buildFrame().scene);
});

test('Naive v044 is deterministic and records the departure rule in the daily artifact', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };

  for (const path of [
    'studies/naive-art/v044/index.html',
    'studies/naive-art/v044/engine.mjs',
    'studies/naive-art/v044/sketch.js',
    'studies/naive-art/v044/style.css',
    'studies/naive-art/v044/README.md',
    'studies/naive-art/v044/metrics.json',
    'studies/naive-art/v044/critiques.json',
    'works/naive-2026-11-05/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v044/index.html');
  const sketch = await read('studies/naive-art/v044/sketch.js');
  const style = await read('studies/naive-art/v044/style.css');
  const readme = await read('studies/naive-art/v044/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v044/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v044/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-05');
  const record = records[0];

  assert.match(index, /id="absence-wall"/);
  assert.match(index, /data-action="ask"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-11-05"/);
  assert.match(sketch, /noticeShutter/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /window\.__mutineNaiveV044/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.equal(metrics.seed, '0x4e413434');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /shutter|wall|absence/i);
  assert.match(metrics.interactionRule, /departure|three|shutter/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-11-05');
  assert.equal(record.rawPath, '/studies/naive-art/v044/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-11-05');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /departure|presence|absence|shutter/i);
  assert.ok(record.critiques.length >= 9);
});
