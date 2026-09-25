import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyFold,
  buildTimeline,
  deleteLatestFold,
  foldSignature
} = await import('../studies/naive-art/v018/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v018 lets a drag misremember a hinge and undo restores the exact sculpture', () => {
  const frame = buildTimeline()[5];
  const changed = applyFold(frame, {
    start: { x: 0.22, y: 0.48 },
    end: { x: 0.82, y: 0.57 },
    distance: 0.60
  });
  const record = changed.scene.foldRecords.at(-1);
  const source = changed.scene.panels[record.sourceIndex];
  const receiver = changed.scene.panels[record.receiverIndex];
  const severed = changed.scene.joints.find((joint) => joint.state === 'unhinged');
  const wrong = changed.scene.joints.find((joint) => joint.state === 'wrong-hinge');

  assert.equal(changed.memory.at(-1).source, 'visitor-drag');
  assert.equal(record.source, 'visitor-drag');
  assert.ok(record.distance >= 0.42, 'the event must require a meaningful drag');
  assert.notEqual(record.sourceIndex, record.receiverIndex);
  assert.ok(source.drift > 0.001, 'the dragged panel must materially drift from its hinge');
  assert.ok(receiver.borrowedMarks.length > 0, 'a distant panel must inherit the wrong mark');
  assert.ok(severed?.gap > 0.01, 'the original joint must open into a visible gap');
  assert.ok(wrong?.bridge > 0.01, 'a distant wrong hinge must become a visible bridge');
  assert.ok(changed.scene.materialTrace.dragChanges > 0);
  assert.ok(changed.scene.materialTrace.pointerOnlyChanges === 0);
  assert.notEqual(foldSignature(changed), foldSignature(frame));

  const restored = deleteLatestFold(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(foldSignature(restored), foldSignature(frame));
});

test('Naive v018 exposes a caption-free hinge tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v018/index.html',
    'studies/naive-art/v018/engine.mjs',
    'studies/naive-art/v018/sketch.js',
    'studies/naive-art/v018/style.css',
    'studies/naive-art/v018/README.md',
    'studies/naive-art/v018/metrics.json',
    'studies/naive-art/v018/critiques.json',
    'works/naive-2026-09-25/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v018/index.html');
  const sketch = await read('studies/naive-art/v018/sketch.js');
  const style = await read('studies/naive-art/v018/style.css');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-25');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="fold-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyFold/);
  assert.match(sketch, /deleteLatestFold/);
  assert.match(sketch, /event\.key === 'Delete'/);
  assert.match(sketch, /hinge/);
  assert.match(sketch, /window\.__mutineNaiveV018/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-25');
  assert.equal(record.rawPath, '/studies/naive-art/v018/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-25');
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.memoryRule, /drag|hinge|wrong|gap/i);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matrices passed/);
});
