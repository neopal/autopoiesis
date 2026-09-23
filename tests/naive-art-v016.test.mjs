import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyDeparture,
  buildTimeline,
  deleteLatestDeparture,
  departureSignature
} = await import('../studies/naive-art/v016/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v016 inverts looking-back: only departure cuts, misplaces, and hollows the field', () => {
  const frame = buildTimeline()[4];
  const changed = applyDeparture(frame, { x: 0.21, y: 0.28 });
  const record = changed.scene.departureRecords.at(-1);
  const source = changed.scene.forms[record.sourceIndex];
  const receiver = changed.scene.forms[record.receiverIndex];
  const hollow = changed.scene.forms[record.hollowIndex];

  assert.equal(changed.memory.at(-1).source, 'visitor-departure');
  assert.equal(record.source, 'visitor-departure');
  assert.notEqual(record.sourceIndex, record.receiverIndex);
  assert.notEqual(record.receiverIndex, record.hollowIndex);
  assert.ok(source.notches.length > 0, 'departure must cut a real notch from the source form');
  assert.ok(receiver.wrongFragments.length > 0, 'departure must move a wrong fragment into a distant form');
  assert.ok(hollow.hollows.length > 0, 'departure must hollow a third form instead of adding a marker');
  assert.equal(changed.scene.materialTrace.presenceChanges, 0, 'proximity alone is refused');
  assert.ok(changed.scene.materialTrace.departureChanges > 0, 'absence must carry the material event');
  assert.notEqual(departureSignature(changed), departureSignature(frame));

  const restored = deleteLatestDeparture(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(departureSignature(restored), departureSignature(frame));
});

test('Naive v016 exposes a caption-free SVG tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v016/index.html',
    'studies/naive-art/v016/sketch.js',
    'studies/naive-art/v016/style.css',
    'studies/naive-art/v016/README.md',
    'studies/naive-art/v016/metrics.json',
    'studies/naive-art/v016/critiques.json',
    'works/naive-2026-09-23/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v016/index.html');
  const sketch = await read('studies/naive-art/v016/sketch.js');
  const style = await read('studies/naive-art/v016/style.css');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-23');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="depart-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<svg[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /applyDeparture/);
  assert.match(sketch, /deleteLatestDeparture/);
  assert.match(sketch, /event\.key === 'Delete'/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /departure/);
  assert.match(sketch, /window\.__mutineNaiveV016/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-23');
  assert.equal(record.rawPath, '/studies/naive-art/v016/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-23');
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.memoryRule, /departure|hollow|wrong fragment/);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matrices passed/);
});
