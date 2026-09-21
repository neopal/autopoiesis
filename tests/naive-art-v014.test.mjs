import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyTear,
  buildTimeline,
  deleteLatestTear,
  tearSignature
} = await import('../studies/naive-art/v014/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v014 turns a retained mistake into a material puncture that re-cuts the scene and undoes exactly', () => {
  const frame = buildTimeline()[1];
  const changed = applyTear(frame, { x: 0.72, y: 0.43 });

  assert.equal(changed.memory.at(-1).source, 'visitor-tear');
  assert.equal(changed.scene.tearRecords.at(-1).source, 'visitor-tear');
  assert.ok(changed.scene.cutouts.length > frame.scene.cutouts.length, 'a tear must create a real cutout');
  assert.ok(changed.scene.fragments.length > frame.scene.fragments.length, 'a tear must recompose displaced fragments');
  assert.ok(changed.scene.house.shift.x !== frame.scene.house.shift.x || changed.scene.house.shift.y !== frame.scene.house.shift.y, 'the house geometry must move around the puncture');
  assert.ok(changed.scene.ground.notches.length > frame.scene.ground.notches.length, 'the ground must carry the same material event');
  assert.notEqual(tearSignature(changed), tearSignature(frame));

  const restored = deleteLatestTear(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(tearSignature(restored), tearSignature(frame));
});

test('Naive v014 exposes a caption-free puncture tableau and a dated daily record', async () => {
  for (const path of [
    'studies/naive-art/v014/index.html',
    'studies/naive-art/v014/sketch.js',
    'studies/naive-art/v014/style.css',
    'studies/naive-art/v014/README.md',
    'studies/naive-art/v014/metrics.json',
    'studies/naive-art/v014/critiques.json',
    'works/naive-2026-09-21/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v014/index.html');
  const sketch = await read('studies/naive-art/v014/sketch.js');
  const style = await read('studies/naive-art/v014/style.css');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-21');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="tear-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyTear/);
  assert.match(sketch, /deleteLatestTear/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /puncture/);
  assert.match(sketch, /window\.__mutineNaiveV014/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-21');
  assert.equal(record.rawPath, '/studies/naive-art/v014/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-21');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /puncture|cut|fragment/);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matri(?:x|ces) passed/);
});
