import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  buildTimeline,
  distance,
  applyCounterweight,
  deleteCounterweight
} = await import('../studies/pure-svg/v006/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v006 redistributes downstream mass around a remembered counterweight', () => {
  const frame = buildTimeline()[7];
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

  assert.ok(frame.counterweight, 'the frame must expose the active counterweight');
  assert.ok(frame.counterweight.balancePoint.x > 0 && frame.counterweight.balancePoint.x < 1);
  assert.ok(frame.counterweight.load > 0, 'the remembered refusal must carry load');
  assert.ok(contourDelta > 0.055, `expected redistributed contour mass, got ${contourDelta}`);
  assert.ok(routeDelta > 0.11, `expected feet to migrate around the load, got ${routeDelta}`);
  assert.ok(frame.limbs.some((limb) => limb.route === 'weighted'));
});

test('SVG v006 visitor counterweight is bounded and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyCounterweight(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-counterweight');
  assert.ok(next.memory.at(-1).load >= 0.22);
  assert.deepEqual(applyCounterweight(frame, { x: 99, y: -2 }), next);

  const restored = deleteCounterweight(next);
  const baseline = buildFrame(frame.stage, frame.memory);
  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.deepEqual(restored.memory, baseline.memory);
});

test('SVG v006 keeps a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v006/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v006/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v006/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="counterweight"/);
  assert.match(index, /data-gesture="unweight"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteCounterweight/);
  assert.match(sketch, /applyCounterweight/);
  assert.match(sketch, /balancePoint/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.counterweight/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('SVG v006 is registered as the unique 2026-09-08 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-08');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-08');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v006/');
  const canonical = await readFile(new URL('works/svg-2026-09-08/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-08"/);
});
