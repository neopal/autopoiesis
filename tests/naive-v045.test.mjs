import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v045/engine.mjs';

test('Naive v045 keeps a pressure trace geometry-neutral until a dwell-and-return release grows a membrane elsewhere', async () => {
  const {
    PRESSURE_SITES,
    beginPressure,
    buildFrame,
    geometrySignature,
    pressureSample,
    releasePressure,
    cavitySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  let state = beginPressure(baseline, PRESSURE_SITES[1]);
  assert.equal(state.interaction, 'pressure-started');
  const startedGeometry = geometrySignature(state);
  state = pressureSample(state, { x: PRESSURE_SITES[1].x + 0.08, y: PRESSURE_SITES[1].y - 0.04, pressure: 0.82 });
  state = pressureSample(state, { x: PRESSURE_SITES[1].x - 0.05, y: PRESSURE_SITES[1].y + 0.03, pressure: 0.76 });
  assert.equal(geometrySignature(state), startedGeometry);
  const released = releasePressure(state);
  assert.equal(released.interaction, 'pressure-committed');
  assert.equal(released.memory.length, 1);
  assert.equal(released.memory[0].kind, 'false-membrane');
  assert.notEqual(geometrySignature(released), geometrySignature(baseline));
  assert.equal(released.scene.trace.changedCavityCount, 0);
  assert.equal(cavitySignature(released.scene.cavities[1]), cavitySignature(baseline.scene.cavities[1]));
  assert.equal(released.scene.membranes[0].sourceSite, 1);
});

test('Naive v045 refuses weak or one-way pressure, compounds four membranes, and lifts exactly', async () => {
  const {
    MEMORY_WINDOW,
    PRESSURE_SITES,
    beginPressure,
    buildFrame,
    buildTimeline,
    geometrySignature,
    liftLatestPressure,
    pressureSample,
    releaseMemory,
    releasePressure
  } = await import(engineUrl);

  let state = beginPressure(buildFrame(), PRESSURE_SITES[0]);
  state = pressureSample(state, { x: PRESSURE_SITES[0].x + 0.02, y: PRESSURE_SITES[0].y, pressure: 0.18 });
  const weak = releasePressure(state);
  assert.equal(weak.interaction, 'pressure-refused-weak');
  assert.equal(weak.memory.length, 0);

  state = beginPressure(buildFrame(), PRESSURE_SITES[2]);
  state = pressureSample(state, { x: PRESSURE_SITES[2].x + 0.12, y: PRESSURE_SITES[2].y, pressure: 0.74 });
  const oneWay = releasePressure(state);
  assert.equal(oneWay.interaction, 'pressure-refused-one-way');
  assert.equal(oneWay.memory.length, 0);

  state = buildFrame();
  for (const gesture of buildTimeline()) {
    let next = beginPressure(state, PRESSURE_SITES[gesture.site]);
    for (const sample of gesture.samples) next = pressureSample(next, sample);
    state = releasePressure(next);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.membraneCount, MEMORY_WINDOW);
  assert.ok(state.memory.every((event) => event.sourceSite !== event.targetSite));
  const lifted = liftLatestPressure(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(state));
  assert.deepEqual(releaseMemory(lifted).scene, buildFrame().scene);
});

test('Naive v045 is deterministic and records the pressure-membrane artifact contract', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };

  for (const path of [
    'studies/naive-art/v045/index.html',
    'studies/naive-art/v045/engine.mjs',
    'studies/naive-art/v045/sketch.js',
    'studies/naive-art/v045/style.css',
    'studies/naive-art/v045/README.md',
    'studies/naive-art/v045/metrics.json',
    'studies/naive-art/v045/critiques.json',
    'works/naive-2026-11-06/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v045/index.html');
  const sketch = await read('studies/naive-art/v045/sketch.js');
  const style = await read('studies/naive-art/v045/style.css');
  const readme = await read('studies/naive-art/v045/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v045/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v045/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-06');
  const record = records[0];

  assert.match(index, /id="pressure-membrane"/);
  assert.match(index, /data-action="ask"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-11-06"/);
  assert.match(sketch, /beginPressure/);
  assert.match(sketch, /pressureSample/);
  assert.match(sketch, /window\.__mutineNaiveV045/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413435');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /membrane|cavity|slab/i);
  assert.match(metrics.interactionRule, /pressure|dwell|return/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-11-06');
  assert.equal(record.rawPath, '/studies/naive-art/v045/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-11-06');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|membrane|cavity/i);
  assert.ok(record.critiques.length >= 9);
});
