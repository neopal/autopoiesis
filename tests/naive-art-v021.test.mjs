import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v021 turns situated attention into a remembered wrong doorway', async () => {
  const {
    buildFrame,
    commitAttention,
    liftLatestAttention,
    geometrySignature
  } = await import('../studies/naive-art/v021/engine.mjs');

  const baseline = buildFrame(0, []);
  const attended = commitAttention(baseline, { roomIndex: 1 });
  const event = attended.memory.at(-1);
  const source = attended.scene.rooms[event.roomIndex];
  const receiver = attended.scene.rooms[event.receiverIndex];

  assert.equal(baseline.memory.length, 0);
  assert.equal(attended.memory.length, 1);
  assert.equal(event.source, 'situated-attention');
  assert.notEqual(event.roomIndex, event.receiverIndex);
  assert.ok(source.openings.length > 0, 'the attended room must open a real doorway');
  assert.ok(receiver.closures.length > 0, 'a distant room must answer with a blocked doorway');
  assert.ok(attended.scene.trace.topologyChanges >= 2);
  assert.equal(attended.scene.trace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(attended), geometrySignature(baseline));

  const restored = liftLatestAttention(attended);
  assert.equal(restored.interaction, 'attention-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v021 attention is deterministic, bounded, and room-specific', async () => {
  const { buildFrame, commitAttention } = await import('../studies/naive-art/v021/engine.mjs');
  const baseline = buildFrame(4, []);
  const next = commitAttention(baseline, { roomIndex: 2, direction: 1 });
  const repeat = commitAttention(baseline, { roomIndex: 2, direction: 1 });
  const alternate = commitAttention(baseline, { roomIndex: 2, direction: -1 });
  const bounded = commitAttention({ ...baseline, memory: Array(12).fill(next.memory[0]) }, { roomIndex: 2 });

  assert.deepEqual(next, repeat);
  assert.equal(next.memory.at(-1).roomIndex, 2);
  assert.notEqual(next.memory.at(-1).receiverIndex, alternate.memory.at(-1).receiverIndex);
  assert.ok(bounded.memory.length <= 4);
  assert.ok(next.scene.rooms.some((room) => room.openings.length > 0));
  assert.ok(next.scene.rooms.some((room) => room.closures.length > 0));
});

test('Naive v021 exposes a caption-free SVG map and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v021/index.html',
    'studies/naive-art/v021/engine.mjs',
    'studies/naive-art/v021/sketch.js',
    'studies/naive-art/v021/style.css',
    'studies/naive-art/v021/README.md',
    'studies/naive-art/v021/metrics.json',
    'studies/naive-art/v021/critiques.json',
    'works/naive-2026-09-30/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v021/index.html');
  const sketch = await read('studies/naive-art/v021/sketch.js');
  const style = await read('studies/naive-art/v021/style.css');
  const readme = await read('studies/naive-art/v021/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v021/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v021/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-30');
  const record = matches[0];

  assert.match(index, /<svg[^>]+id="map-field"/);
  assert.match(index, /id="attention-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-09-30"/);
  assert.match(sketch, /commitAttention/);
  assert.match(sketch, /liftLatestAttention/);
  assert.match(sketch, /data-opening|room-opening/);
  assert.match(sketch, /keydown|key/);
  assert.match(sketch, /window\.__mutineNaiveV021/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413231');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /doorway|attention|topology/i);
  assert.match(metrics.interactionRule, /attention|room/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-30');
  assert.equal(record.rawPath, '/studies/naive-art/v021/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-30');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /attention|doorway|topology/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /SVG|map|doorway|pressure/i);
});
