import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v024 turns an approach-departure into a remembered shadow misread', async () => {
  const {
    buildFrame,
    commitMisread,
    geometrySignature,
    liftLatestMisread
  } = await import('../studies/naive-art/v024/engine.mjs');

  const baseline = buildFrame(0, []);
  const misread = commitMisread(baseline, { focusIndex: 2 });
  const event = misread.memory.at(-1);
  const focused = misread.scene.planes[event.focusIndex];
  const remote = misread.scene.planes[event.replyIndex];

  assert.equal(baseline.memory.length, 0);
  assert.equal(misread.memory.length, 1);
  assert.equal(event.source, 'approach-departure-shadow');
  assert.notEqual(event.focusIndex, event.replyIndex);
  assert.notEqual(event.beforeDepth, event.afterDepth, 'departure must change the approached plane depth');
  assert.notEqual(event.beforeHinge, event.afterHinge, 'departure must change the approached plane hinge');
  assert.equal(focused.depth, event.afterDepth);
  assert.equal(focused.hinge, event.afterHinge);
  assert.notEqual(remote.shadowOffset, 0, 'a distant plane must inherit a real shadow displacement');
  assert.equal(misread.scene.trace.shadowMisreadCount, 1);
  assert.equal(misread.scene.trace.changedPlaneCount, 2);
  assert.equal(misread.scene.trace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(misread), geometrySignature(baseline));

  const restored = liftLatestMisread(misread);
  assert.equal(restored.interaction, 'misread-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v024 keeps shadow memory deterministic and bounded', async () => {
  const { buildFrame, buildTimeline, commitMisread } = await import('../studies/naive-art/v024/engine.mjs');
  const baseline = buildFrame(2, []);
  const next = commitMisread(baseline, { focusIndex: 5 });
  const repeat = commitMisread(baseline, { focusIndex: 5 });
  const alternate = commitMisread(baseline, { focusIndex: 7 });
  const bounded = commitMisread({ ...baseline, memory: Array(9).fill(next.memory[0]) }, { focusIndex: 5 });

  assert.deepEqual(next, repeat);
  assert.notEqual(next.memory.at(-1).replyIndex, alternate.memory.at(-1).replyIndex);
  assert.ok(bounded.memory.length <= 4);
  assert.ok(next.scene.planes.some((plane) => plane.depth !== plane.baseDepth || plane.hinge !== plane.baseHinge));
  assert.ok(next.scene.trace.shadowOffsetTotal > 0);

  const settled = buildTimeline().at(-1);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.scene.trace.shadowMisreadCount, 4);
  assert.ok(settled.scene.trace.changedPlaneCount >= 4);
  assert.ok(settled.scene.planes.every((plane) => Number.isFinite(plane.depth) && Number.isFinite(plane.hinge)));
});

test('Naive v024 exposes a p5 WebGL tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v024/index.html',
    'studies/naive-art/v024/engine.mjs',
    'studies/naive-art/v024/sketch.js',
    'studies/naive-art/v024/style.css',
    'studies/naive-art/v024/README.md',
    'studies/naive-art/v024/metrics.json',
    'studies/naive-art/v024/critiques.json',
    'works/naive-2026-10-04/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v024/index.html');
  const sketch = await read('studies/naive-art/v024/sketch.js');
  const style = await read('studies/naive-art/v024/style.css');
  const readme = await read('studies/naive-art/v024/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v024/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v024/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-04');
  const record = matches[0];

  assert.match(index, /id="naive-theatre"/);
  assert.match(index, /id="misread-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-04"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /commitMisread/);
  assert.match(sketch, /pointerleave|pointerout/);
  assert.match(sketch, /window\.__mutineNaiveV024/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413234');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /shadow|hinge|depth/i);
  assert.match(metrics.interactionRule, /approach|departure|keyboard/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-04');
  assert.equal(record.rawPath, '/studies/naive-art/v024/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-04');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /shadow|attention|hinge|depth/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /WebGL|theatre|depth|object/i);
});
