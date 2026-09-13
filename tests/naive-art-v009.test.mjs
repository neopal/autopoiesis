import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyDoorway,
  buildFrame,
  buildTimeline,
  deleteLatestDoorway,
  doorwaySignature
} = await import('../studies/naive-art/v009/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v009 turns a retained mistake into a shared doorway threshold', () => {
  const frame = buildTimeline()[9];
  const changed = applyDoorway(frame, { x: 0.18, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.doorLine,
    changed.scene.ground.doorLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-doorway');
  assert.equal(changed.scene.house.doorDriven, true);
  assert.ok(changed.scene.doorRecords.some((door) => door.source === 'visitor-doorway'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (const phase of ['approach', 'threshold', 'inside', 'exit']) {
    assert.ok(changed.scene.route.some((point) => point.phase === phase), `route must expose ${phase}`);
  }
  assert.notEqual(doorwaySignature(changed), doorwaySignature(frame));

  const restored = deleteLatestDoorway(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(doorwaySignature(restored), doorwaySignature(frame));
});

test('Naive v009 exposes the doorway tableau, deterministic interaction, and daily archive record', async () => {
  for (const path of [
    'studies/naive-art/v009/index.html',
    'studies/naive-art/v009/sketch.js',
    'studies/naive-art/v009/style.css',
    'studies/naive-art/v009/README.md',
    'studies/naive-art/v009/metrics.json',
    'studies/naive-art/v009/critiques.json',
    'works/naive-2026-09-13/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v009/index.html');
  const sketch = await read('studies/naive-art/v009/sketch.js');
  const style = await read('studies/naive-art/v009/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-13');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="doorway-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyDoorway/);
  assert.match(sketch, /deleteLatestDoorway/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-doorway/);
  assert.match(sketch, /window\.\__mutineNaiveV009/);
  assert.match(sketch, /let started = performance\.now\(\);/);
  assert.doesNotMatch(sketch, /state === 'visitor-doorway' \? 'VISITOR DOORWAY \/ PAUSED'/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v009\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-13');
  assert.equal(record.rawPath, '/studies/naive-art/v009/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-13');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /door|threshold|inside|exit/);
  assert.equal(record.metrics.browserEvidence.status, 'local and stable-alias headless browser readback passed / held for independent caption-free perceptual review and provider revision verification');
  assert.equal(record.metrics.promotion, 'candidate / held pending independent caption-free perceptual review and provider revision verification');
});
