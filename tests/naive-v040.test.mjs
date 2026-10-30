import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v040/engine.mjs';

test('Naive v040 turns a bounded pressure sweep into a remote hardened cast', async () => {
  const {
    beginPress,
    buildFrame,
    commitPress,
    geometrySignature,
    layerSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginPress(baseline, { layer: 4 });
  const committed = commitPress(armed, { layer: 4, pressure: 0.62, sweep: 0.48 });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'pressure arming must not write before the cast is released');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must be geometry-neutral');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.layer, 4);
  assert.notEqual(event.cast, event.layer, 'the hardened cast must be remote');
  assert.notEqual(event.dent, event.layer, 'the underformed dent must be remote');
  assert.notEqual(event.ridge, event.layer, 'the memory ridge must be remote');
  assert.ok(event.distance >= 0.25, 'the cast must be materially displaced');
  assert.equal(layerSignature(committed.scene.layers[event.layer]), layerSignature(baseline.scene.layers[event.layer]), 'the touched band stays exact');
  assert.equal(committed.scene.layers[event.cast].role, 'overcast');
  assert.equal(committed.scene.layers[event.dent].role, 'underformed');
  assert.equal(committed.scene.layers[event.ridge].role, 'memory-ridge');
  assert.ok(committed.scene.trace.changedLayerCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v040 refuses weak or overlong pressure and replays four casts exactly', async () => {
  const {
    MEMORY_WINDOW,
    beginPress,
    buildFrame,
    buildTimeline,
    commitPress,
    geometrySignature,
    liftLatestPress,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginPress(baseline, { layer: 2 });
  const weak = commitPress(armed, { layer: 2, pressure: 0.08, sweep: 0.4 });
  const overlong = commitPress(armed, { layer: 2, pressure: 0.7, sweep: 1.3 });
  assert.equal(weak.memory.length, 0);
  assert.equal(weak.interaction, 'press-refused-light');
  assert.equal(overlong.memory.length, 0);
  assert.equal(overlong.interaction, 'press-refused-wide');
  assert.equal(geometrySignature(weak), geometrySignature(baseline));

  let state = baseline;
  for (const press of buildTimeline()) {
    state = commitPress(beginPress(state, press), press);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const lifted = liftLatestPress(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(state));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const first = buildTimeline()[0];
  const replayed = commitPress(beginPress(buildFrame(), first), first);
  const repeated = commitPress(beginPress(buildFrame(), first), first);
  assert.deepEqual(replayed, repeated);
});

test('Naive v040 is a deterministic pressure-cast tableau with an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v040/index.html',
    'studies/naive-art/v040/engine.mjs',
    'studies/naive-art/v040/sketch.js',
    'studies/naive-art/v040/style.css',
    'studies/naive-art/v040/README.md',
    'studies/naive-art/v040/metrics.json',
    'studies/naive-art/v040/critiques.json',
    'works/naive-2026-10-30/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v040/index.html');
  const sketch = await read('studies/naive-art/v040/sketch.js');
  const style = await read('studies/naive-art/v040/style.css');
  const readme = await read('studies/naive-art/v040/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v040/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v040/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-30');
  const record = records[0];

  assert.match(index, /id="mould-field"/);
  assert.match(index, /data-action="cast"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-30"/);
  assert.match(index, /p5\.js\/1\.11\.3/);
  assert.match(sketch, /beginPress/);
  assert.match(sketch, /commitPress/);
  assert.match(sketch, /createGraphics/);
  assert.match(sketch, /window\.__mutineNaiveV040/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413430');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /relief|mould|cast/i);
  assert.match(metrics.interactionRule, /pressure|sweep|cast/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-30');
  assert.equal(record.rawPath, '/studies/naive-art/v040/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-30');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|material|cast/i);
  assert.ok(record.critiques.length >= 9);
});
