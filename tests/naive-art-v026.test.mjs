import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v026/engine.mjs';

test('Naive v026 turns focused attention into a non-local miscount, not a cosmetic selection', async () => {
  const {
    buildFrame,
    geometrySignature,
    selectWitness,
    commitMiscount,
    liftLatestMiscount
  } = await import(engineUrl);

  const baseline = buildFrame(0, []);
  const selected = selectWitness(baseline, 3);
  const committed = commitMiscount(selected);
  const event = committed.memory.at(-1);

  assert.equal(baseline.memory.length, 0);
  assert.equal(selected.memory.length, 0, 'selection must not write history');
  assert.equal(selected.selected, 3);
  assert.equal(committed.memory.length, 1);
  assert.equal(event.source, 'miscounted-attention');
  assert.notEqual(event.selected, event.counted);
  assert.notEqual(event.counted, event.echo);
  assert.ok(event.changedWitnesses.length >= 3, 'one attention event must alter a distributed trio');
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.notEqual(
    committed.scene.witnesses[event.selected].path,
    baseline.scene.witnesses[event.selected].path,
    'the attended witness must change actual SVG geometry'
  );
  assert.notEqual(
    committed.scene.witnesses[event.counted].path,
    baseline.scene.witnesses[event.counted].path,
    'the wrongly counted witness must change actual SVG geometry'
  );
  assert.notEqual(
    committed.scene.witnesses[event.echo].path,
    baseline.scene.witnesses[event.echo].path,
    'a third witness must carry the geometric echo'
  );

  const restored = liftLatestMiscount(committed);
  assert.equal(restored.interaction, 'miscount-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v026 keeps attention memory deterministic and bounded', async () => {
  const { MEMORY_WINDOW, buildFrame, buildTimeline, selectWitness, commitMiscount, releaseMemory } = await import(engineUrl);
  const baseline = buildFrame(2, []);
  const next = commitMiscount(selectWitness(baseline, 2));
  const repeat = commitMiscount(selectWitness(baseline, 2));
  const alternate = commitMiscount(selectWitness(baseline, 6));
  const bounded = commitMiscount({ ...baseline, memory: Array(9).fill(next.memory[0]) });

  assert.deepEqual(next, repeat);
  assert.notEqual(next.memory.at(-1).counted, alternate.memory.at(-1).counted);
  assert.ok(bounded.memory.length <= MEMORY_WINDOW);
  assert.equal(buildTimeline().at(-1).memory.length, MEMORY_WINDOW);
  assert.equal(buildTimeline().at(-1).scene.witnesses.length, 9);
  assert.deepEqual(releaseMemory().scene, buildFrame(0, []).scene);
});

test('Naive v026 exposes keyboard witness attention, SVG tableau, and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v026/index.html',
    'studies/naive-art/v026/engine.mjs',
    'studies/naive-art/v026/sketch.js',
    'studies/naive-art/v026/style.css',
    'studies/naive-art/v026/README.md',
    'studies/naive-art/v026/metrics.json',
    'studies/naive-art/v026/critiques.json',
    'works/naive-2026-10-08/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v026/index.html');
  const sketch = await read('studies/naive-art/v026/sketch.js');
  const style = await read('studies/naive-art/v026/style.css');
  const readme = await read('studies/naive-art/v026/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v026/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v026/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-08');
  const record = matches[0];

  assert.match(index, /id="miscount-field"/);
  assert.match(index, /data-gesture="commit"/);
  assert.match(index, /data-gesture="undo"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-08"/);
  assert.match(index, /<svg/);
  assert.match(sketch, /selectWitness/);
  assert.match(sketch, /commitMiscount/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /window\.__mutineNaiveV026/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413236');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /miscount|witness|attention/i);
  assert.match(metrics.interactionRule, /focus|keyboard|Enter|Space/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-08');
  assert.equal(record.rawPath, '/studies/naive-art/v026/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-08');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /attention|miscount|witness/i);
  assert.ok(record.critiques.length >= 5);
  assert.match(record.metrics.representationRupture, /SVG|witness|absence/i);
});
