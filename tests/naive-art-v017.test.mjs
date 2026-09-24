import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyAttention,
  attentionSignature,
  buildTimeline,
  deleteLatestAttention
} = await import('../studies/naive-art/v017/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v017 makes sustained presence misaddress one assembled pile and undo restores it exactly', () => {
  const frame = buildTimeline()[6];
  const changed = applyAttention(frame, { x: 0.21, y: 0.45 });
  const record = changed.scene.attentionRecords.at(-1);
  const target = changed.scene.blocks[record.targetIndex];
  const receiver = changed.scene.blocks[record.receiverIndex];
  const support = changed.scene.blocks[record.supportIndex];

  assert.equal(changed.memory.at(-1).source, 'visitor-attention');
  assert.equal(record.source, 'visitor-attention');
  assert.notEqual(record.targetIndex, record.receiverIndex);
  assert.notEqual(record.receiverIndex, record.supportIndex);
  assert.ok(record.dwell >= 0.6, 'the event must require sustained presence');
  assert.ok(target.falseFaces.length > 0, 'the addressed block must carry a real false face');
  assert.ok(receiver.inheritedFaces.length > 0, 'a distant block must inherit the wrong identity');
  assert.ok(Math.abs(support.shift.x) > 0.001 || Math.abs(support.shift.y) > 0.001, 'the pile support must materially rebalance');
  assert.ok(changed.scene.gaps.length > 0, 'the rebalanced pile must expose a real gap');
  assert.equal(changed.scene.materialTrace.immediatePresenceChanges, 0, 'proximity alone is only an armed witness');
  assert.ok(changed.scene.materialTrace.sustainedAttentionChanges > 0, 'held presence must carry the material event');
  assert.notEqual(attentionSignature(changed), attentionSignature(frame));

  const restored = deleteLatestAttention(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(attentionSignature(restored), attentionSignature(frame));
});

test('Naive v017 exposes a caption-free canvas tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v017/index.html',
    'studies/naive-art/v017/engine.mjs',
    'studies/naive-art/v017/sketch.js',
    'studies/naive-art/v017/style.css',
    'studies/naive-art/v017/README.md',
    'studies/naive-art/v017/metrics.json',
    'studies/naive-art/v017/critiques.json',
    'works/naive-2026-09-24/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v017/index.html');
  const sketch = await read('studies/naive-art/v017/sketch.js');
  const style = await read('studies/naive-art/v017/style.css');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-24');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="attention-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.doesNotMatch(sketch, /if \(staticPreview \|\| committedHold\) return;/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /deleteLatestAttention/);
  assert.match(sketch, /event\.key === 'Delete'/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'/);
  assert.match(sketch, /misaddress/);
  assert.match(sketch, /window\.__mutineNaiveV017/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-24');
  assert.equal(record.rawPath, '/studies/naive-art/v017/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-24');
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.memoryRule, /sustained|false face|gap|misaddress/i);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matrices passed/);
});
