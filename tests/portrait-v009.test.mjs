import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applySeam,
  buildFrame,
  buildTimeline,
  deleteLatestSeam,
  geometrySignature
} = await import('../studies/self-portrait/v009/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

test('portrait v009 turns a remembered decision into a reversible structural seam', () => {
  const baseline = buildFrame(8);
  const changed = applySeam(baseline, { x: 0.78, y: 0.4 });
  const restored = deleteLatestSeam(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.seamRoutes.length, 1);
  assert.equal(changed.seamRoutes[0].thread.length, 21);
  assert.ok(changed.seamRoutes[0].crossing.x > 0.18 && changed.seamRoutes[0].crossing.x < 0.82);
  assert.ok(changed.seamRoutes[0].crossing.y > 0.18 && changed.seamRoutes[0].crossing.y < 0.82);
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 12);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-seam');
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the seam must restore the exact prior field');
});

test('portrait v009 makes the seam legible as entry, crossing, and changed exit', () => {
  let frame = buildFrame(5);
  frame = applySeam(frame, { x: 0.2, y: 0.32 });
  frame = applySeam(frame, { x: 0.78, y: 0.64 });

  assert.equal(frame.memory.length, 2);
  assert.ok(frame.seamRoutes.every((route) => route.thread.length >= 17));
  assert.ok(frame.seamRoutes.every((route) => distance(route.entry, route.crossing) > 0.06));
  assert.ok(frame.seamRoutes.every((route) => distance(route.crossing, route.exit) > 0.06));
  assert.ok(frame.seamRoutes.every((route) => route.exitIndex !== route.entryIndex));
  assert.ok(frame.seamRoutes.every((route) => route.leftRail.length === route.thread.length && route.rightRail.length === route.thread.length));
  assert.ok(frame.seamRoutes.every((route) => route.separation > 0.008));
});

test('portrait v009 bounds seams, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(5);
  const first = applySeam(baseline, { x: 2, y: -1 });
  const repeated = applySeam(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applySeam(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v009 timeline accumulates four structural seams by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.seamRoutes.length, MEMORY_LIMIT);
  assert.ok(settled.seamRoutes.every((route) => route.thread.length === 21));
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v009 tableau is first, preview-safe, and exposes reversible seam memory', async () => {
  const html = await read('studies/self-portrait/v009/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-14"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="seam"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /seam|stitch|thread|decision/i);
});

test('portrait v009 runtime binds pointer and keyboard to structural seam memory', async () => {
  const sketch = await read('studies/self-portrait/v009/sketch.js');
  const style = await read('studies/self-portrait/v009/style.css');

  assert.match(sketch, /applySeam/);
  assert.match(sketch, /deleteLatestSeam/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawSeamRoutes/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /const blindMode = params\.get\('blind'\) === '1'/);
  assert.match(sketch, /if \(blindMode\) return/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v009 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/self-portrait/v009/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v009/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v009/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('seam'));
  assert.ok(metrics.interactionRule.includes('entry'));
  assert.equal(critiques.length, 4);
});

test('portrait v009 is the unique 2026-09-14 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-14');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-14');
  assert.equal(work.rawPath, '/studies/self-portrait/v009/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-14');
  assert.equal(work.decision.lineage, 'portrait-2026-09-12');

  const canonical = await readFile(new URL('works/portrait-2026-09-14/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-14"/);
});

test('portrait v009 frozen readback reports the settled frame it renders', async () => {
  const sketch = await read('studies/self-portrait/v009/sketch.js');

  assert.match(sketch, /interactionFrame \?\? \(frozen \? timeline\.at\(-1\) : timeline\[currentStage\]/);
});
