import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyBump,
  buildTimeline,
  bumpSignature,
  deleteLatestBump
} = await import('../studies/naive-art/v011/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v011 turns a retained mistake into a shared bump with lift, crest, descent, and downstream return', () => {
  const frame = buildTimeline()[8];
  const changed = applyBump(frame, { x: 0.19, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.bumpLine,
    changed.scene.ground.bumpLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-bump');
  assert.equal(changed.scene.house.bumpDriven, true);
  assert.ok(changed.scene.bumpRecords.some((bump) => bump.source === 'visitor-bump'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (const phase of ['approach', 'lift', 'crest', 'descent', 'return']) {
    assert.ok(changed.scene.route.some((point) => point.phase === phase), `route must expose ${phase}`);
  }
  assert.notEqual(bumpSignature(changed), bumpSignature(frame));

  const restored = deleteLatestBump(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(bumpSignature(restored), bumpSignature(frame));
});

test('Naive v011 exposes a bump tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v011/index.html',
    'studies/naive-art/v011/sketch.js',
    'studies/naive-art/v011/style.css',
    'studies/naive-art/v011/README.md',
    'studies/naive-art/v011/metrics.json',
    'studies/naive-art/v011/critiques.json',
    'works/naive-2026-09-15/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v011/index.html');
  const sketch = await read('studies/naive-art/v011/sketch.js');
  const style = await read('studies/naive-art/v011/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-15');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="bump-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyBump/);
  assert.match(sketch, /deleteLatestBump/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-bump/);
  assert.match(sketch, /window\.__mutineNaiveV011/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v011\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-15');
  assert.equal(record.rawPath, '/studies/naive-art/v011/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-15');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /bump|lift|crest|descent|return/);
  assert.match(record.browserEvidence.status, /^local and stable-alias production headless browser readback passed/);
});
