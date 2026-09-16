import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  applyBridge,
  buildTimeline,
  bridgeSignature,
  deleteLatestBridge
} = await import('../studies/naive-art/v012/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v012 turns a retained mistake into a shared bridge with span, drop, and downstream reunite', () => {
  const frame = buildTimeline()[9];
  const changed = applyBridge(frame, { x: 0.19, y: 0.72 });
  const structuralPoints = [
    changed.scene.house.bridgeLine,
    changed.scene.ground.bridgeLine,
    changed.scene.route
  ].flat();

  assert.equal(changed.memory.at(-1).source, 'visitor-bridge');
  assert.equal(changed.scene.house.bridgeDriven, true);
  assert.ok(changed.scene.bridgeRecords.some((bridge) => bridge.source === 'visitor-bridge'));
  assert.ok(structuralPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  for (const phase of ['approach', 'rise', 'span', 'drop', 'reunite']) {
    assert.ok(changed.scene.route.some((point) => point.phase === phase), `route must expose ${phase}`);
  }
  const span = changed.scene.route.find((point) => point.phase === 'span');
  const approach = changed.scene.route.find((point) => point.phase === 'approach');
  const reunite = changed.scene.route.find((point) => point.phase === 'reunite');
  assert.ok(Math.abs(span.y - approach.y) > 0.02, 'span must leave the baseline');
  assert.ok(Math.abs(reunite.y - approach.y) < 0.08, 'reunite must return near the route');
  assert.notEqual(bridgeSignature(changed), bridgeSignature(frame));

  const restored = deleteLatestBridge(changed);
  assert.deepEqual(restored.scene, frame.scene);
  assert.equal(restored.memory.length, frame.memory.length);
  assert.equal(bridgeSignature(restored), bridgeSignature(frame));
});

test('Naive v012 exposes a bridge tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v012/index.html',
    'studies/naive-art/v012/sketch.js',
    'studies/naive-art/v012/style.css',
    'studies/naive-art/v012/README.md',
    'studies/naive-art/v012/metrics.json',
    'studies/naive-art/v012/critiques.json',
    'works/naive-2026-09-16/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v012/index.html');
  const sketch = await read('studies/naive-art/v012/sketch.js');
  const style = await read('studies/naive-art/v012/style.css');
  const routes = await read('vercel.json');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-16');
  const record = matches[0];

  assert.match(index, /interactive-preview/);
  assert.match(index, /id="bridge-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /<canvas[^>]+id="field"[^>]+tabindex="0"/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /applyBridge/);
  assert.match(sketch, /deleteLatestBridge/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(sketch, /route-bridge/);
  assert.match(sketch, /window\.__mutineNaiveV012/);
  assert.match(style, /html\.preview-mode \.field-wrap\{[^}]*height:100vh/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /html\.preview-mode\.interactive-preview:not\(\.static-mode\) \.field-controls\{display:flex\}/);
  assert.match(routes, /"\/studies\/naive-art\/v012\/"/);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-16');
  assert.equal(record.rawPath, '/studies/naive-art/v012/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-16');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /bridge|span|drop|reunite/);
  assert.match(record.browserEvidence.status, /^local headless browser readback passed/);
});
