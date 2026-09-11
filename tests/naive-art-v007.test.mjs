import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v007 production surfaces exist before its daily record is published', async () => {
  for (const path of [
    'studies/naive-art/v007/index.html',
    'studies/naive-art/v007/sketch.js',
    'studies/naive-art/v007/engine.mjs',
    'studies/naive-art/v007/style.css',
    'studies/naive-art/v007/README.md',
    'studies/naive-art/v007/metrics.json',
    'studies/naive-art/v007/critiques.json',
    'works/naive-2026-09-11/index.html'
  ]) {
    assert.equal(await exists(path), true, `${path} must exist`);
  }
});

test('Naive v007 turns a retained mistake into finite structural shadows and undoes exactly', async () => {
  const { applyShadow, buildTimeline, deleteLatestShadow, routeSignature } = await import('../studies/naive-art/v007/engine.mjs');
  const frame = buildTimeline()[8];
  const changed = applyShadow(frame, { x: 0.18, y: 0.72 });
  const allPoints = [changed.scene.route, changed.scene.house.shadows, changed.scene.ground.shadows].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-shadow');
  assert.ok(changed.scene.shadowRecords.some((shadow) => shadow.source === 'visitor-shadow'));
  assert.ok(allPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.ok(changed.scene.route.some((point) => point.phase === 'parallel'));
  assert.ok(changed.scene.route.some((point) => point.phase === 'fuse'));
  assert.notEqual(routeSignature(changed), routeSignature(frame));

  const restored = deleteLatestShadow(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(routeSignature(restored), routeSignature(frame));
});

test('Naive v007 tableau exposes structural interaction and preview-safe settling', async () => {
  const index = await read('studies/naive-art/v007/index.html');
  const sketch = await read('studies/naive-art/v007/sketch.js');
  const style = await read('studies/naive-art/v007/style.css');

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="shadow-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyShadow/);
  assert.match(sketch, /deleteLatestShadow/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-echo/);
  assert.match(sketch, /window\.__mutineNaiveV007/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
});

test('Naive v007 is recorded exactly once as the 2026-09-11 daily work', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-11');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'naive-2026-09-11');
  assert.equal(record.rawPath, '/studies/naive-art/v007/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-11');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /companion|shadow/);
  assert.equal(await read('studies/naive-art/v007/README.md').then(Boolean), true);
  assert.equal(await read('works/naive-2026-09-11/index.html').then(Boolean), true);
});
