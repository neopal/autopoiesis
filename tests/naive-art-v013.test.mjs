import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyFork,
  buildTimeline,
  deleteLatestFork,
  forkSignature
} = await import('../studies/naive-art/v013/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v013 turns a retained mistake into a shared fork with twin paths and a downstream merge', () => {
  const frame = buildTimeline()[10];
  const changed = applyFork(frame, { x: 0.23, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.forkLine,
    changed.scene.ground.forkLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-fork');
  assert.equal(changed.scene.house.forkDriven, true);
  assert.ok(changed.scene.forkRecords.some((fork) => fork.source === 'visitor-fork'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (const phase of ['approach', 'split', 'upper', 'lower', 'merge', 'leave']) {
    assert.ok(changed.scene.route.some((point) => point.phase === phase), `route must expose ${phase}`);
  }
  const split = changed.scene.route.find((point) => point.phase === 'split');
  const upper = changed.scene.route.find((point) => point.phase === 'upper');
  const lower = changed.scene.route.find((point) => point.phase === 'lower');
  const merge = changed.scene.route.find((point) => point.phase === 'merge');
  assert.ok(Math.abs(upper.y - lower.y) > 0.03, 'fork must carry two separated paths');
  assert.ok(Math.abs(merge.y - split.y) < 0.16, 'merge must return toward the split level');
  assert.notEqual(forkSignature(changed), forkSignature(frame));

  const restored = deleteLatestFork(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(forkSignature(restored), forkSignature(frame));
});

test('Naive v013 exposes a fork tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v013/index.html',
    'studies/naive-art/v013/sketch.js',
    'studies/naive-art/v013/style.css',
    'studies/naive-art/v013/README.md',
    'studies/naive-art/v013/metrics.json',
    'studies/naive-art/v013/critiques.json',
    'works/naive-2026-09-17/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v013/index.html');
  const sketch = await read('studies/naive-art/v013/sketch.js');
  const style = await read('studies/naive-art/v013/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-17');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="fork-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyFork/);
  assert.match(sketch, /deleteLatestFork/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-fork/);
  assert.match(sketch, /window\.__mutineNaiveV013/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v013\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-17');
  assert.equal(record.rawPath, '/studies/naive-art/v013/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-17');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /fork|split|merge/);
  assert.match(record.browserEvidence.status, /^local and production headless browser matrices passed/);
});
