import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v027/engine.mjs';

const CLOSED_LOOP = { startX: 0.18, startY: 0.78, endX: 0.22, endY: 0.75, length: 0.94, closure: 0.06 };

test('Naive v027 turns a closed correction loop into a wrong registration of one print body', async () => {
  const {
    buildFrame,
    commitCorrection,
    geometrySignature,
    PLATE_COUNT,
    changedLayerIds
  } = await import(engineUrl);

  const baseline = buildFrame(0, []);
  const corrected = commitCorrection(baseline, CLOSED_LOOP);
  const event = corrected.memory.at(-1);

  assert.equal(baseline.memory.length, 0);
  assert.equal(baseline.scene.plates.length, PLATE_COUNT);
  assert.equal(corrected.memory.length, 1);
  assert.equal(event.source, 'closed-correction');
  assert.ok(event.closed, 'the correction must be caused by returning to its start');
  assert.notEqual(event.seam, event.remote, 'the wrong registration must be non-local');
  assert.ok(changedLayerIds(corrected).length >= 5, 'one correction must move the whole print stack');
  assert.notEqual(geometrySignature(corrected), geometrySignature(baseline));
  assert.notEqual(
    corrected.scene.plates[event.seam].clipPath,
    baseline.scene.plates[event.seam].clipPath,
    'the selected seam must change real CSS geometry'
  );
  assert.notEqual(
    corrected.scene.plates[event.remote].voidPath,
    baseline.scene.plates[event.remote].voidPath,
    'a distant plate must carry the wrong correction as a real void'
  );
});

test('Naive v027 refuses an open loop and keeps correction memory exact and bounded', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    buildTimeline,
    commitCorrection,
    geometrySignature,
    liftLatestCorrection,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame(0, []);
  const refused = commitCorrection(baseline, { ...CLOSED_LOOP, endX: 0.71, endY: 0.12, closure: 0.62 });
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'correction-refused-open');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  const first = commitCorrection(baseline, CLOSED_LOOP);
  const repeat = commitCorrection(baseline, CLOSED_LOOP);
  assert.deepEqual(first, repeat, 'the same closed loop must replay deterministically');

  let state = baseline;
  for (const loop of buildTimeline().loops) state = commitCorrection(state, loop);
  assert.equal(state.memory.length, MEMORY_WINDOW);
  const beforeLift = state.memory.at(-1);
  const lifted = liftLatestCorrection(state);
  assert.equal(lifted.interaction, 'correction-lifted');
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(lifted.memory.at(-1), beforeLift);
  assert.notEqual(geometrySignature(lifted), geometrySignature(state));
  assert.deepEqual(releaseMemory(lifted).scene, buildFrame(0, []).scene);
});

test('Naive v027 exposes a DOM print tableau, loop interaction, and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v027/index.html',
    'studies/naive-art/v027/engine.mjs',
    'studies/naive-art/v027/sketch.js',
    'studies/naive-art/v027/style.css',
    'studies/naive-art/v027/README.md',
    'studies/naive-art/v027/metrics.json',
    'studies/naive-art/v027/critiques.json',
    'works/naive-2026-10-09/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v027/index.html');
  const sketch = await read('studies/naive-art/v027/sketch.js');
  const style = await read('studies/naive-art/v027/style.css');
  const readme = await read('studies/naive-art/v027/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v027/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v027/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-09');
  const record = matches[0];

  assert.match(index, /id="register-field"/);
  assert.match(index, /data-gesture="correct"/);
  assert.match(index, /data-gesture="undo"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-09"/);
  assert.match(sketch, /data-print-layer/);
  assert.match(sketch, /beginGesture/);
  assert.match(sketch, /commitCorrection/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /window\.__mutineNaiveV027/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413237');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /registration|correction|plate/i);
  assert.match(metrics.interactionRule, /loop|pointer|keyboard/i);
  assert.equal(critiques.length, 6);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-09');
  assert.equal(record.rawPath, '/studies/naive-art/v027/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-09');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|registration|print|material/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(record.metrics.representationRupture, /DOM|print|registration/i);
});
