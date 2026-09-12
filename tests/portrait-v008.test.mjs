import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applyBlindSpot,
  buildFrame,
  buildTimeline,
  deleteLatestBlindSpot,
  geometrySignature
} = await import('../studies/self-portrait/v008/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

test('portrait v008 turns a remembered decision into a reversible routed blind spot', () => {
  const baseline = buildFrame(8);
  const changed = applyBlindSpot(baseline, { x: 0.78, y: 0.4 });
  const restored = deleteLatestBlindSpot(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.blindRoutes.length, 1);
  assert.ok(changed.blindRoutes[0].upperLip.length >= 8);
  assert.ok(changed.blindRoutes[0].lowerLip.length >= 8);
  assert.ok(changed.blindRoutes[0].returnRoute.length >= 10);
  assert.notDeepEqual(changed.counterContour, changed.contour);
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 10);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-blind-spot');
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the blind spot must restore the exact prior field');
});

test('portrait v008 makes the blind spot legible as a split and rejoin, not a lone mark', () => {
  let frame = buildFrame(5);
  frame = applyBlindSpot(frame, { x: 0.2, y: 0.32 });
  frame = applyBlindSpot(frame, { x: 0.78, y: 0.64 });

  assert.equal(frame.memory.length, 2);
  assert.ok(frame.blindRoutes.every((route) => route.separation > 0.04));
  assert.ok(frame.blindRoutes.every((route) => route.rejoinIndex > route.anchorIndex));
  assert.ok(frame.blindRoutes.every((route) => route.upperLip.at(-1).x === route.lowerLip.at(-1).x));
});

test('portrait v008 bounds blind spots, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(5);
  const first = applyBlindSpot(baseline, { x: 2, y: -1 });
  const repeated = applyBlindSpot(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyBlindSpot(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v008 timeline accumulates four routed blind spots by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.blindRoutes.length, MEMORY_LIMIT);
  assert.ok(settled.blindRoutes.every((route) => route.upperLip.length >= 12));
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v008 tableau is first, preview-safe, and exposes reversible blindness', async () => {
  const html = await read('studies/self-portrait/v008/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-12"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="blind"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /blind spot|route around|absence/i);
});

test('portrait v008 runtime binds pointer and keyboard to structural blind-spot memory', async () => {
  const sketch = await read('studies/self-portrait/v008/sketch.js');
  const style = await read('studies/self-portrait/v008/style.css');

  assert.match(sketch, /applyBlindSpot/);
  assert.match(sketch, /deleteLatestBlindSpot/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawBlindRoutes/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v008 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/self-portrait/v008/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v008/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v008/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('blind spot'));
  assert.ok(metrics.interactionRule.includes('split/rejoin'));
  assert.equal(critiques.length, 4);
});

test('portrait v008 is the unique 2026-09-12 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-12');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-12');
  assert.equal(work.rawPath, '/studies/self-portrait/v008/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-12');
  assert.equal(work.decision.lineage, 'portrait-2026-09-11');

  const canonical = await readFile(new URL('works/portrait-2026-09-12/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-12"/);
});

test('portrait v008 frozen readback reports the settled frame it renders', async () => {
  const sketch = await read('studies/self-portrait/v008/sketch.js');

  assert.match(sketch, /interactionFrame \?\? \(frozen \? timeline\.at\(-1\) : timeline\[currentStage\]/);
});
