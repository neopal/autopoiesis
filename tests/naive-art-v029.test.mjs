import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v029/engine.mjs';

const VALID_GESTURE = {
  first: 1,
  second: 9,
  crossings: 3,
  travel: 0.78,
  directionChanges: 2,
  duration: 820,
  points: [[0.18, 0.72], [0.48, 0.62], [0.76, 0.28], [0.84, 0.22]]
};

test('Naive v029 makes a hesitant cross-seam gesture misjoin distant picture parts', async () => {
  const {
    PATCH_COUNT,
    buildFrame,
    armPatch,
    commitGesture,
    changedPatchIds,
    geometrySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = armPatch(baseline, 1);
  const refused = commitGesture(armed, { ...VALID_GESTURE, crossings: 1, duration: 180 });
  const committed = commitGesture(armed, VALID_GESTURE);
  const event = committed.memory.at(-1);

  assert.equal(baseline.scene.patches.length, PATCH_COUNT);
  assert.equal(armed.memory.length, 0, 'arming must not write history');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must not alter picture geometry');
  assert.equal(refused.memory.length, 0, 'a short or un-crossed gesture must be refused');
  assert.equal(refused.interaction, 'gesture-refused-shallow');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.kind, 'hesitation-relay');
  assert.notEqual(event.first, event.second, 'the gesture must connect distant parts');
  assert.ok(event.crossings >= 2);
  assert.ok(event.directionChanges >= 1);
  assert.ok(changedPatchIds(committed).length >= 3, 'one false join must change at least three patch geometries');
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.equal(committed.scene.patches[event.first].role, 'misjoined-source');
  assert.equal(committed.scene.patches[event.second].role, 'relay');
  assert.equal(committed.scene.patches[event.echo].role, 'echo');
});

test('Naive v029 bounds hesitation memory and lifts the exact preceding picture', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    buildTimeline,
    commitGesture,
    geometrySignature,
    liftLatestGesture,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  let state = baseline;
  for (const gesture of buildTimeline().gestures) state = commitGesture(state, gesture);
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestGesture(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene, 'release must return to the seeded picture');

  const replayed = commitGesture(buildFrame(), buildTimeline().gestures[0]);
  assert.deepEqual(replayed, commitGesture(buildFrame(), buildTimeline().gestures[0]));
});

test('Naive v029 exposes a canvas tableau, hesitation interaction, and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v029/index.html',
    'studies/naive-art/v029/engine.mjs',
    'studies/naive-art/v029/sketch.js',
    'studies/naive-art/v029/style.css',
    'studies/naive-art/v029/README.md',
    'studies/naive-art/v029/metrics.json',
    'studies/naive-art/v029/critiques.json',
    'works/naive-2026-10-12/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v029/index.html');
  const sketch = await read('studies/naive-art/v029/sketch.js');
  const style = await read('studies/naive-art/v029/style.css');
  const readme = await read('studies/naive-art/v029/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v029/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v029/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-12');
  const record = matches[0];

  assert.match(index, /id="junction-canvas"/);
  assert.match(index, /data-gesture="misjoin"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-12"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /commitGesture/);
  assert.match(sketch, /window\.__mutineNaiveV029/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413239');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /canvas|raster|picture/i);
  assert.match(metrics.interactionRule, /cross|hesitat|gesture/i);
  assert.equal(critiques.length, 6);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-12');
  assert.equal(record.rawPath, '/studies/naive-art/v029/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-12');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /proximity|attention|cross|misjoin/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(record.metrics.representationRupture, /canvas|raster|picture/i);
});
