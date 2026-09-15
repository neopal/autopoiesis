import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applyFork,
  buildFrame,
  buildTimeline,
  deleteLatestFork,
  geometrySignature
} = await import('../studies/self-portrait/v010/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

test('portrait v010 turns a remembered decision into a reversible fork with changed body geometry', () => {
  const baseline = buildFrame(8);
  const changed = applyFork(baseline, { x: 0.78, y: 0.4 });
  const restored = deleteLatestFork(changed);
  const route = changed.forkRoutes[0];

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.forkRoutes.length, 1);
  assert.equal(route.trunk.length, 15);
  assert.equal(route.branches.length, 2);
  assert.ok(route.branches.every((branch) => branch.length === 21));
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 14);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-fork');
  assert.ok(route.branchSeparation > 0.03);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the fork must restore the exact prior field');
});

test('portrait v010 makes the fork legible as one trunk, two lanes, and one downstream resolution', () => {
  let frame = buildFrame(5);
  frame = applyFork(frame, { x: 0.2, y: 0.32 });
  frame = applyFork(frame, { x: 0.78, y: 0.64 });

  assert.equal(frame.memory.length, 2);
  assert.ok(frame.forkRoutes.every((route) => samePoint(route.trunk.at(-1), route.split)));
  assert.ok(frame.forkRoutes.every((route) => route.branches.every((branch) => samePoint(branch[0], route.split))));
  assert.ok(frame.forkRoutes.every((route) => route.branches.every((branch) => samePoint(branch.at(-1), route.merge))));
  assert.ok(frame.forkRoutes.every((route) => route.leftAnchorIndex !== route.rightAnchorIndex));
  assert.ok(frame.forkRoutes.every((route) => route.leftWaypoint.x !== route.rightWaypoint.x));
  assert.ok(frame.forkRoutes.every((route) => route.resolution.length >= 9));
  assert.ok(frame.forkRoutes.every((route) => samePoint(route.resolution[0], route.merge)));
  assert.ok(frame.forkRoutes.every((route) => route.branchSeparation > 0.03));
});

test('portrait v010 bounds fork placement, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(5);
  const first = applyFork(baseline, { x: 2, y: -1 });
  const repeated = applyFork(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyFork(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v010 timeline accumulates four structural forks by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.forkRoutes.length, MEMORY_LIMIT);
  assert.ok(settled.forkRoutes.every((route) => route.branches.length === 2));
  assert.ok(settled.forkRoutes.every((route) => route.resolution.length >= 9));
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v010 tableau is first, preview-safe, and exposes reversible fork memory', async () => {
  const html = await read('studies/self-portrait/v010/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-15"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="fork"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /fork|branch|lane/i);
});

test('portrait v010 runtime binds pointer and keyboard to structural fork memory', async () => {
  const sketch = await read('studies/self-portrait/v010/sketch.js');
  const style = await read('studies/self-portrait/v010/style.css');

  assert.match(sketch, /applyFork/);
  assert.match(sketch, /deleteLatestFork/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawForkRoutes/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /const blindMode = params\.get\('blind'\) === '1'/);
  assert.match(sketch, /if \(blindMode\) return/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v010 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/self-portrait/v010/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v010/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v010/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('fork'));
  assert.ok(metrics.interactionRule.includes('trunk'));
  assert.equal(critiques.length, 4);
});

test('portrait v010 is the unique 2026-09-15 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-15');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-15');
  assert.equal(work.rawPath, '/studies/self-portrait/v010/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-15');
  assert.equal(work.decision.lineage, 'portrait-2026-09-14');

  const canonical = await readFile(new URL('works/portrait-2026-09-15/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-15"/);
});

test('portrait v010 frozen readback reports the settled frame it renders', async () => {
  const sketch = await read('studies/self-portrait/v010/sketch.js');

  assert.match(sketch, /interactionFrame \?\? \(frozen \? timeline\.at\(-1\) : timeline\[currentStage\]/);
});
