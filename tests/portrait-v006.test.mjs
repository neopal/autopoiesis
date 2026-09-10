import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applyFold,
  buildFrame,
  buildTimeline,
  deleteLatestFold,
  geometrySignature
} = await import('../studies/self-portrait/v006/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

test('portrait v006 turns a remembered decision into a structural contour fold', () => {
  const baseline = buildFrame(8);
  const changed = applyFold(baseline, { x: 0.76, y: 0.42 });
  const restored = deleteLatestFold(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.ok(changed.folds.length >= 1);
  assert.ok(changed.foldRoutes.length >= 1);
  assert.ok(changed.foldedContour.length === changed.contour.length);
  assert.ok(changedPointCount(changed.contour, changed.foldedContour) >= 8);
  assert.ok(changed.folds.at(-1).source === 'visitor-fold');
  assert.ok(changed.foldRoutes.at(-1).points.length >= 8);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting must restore the exact prior field');
});

test('portrait v006 bounds folds, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(5);
  const first = applyFold(baseline, { x: 2, y: -1 });
  const repeated = applyFold(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyFold(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v006 timeline accumulates four folds by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.folds.length, MEMORY_LIMIT);
  assert.ok(settled.foldRoutes.every((route) => route.points.length >= 8));
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v006 tableau is first, preview-safe, and names a reversible folding gesture', async () => {
  const html = await read('studies/self-portrait/v006/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-10"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="fold"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /fold|crease|occlusion/i);
});

test('portrait v006 runtime binds pointer and keyboard to structural fold memory', async () => {
  const sketch = await read('studies/self-portrait/v006/sketch.js');
  const style = await read('studies/self-portrait/v006/style.css');

  assert.match(sketch, /applyFold/);
  assert.match(sketch, /deleteLatestFold/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawFold/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v006 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/self-portrait/v006/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v006/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v006/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('fold'));
  assert.ok(metrics.interactionRule.includes('contour'));
  assert.equal(critiques.length, 4);
});

test('portrait v006 is the unique 2026-09-10 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-10');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-10');
  assert.equal(work.rawPath, '/studies/self-portrait/v006/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-10');
  assert.equal(work.decision.lineage, 'portrait-2026-09-09');

  await access(new URL('works/portrait-2026-09-10/index.html', root));
  const canonical = await readFile(new URL('works/portrait-2026-09-10/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-10"/);
});
