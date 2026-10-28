import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v038/engine.mjs';

test('Naive v038 turns a held attention into a remote missing witness', async () => {
  const {
    beginLook,
    buildFrame,
    commitLook,
    geometrySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginLook(baseline, { witness: 2 });
  const committed = commitLook(armed, { witness: 2, dwell: 0.68 });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'being near a witness must not write before departure');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must be geometry-neutral');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.witness, 2);
  assert.notEqual(event.missing, event.witness, 'the missing witness must be remote');
  assert.notEqual(event.echo, event.witness, 'the false reconstruction must be remote');
  assert.equal(committed.scene.witnesses[event.witness].role, 'quieted');
  assert.equal(committed.scene.witnesses[event.missing].role, 'missing-witness');
  assert.equal(committed.scene.witnesses[event.echo].role, 'false-reconstruction');
  assert.ok(committed.scene.trace.changedWitnessCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v038 refuses a short look and lifts the exact prior witness field', async () => {
  const {
    MEMORY_WINDOW,
    beginLook,
    buildFrame,
    buildTimeline,
    commitLook,
    geometrySignature,
    liftLatestLook,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginLook(baseline, { witness: 1 });
  const refused = commitLook(armed, { witness: 1, dwell: 0.08 });
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'look-refused-short');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  let state = baseline;
  for (const look of buildTimeline()) {
    state = commitLook(beginLook(state, look), look);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestLook(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const first = buildTimeline()[0];
  const replayed = commitLook(beginLook(buildFrame(), first), first);
  const repeated = commitLook(beginLook(buildFrame(), first), first);
  assert.deepEqual(replayed, repeated);
});

test('Naive v038 is a p5.js witness-absence tableau with an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v038/index.html',
    'studies/naive-art/v038/engine.mjs',
    'studies/naive-art/v038/sketch.js',
    'studies/naive-art/v038/style.css',
    'studies/naive-art/v038/README.md',
    'studies/naive-art/v038/metrics.json',
    'studies/naive-art/v038/critiques.json',
    'works/naive-2026-10-28/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v038/index.html');
  const sketch = await read('studies/naive-art/v038/sketch.js');
  const style = await read('studies/naive-art/v038/style.css');
  const readme = await read('studies/naive-art/v038/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v038/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v038/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-28');
  const record = records[0];

  assert.match(index, /id="witness-field"/);
  assert.match(index, /data-action="look"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-28"/);
  assert.match(index, /p5\.js\/1\.11\.3/);
  assert.match(sketch, /beginLook/);
  assert.match(sketch, /commitLook/);
  assert.match(sketch, /createGraphics/);
  assert.match(sketch, /window\.__mutineNaiveV038/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413338');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /SVG|cutout|witness/i);
  assert.match(metrics.interactionRule, /dwell|look|departure/i);
  assert.equal(critiques.length, 9);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-28');
  assert.equal(record.rawPath, '/studies/naive-art/v038/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-28');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /witness|attention|missing/i);
  assert.ok(record.critiques.length >= 8);
});
