import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFrame, buildTimeline, distance, applyHinge, deleteHinge } = await import('../studies/pure-svg/v005/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v005 turns remembered refusal into a downstream hinge', () => {
  const frame = buildTimeline()[7];
  assert.ok(frame.memory.length >= 2);

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const downstreamStart = frame.memory.at(-1).anchorIndex;
  const contourDelta = frame.points
    .slice(downstreamStart)
    .reduce((sum, point, index) => sum + distance(point, withoutLatest.points[downstreamStart + index]), 0);
  const routeDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + routeDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(frame.hinge, 'the frame must expose the active hinge');
  assert.ok(Math.abs(frame.hinge.angle) > 0.1, 'the hinge must rotate the downstream frame');
  assert.ok(contourDelta > 0.045, `expected a changed downstream contour, got ${contourDelta}`);
  assert.ok(routeDelta > 0.08, `expected a changed hinge route, got ${routeDelta}`);
  assert.ok(frame.limbs.some((limb) => limb.route === 'folded'));
});

test('SVG v005 visitor hinge is bounded and reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyHinge(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-hinge');
  assert.ok(Math.abs(next.memory.at(-1).angle) >= 0.18);
  assert.deepEqual(applyHinge(frame, { x: 99, y: -2 }), next);

  const restored = deleteHinge(next);
  const baseline = buildFrame(frame.stage, frame.memory);
  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.deepEqual(restored.memory, baseline.memory);
});

test('SVG v005 exposes a tableau-first reversible interaction contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v005/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v005/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v005/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="hinge"/);
  assert.match(index, /data-gesture="unhinge"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteHinge/);
  assert.match(sketch, /applyHinge/);
  assert.match(sketch, /hinge/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1';/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.hinge/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('SVG v005 is registered as the unique 2026-09-07 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-07');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-07');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v005/');
  const canonical = await readFile(new URL('works/svg-2026-09-07/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-07"/);
});
