import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v041/engine.mjs';

test('Naive v041 arms one word and only a different word can commit a remote misreading', async () => {
  const {
    beginWitness,
    buildFrame,
    commitWitness,
    geometrySignature,
    tokenSignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = beginWitness(baseline, { token: 2 });
  assert.equal(armed.memory.length, 0);
  assert.equal(geometrySignature(armed), geometrySignature(baseline));

  const selfReply = commitWitness(armed, { source: 2, reply: 2 });
  assert.equal(selfReply.memory.length, 0);
  assert.equal(selfReply.interaction, 'witness-refused-self');

  const committed = commitWitness(armed, { source: 2, reply: 10 });
  const event = committed.memory.at(-1);
  assert.equal(committed.memory.length, 1);
  assert.equal(event.source, 2);
  assert.equal(event.reply, 10);
  assert.notEqual(event.misheard, event.source);
  assert.notEqual(event.misheard, event.reply);
  assert.notEqual(event.split, event.source);
  assert.notEqual(event.echo, event.reply);
  assert.ok(event.distance >= 0.24);
  assert.equal(tokenSignature(committed.scene.tokens[event.source]), tokenSignature(baseline.scene.tokens[event.source]));
  assert.equal(tokenSignature(committed.scene.tokens[event.reply]), tokenSignature(baseline.scene.tokens[event.reply]));
  assert.equal(committed.scene.tokens[event.misheard].role, 'misheard');
  assert.equal(committed.scene.tokens[event.split].role, 'split');
  assert.equal(committed.scene.tokens[event.echo].role, 'echo');
  assert.ok(committed.scene.trace.changedTokenCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
});

test('Naive v041 compounds four misheard relations and lifts the last one exactly', async () => {
  const {
    MEMORY_WINDOW,
    beginWitness,
    buildFrame,
    buildTimeline,
    commitWitness,
    geometrySignature,
    liftLatestWitness,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  let state = baseline;
  for (const pair of buildTimeline()) {
    state = commitWitness(beginWitness(state, { token: pair.source }), pair);
  }
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.stage, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);
  assert.ok(state.scene.trace.changedTokenCount >= 3);

  const lifted = liftLatestWitness(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(state));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene);

  const first = buildTimeline()[0];
  const replayed = commitWitness(beginWitness(buildFrame(), { token: first.source }), first);
  const repeated = commitWitness(beginWitness(buildFrame(), { token: first.source }), first);
  assert.deepEqual(replayed, repeated);
});

test('Naive v041 is a deterministic browser-native sentence with an honest daily record', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };

  for (const path of [
    'studies/naive-art/v041/index.html',
    'studies/naive-art/v041/engine.mjs',
    'studies/naive-art/v041/sketch.js',
    'studies/naive-art/v041/style.css',
    'studies/naive-art/v041/README.md',
    'studies/naive-art/v041/metrics.json',
    'studies/naive-art/v041/critiques.json',
    'works/naive-2026-10-31/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v041/index.html');
  const sketch = await read('studies/naive-art/v041/sketch.js');
  const style = await read('studies/naive-art/v041/style.css');
  const readme = await read('studies/naive-art/v041/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v041/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v041/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-31');
  const record = records[0];

  assert.match(index, /id="misread-field"/);
  assert.match(index, /data-action="infer"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-31"/);
  assert.match(sketch, /beginWitness/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /window\.__mutineNaiveV041/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413431');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.representationRupture, /typograph|sentence|word/i);
  assert.match(metrics.interactionRule, /word|witness|reply/i);
  assert.equal(critiques.length, 10);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-31');
  assert.equal(record.rawPath, '/studies/naive-art/v041/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-31');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /word|sentence|witness|reply/i);
  assert.ok(record.critiques.length >= 9);
});
