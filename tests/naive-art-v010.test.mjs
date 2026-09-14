import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyBypass,
  buildTimeline,
  bypassSignature,
  deleteLatestBypass
} = await import('../studies/naive-art/v010/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v010 turns a retained mistake into a shared bypass with side lane and downstream return', () => {
  const frame = buildTimeline()[9];
  const changed = applyBypass(frame, { x: 0.18, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.bypassLine,
    changed.scene.ground.bypassLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-bypass');
  assert.equal(changed.scene.house.bypassDriven, true);
  assert.ok(changed.scene.bypassRecords.some((bypass) => bypass.source === 'visitor-bypass'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (const phase of ['approach', 'sidestep', 'alongside', 'return']) {
    assert.ok(changed.scene.route.some((point) => point.phase === phase), `route must expose ${phase}`);
  }
  assert.notEqual(bypassSignature(changed), bypassSignature(frame));

  const restored = deleteLatestBypass(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(bypassSignature(restored), bypassSignature(frame));
});

test('Naive v010 exposes a bypass tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v010/index.html',
    'studies/naive-art/v010/sketch.js',
    'studies/naive-art/v010/style.css',
    'studies/naive-art/v010/README.md',
    'studies/naive-art/v010/metrics.json',
    'studies/naive-art/v010/critiques.json',
    'works/naive-2026-09-14/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v010/index.html');
  const sketch = await read('studies/naive-art/v010/sketch.js');
  const style = await read('studies/naive-art/v010/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-14');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="bypass-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyBypass/);
  assert.match(sketch, /deleteLatestBypass/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-bypass/);
  assert.match(sketch, /window\.__mutineNaiveV010/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v010\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-14');
  assert.equal(record.rawPath, '/studies/naive-art/v010/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-14');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /bypass|sidestep|alongside|return/);
  assert.equal(record.metrics.browserEvidence.status, 'local headless browser readback passed / held for independent caption-free perceptual review and provider revision verification');
});
