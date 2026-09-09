import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_LIMIT,
  buildFrame,
  buildTimeline,
  distance,
  applyAfterimage,
  deleteAfterimage
} = await import('../studies/pure-svg/v007/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v007 makes later contour and gait repeat an earlier rhythm one step late', () => {
  const frame = buildTimeline()[8];
  assert.ok(frame.memory.length >= 2);

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const latest = frame.memory.at(-1);
  const downstream = frame.points.slice(latest.anchorIndex);
  const contourDelta = downstream.reduce((sum, point, index) => (
    sum + distance(point, withoutLatest.points[latest.anchorIndex + index])
  ), 0);
  const routeDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + routeDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(frame.afterimage, 'the frame must expose the active afterimage');
  assert.ok(frame.afterimage.echoPoint.x > 0 && frame.afterimage.echoPoint.x < 1);
  assert.ok(frame.afterimage.lag >= 1);
  assert.ok(contourDelta > 0.045, `expected delayed contour echo, got ${contourDelta}`);
  assert.ok(routeDelta > 0.095, `expected delayed gait echo, got ${routeDelta}`);
  assert.ok(frame.limbs.some((limb) => limb.route === 'echoed'));
});

test('SVG v007 visitor afterimage is bounded and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyAfterimage(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-afterimage');
  assert.ok(next.memory.at(-1).lag >= 1);
  assert.deepEqual(applyAfterimage(frame, { x: 99, y: -2 }), next);

  const restored = deleteAfterimage(next);
  const baseline = buildFrame(frame.stage, frame.memory);
  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.deepEqual(restored.memory, baseline.memory);
});

test('SVG v007 caps repeated visitor afterimages without losing the undo baseline', () => {
  let current = buildTimeline()[8];
  let beforeLast = current;
  for (let index = 0; index < MEMORY_LIMIT + 3; index += 1) {
    beforeLast = current;
    current = applyAfterimage(current, { x: 0.18 + index * 0.08, y: 0.42 });
  }

  assert.equal(current.memory.length, MEMORY_LIMIT);
  const restored = deleteAfterimage(current);
  assert.equal(restored.memory.length, MEMORY_LIMIT);
  assert.deepEqual(restored.memory, beforeLast.memory);
});

test('SVG v007 keeps a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v007/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v007/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v007/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="afterimage"/);
  assert.match(index, /data-gesture="erase"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteAfterimage/);
  assert.match(sketch, /applyAfterimage/);
  assert.match(sketch, /echoPoint/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.afterimage/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v007 is registered as the unique 2026-09-09 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-09');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-09');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v007/');
  const canonical = await readFile(new URL('works/svg-2026-09-09/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-09"/);
});
