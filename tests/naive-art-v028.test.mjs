import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/naive-art/v028/engine.mjs';

test('Naive v028 makes attention structural only when the visitor leaves after a long look', async () => {
  const {
    buildFrame,
    observe,
    commitObservation,
    geometrySignature
  } = await import(engineUrl);

  const baseline = buildFrame();
  const armed = observe(baseline, 2);
  const refused = commitObservation(armed, { index: 2, duration: 120, departed: true });
  const committed = commitObservation(armed, { index: 2, duration: 800, departed: true });
  const event = committed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'looking must arm without writing memory');
  assert.equal(geometrySignature(armed), geometrySignature(baseline), 'arming must not alter the tableau');
  assert.equal(refused.memory.length, 0, 'a short look must be refused');
  assert.equal(refused.interaction, 'observation-refused-short');
  assert.equal(committed.memory.length, 1);
  assert.equal(event.source, 2);
  assert.notEqual(event.wrong, event.source, 'the picture must misplace attention remotely');
  assert.notEqual(event.echo, event.source, 'the error must carry a non-local reply');
  assert.notEqual(event.gap, event.source, 'the missing place must migrate away from the source');
  assert.ok(committed.scene.trace.changedMarkCount >= 3);
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.equal(committed.scene.marks[event.source].role, 'vacated');
  assert.equal(committed.scene.marks[event.wrong].role, 'misheard');
  assert.equal(committed.scene.marks[event.echo].role, 'echo');
});

test('Naive v028 keeps only four mishearings and can reconstruct the exact preceding strip', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    buildTimeline,
    commitObservation,
    geometrySignature,
    liftLatestObservation,
    releaseMemory
  } = await import(engineUrl);

  const baseline = buildFrame();
  let state = baseline;
  for (const observation of buildTimeline().observations) state = commitObservation(state, observation);
  assert.equal(state.memory.length, MEMORY_WINDOW);
  assert.equal(state.scene.trace.memoryCount, MEMORY_WINDOW);

  const beforeLift = state;
  const lifted = liftLatestObservation(state);
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(beforeLift));
  assert.deepEqual(releaseMemory(lifted).scene, baseline.scene, 'release must return to the seeded strip');

  const replayed = commitObservation(buildFrame(), buildTimeline().observations[0]);
  assert.deepEqual(replayed, commitObservation(buildFrame(), buildTimeline().observations[0]));
});

test('Naive v028 is a semantic mark strip with a real browser adapter and honest evidence files', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const exists = async (path) => {
    try { await access(new URL(`../${path}`, import.meta.url)); return true; }
    catch { return false; }
  };
  for (const path of [
    'studies/naive-art/v028/index.html',
    'studies/naive-art/v028/sketch.js',
    'studies/naive-art/v028/style.css',
    'studies/naive-art/v028/README.md',
    'studies/naive-art/v028/metrics.json',
    'studies/naive-art/v028/critiques.json',
    'works/naive-2026-10-10/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await readFile(new URL('../studies/naive-art/v028/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../studies/naive-art/v028/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/naive-art/v028/style.css', import.meta.url), 'utf8');
  const readme = await readFile(new URL('../studies/naive-art/v028/README.md', import.meta.url), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('../studies/naive-art/v028/metrics.json', import.meta.url), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('../studies/naive-art/v028/critiques.json', import.meta.url), 'utf8'));
  const works = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const records = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-10');
  const record = records[0];

  assert.match(index, /id="mishear-field"/);
  assert.match(index, /data-action="mishear"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-10"/);
  assert.match(sketch, /pointerenter/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /commitObservation/);
  assert.match(sketch, /window\.__mutineNaiveV028/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413238');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(record?.metrics?.settledChangedMarkCount, 11);
  assert.match(record?.browserEvidence?.status ?? '', /production/i);
  assert.match(metrics.representationRupture, /semantic|mark|DOM/i);
  assert.match(metrics.interactionRule, /depart|look|pointer/i);
  assert.equal(critiques.length, 6);
  assert.equal(records.length, 1);
  assert.equal(record.id, 'naive-2026-10-10');
  assert.equal(record.rawPath, '/studies/naive-art/v028/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-10');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /departure|attention|gap/i);
  assert.ok(record.critiques.length >= 6);
});