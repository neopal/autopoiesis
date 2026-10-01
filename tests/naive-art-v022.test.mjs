import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v022 turns a dragged cut-out into a real wrong slot and reflow', async () => {
  const {
    buildFrame,
    commitMisread,
    liftLatestMisread,
    geometrySignature
  } = await import('../studies/naive-art/v022/engine.mjs');

  const baseline = buildFrame(0, []);
  const moved = commitMisread(baseline, { sourceIndex: 1, targetIndex: 7 });
  const event = moved.memory.at(-1);
  const source = moved.scene.pieces.find((piece) => piece.id === event.sourcePieceId);
  const displaced = moved.scene.pieces.find((piece) => piece.id === event.displacedPieceId);

  assert.equal(baseline.memory.length, 0);
  assert.equal(moved.memory.length, 1);
  assert.equal(event.source, 'dragged-misread');
  assert.notEqual(event.sourceIndex, event.targetIndex);
  assert.equal(source.slotIndex, event.targetIndex, 'the dragged cut-out must occupy the wrong slot');
  assert.equal(displaced.railIndex, 0, 'the original occupant must be displaced into the actual margin');
  assert.equal(moved.scene.slots[event.sourceIndex], null, 'the source slot must remain visibly vacant');
  assert.ok(moved.scene.trace.layoutChanges >= 3);
  assert.equal(moved.scene.trace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(moved), geometrySignature(baseline));

  const restored = liftLatestMisread(moved);
  assert.equal(restored.interaction, 'misread-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v022 reflow is deterministic and bounded', async () => {
  const { buildFrame, buildTimeline, commitMisread } = await import('../studies/naive-art/v022/engine.mjs');
  const baseline = buildFrame(3, []);
  const next = commitMisread(baseline, { sourceIndex: 2, targetIndex: 8 });
  const repeat = commitMisread(baseline, { sourceIndex: 2, targetIndex: 8 });
  const alternate = commitMisread(baseline, { sourceIndex: 2, targetIndex: 6 });
  const bounded = commitMisread({ ...baseline, memory: Array(9).fill(next.memory[0]) }, { sourceIndex: 2, targetIndex: 8 });

  assert.deepEqual(next, repeat);
  assert.equal(next.memory.at(-1).sourceIndex, 2);
  assert.notEqual(next.memory.at(-1).targetIndex, alternate.memory.at(-1).targetIndex);
  assert.ok(bounded.memory.length <= 4);
  assert.ok(next.scene.slots.some((slot) => slot === null));
  assert.ok(next.scene.pieces.some((piece) => piece.railIndex !== null));
  assert.equal(new Set(next.scene.slots.filter(Boolean)).size, next.scene.slots.filter(Boolean).length);
  assert.ok(next.scene.trace.vacancyCount <= 4);
  const settled = buildTimeline().at(-1);
  assert.equal(new Set(settled.scene.slots.filter(Boolean)).size, settled.scene.slots.filter(Boolean).length);
  assert.equal(settled.scene.trace.vacancyCount, 4);
});

test('Naive v022 exposes a caption-free DOM tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v022/index.html',
    'studies/naive-art/v022/engine.mjs',
    'studies/naive-art/v022/sketch.js',
    'studies/naive-art/v022/style.css',
    'studies/naive-art/v022/README.md',
    'studies/naive-art/v022/metrics.json',
    'studies/naive-art/v022/critiques.json',
    'works/naive-2026-10-01/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v022/index.html');
  const sketch = await read('studies/naive-art/v022/sketch.js');
  const style = await read('studies/naive-art/v022/style.css');
  const readme = await read('studies/naive-art/v022/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v022/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v022/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-01');
  const record = matches[0];

  assert.match(index, /id="misfile-field"/);
  assert.match(index, /id="misfile-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-01"/);
  assert.match(sketch, /commitMisread/);
  assert.match(sketch, /liftLatestMisread/);
  assert.match(sketch, /pointerup|pointerdown/);
  assert.match(sketch, /window\.__mutineNaiveV022/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413232');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /slot|reflow|misread/i);
  assert.match(metrics.interactionRule, /drag|slot/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-01');
  assert.equal(record.rawPath, '/studies/naive-art/v022/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-01');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|slot|reflow/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /DOM|slot|reflow/i);
});
