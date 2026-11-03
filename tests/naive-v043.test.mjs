import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v043/engine.mjs';

test('Naive v043 keeps witnesses exact while a three-attention quorum invents a false centre', async () => {
  const {
    GROUP_SIZE,
    beginSelection,
    buildFrame,
    commitSelection,
    geometrySignature,
    selectWitness,
    witnessSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  let pending = beginSelection(baseline);
  for (const id of [1, 6, 10]) pending = selectWitness(pending, id);
  assert.equal(GROUP_SIZE, 3);
  assert.equal(pending.memory.length, 0);
  assert.equal(pending.pending.length, 3);
  assert.equal(geometrySignature(pending), geometrySignature(baseline));

  const committed = commitSelection(pending);
  const event = committed.memory.at(-1);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'quorum-committed');
  assert.deepEqual(event.witnesses, [1, 6, 10]);
  assert.equal(committed.scene.trace.changedWitnessCount, 0);
  assert.equal(committed.scene.trace.consensusCount, 1);
  for (const id of event.witnesses) {
    assert.equal(witnessSignature(committed.scene.witnesses[id]), witnessSignature(baseline.scene.witnesses[id]));
  }
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v043 refuses incomplete or repeated attention and compounds four false centres', async () => {
  const {
    MEMORY_WINDOW,
    beginSelection,
    buildFrame,
    buildTimeline,
    commitSelection,
    liftLatestSelection,
    selectWitness,
    releaseMemory
  } = await import(engineUrl);

  let state = buildFrame();
  state = selectWitness(selectWitness(beginSelection(state), 2), 2);
  const refused = commitSelection(state);
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'quorum-refused-incomplete');
  assert.equal(refused.pending.length, 1);

  state = buildFrame();
  for (const witnesses of buildTimeline()) {
    let next = beginSelection(state);
    for (const id of witnesses) next = selectWitness(next, id);
    state = commitSelection(next);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.equal(state.scene.trace.consensusCount, MEMORY_WINDOW);

  const lifted = liftLatestSelection(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(lifted.scene.trace.consensusCount, state.scene.trace.consensusCount);
  assert.deepEqual(releaseMemory(lifted).scene, buildFrame().scene);
});

test('Naive v043 is deterministic, canvas-based, and wired to the daily record', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };

  for (const path of [
    'studies/naive-art/v043/index.html',
    'studies/naive-art/v043/engine.mjs',
    'studies/naive-art/v043/sketch.js',
    'studies/naive-art/v043/style.css',
    'studies/naive-art/v043/README.md',
    'studies/naive-art/v043/metrics.json',
    'studies/naive-art/v043/critiques.json',
    'works/naive-2026-11-03/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v043/index.html');
  const sketch = await read('studies/naive-art/v043/sketch.js');
  const style = await read('studies/naive-art/v043/style.css');
  const readme = await read('studies/naive-art/v043/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v043/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v043/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-03');
  const record = records[0];

  assert.match(index, /id="false-centre"/);
  assert.match(index, /data-action="ask"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-11-03"/);
  assert.match(sketch, /selectWitness/);
  assert.match(sketch, /commitSelection/);
  assert.match(sketch, /window\.__mutineNaiveV043/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413433');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /canvas|contour|centre/i);
  assert.match(metrics.interactionRule, /three|quorum|witness/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-11-03');
  assert.equal(record.rawPath, '/studies/naive-art/v043/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-11-03');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /attention|witness|centre|quorum/i);
  assert.ok(record.critiques.length >= 9);
});
