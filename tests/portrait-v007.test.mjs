import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applyCounterGaze,
  buildFrame,
  buildTimeline,
  deleteLatestCounterGaze,
  geometrySignature
} = await import('../studies/self-portrait/v007/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

test('portrait v007 turns a remembered decision into a structural counter-gaze', () => {
  const baseline = buildFrame(8);
  const changed = applyCounterGaze(baseline, { x: 0.78, y: 0.4 });
  const restored = deleteLatestCounterGaze(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.ok(changed.gazeRoutes.length >= 1);
  assert.equal(changed.counterContour.length, changed.contour.length);
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 10);
  assert.notDeepEqual(changed.aperture, changed.counterAperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-counter-gaze');
  assert.ok(changed.gazeRoutes.at(-1).points.length >= 12);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'looking away must be reversible');
});

test('portrait v007 bounds counter-gaze points, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(5);
  const first = applyCounterGaze(baseline, { x: 2, y: -1 });
  const repeated = applyCounterGaze(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyCounterGaze(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v007 timeline accumulates four counter-gazes by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.gazeRoutes.length, MEMORY_LIMIT);
  assert.ok(settled.gazeRoutes.every((route) => route.points.length >= 12));
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v007 tableau is first, preview-safe, and names a reversible counter-gaze', async () => {
  const html = await read('studies/self-portrait/v007/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-11"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="gaze"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /gaze|pupil|look away/i);
});

test('portrait v007 runtime binds pointer and keyboard to structural counter-gaze memory', async () => {
  const sketch = await read('studies/self-portrait/v007/sketch.js');
  const style = await read('studies/self-portrait/v007/style.css');

  assert.match(sketch, /applyCounterGaze/);
  assert.match(sketch, /deleteLatestCounterGaze/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawCounterGaze/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v007 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/self-portrait/v007/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v007/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v007/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('counter-gaze'));
  assert.ok(metrics.interactionRule.includes('aperture'));
  assert.equal(critiques.length, 4);
});

test('portrait v007 frozen readback reports the settled frame it renders', async () => {
  const sketch = await read('studies/self-portrait/v007/sketch.js');

  assert.match(sketch, /interactionFrame \?\? \(frozen \? timeline\.at\(-1\) : timeline\[currentStage\]/);
});

test('portrait v007 is the unique 2026-09-11 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-11');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-11');
  assert.equal(work.rawPath, '/studies/self-portrait/v007/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-11');
  assert.equal(work.decision.lineage, 'portrait-2026-09-10');

  await access(new URL('works/portrait-2026-09-11/index.html', root));
  const canonical = await readFile(new URL('works/portrait-2026-09-11/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-11"/);
});
