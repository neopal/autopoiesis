import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyKnot,
  buildFrame,
  buildTimeline,
  deleteLatestKnot,
  knotSignature
} = await import('../studies/naive-art/v008/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v008 makes a retained mistake cross, loop, and rejoin three drawing lanes', () => {
  const frame = buildTimeline()[8];
  const changed = applyKnot(frame, { x: 0.18, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.knotLine,
    changed.scene.ground.knotLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-knot');
  assert.equal(changed.scene.house.knotDriven, true);
  assert.ok(changed.scene.knotRecords.some((knot) => knot.source === 'visitor-knot'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  assert.ok(changed.scene.route.some((point) => point.phase === 'cross'));
  assert.ok(changed.scene.route.some((point) => point.phase === 'loop'));
  assert.ok(changed.scene.route.some((point) => point.phase === 'rejoin'));
  assert.notEqual(knotSignature(changed), knotSignature(frame));

  const restored = deleteLatestKnot(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(knotSignature(restored), knotSignature(frame));
});

test('Naive v008 exposes its canvas interaction, preview mode, and daily archive record', async () => {
  for (const path of [
    'studies/naive-art/v008/index.html',
    'studies/naive-art/v008/sketch.js',
    'studies/naive-art/v008/style.css',
    'studies/naive-art/v008/README.md',
    'studies/naive-art/v008/metrics.json',
    'studies/naive-art/v008/critiques.json',
    'works/naive-2026-09-12/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v008/index.html');
  const sketch = await read('studies/naive-art/v008/sketch.js');
  const style = await read('studies/naive-art/v008/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-12');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="knot-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyKnot/);
  assert.match(sketch, /deleteLatestKnot/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-knot/);
  assert.match(sketch, /window\.__mutineNaiveV008/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v008\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-12');
  assert.equal(record.rawPath, '/studies/naive-art/v008/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-12');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /knot|cross|rejoin/);
  assert.equal(record.metrics.browserEvidence.status, 'local headless browser matrix passed / held for independent caption-free perceptual review and production readback');
  assert.equal(record.metrics.browserEvidence.viewportMatrix, '10/10 local headless runs passed at 320x568, 390x844, 768x1024, 1280x800, and 1920x1080 in normal and reduced-motion modes');
});