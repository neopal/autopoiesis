import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  buildTimeline,
  distance,
  applyRelay,
  deleteRelay
} = await import('../studies/pure-svg/v008/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v008 hands a remembered refusal through the downstream contour and gait', () => {
  const frame = buildTimeline()[9];
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

  assert.ok(frame.relay, 'the frame must expose the active relay');
  assert.ok(frame.relay.relayPoint.x > 0 && frame.relay.relayPoint.x < 1);
  assert.ok(frame.relay.handoffVector.x !== 0 || frame.relay.handoffVector.y !== 0);
  assert.ok(frame.relay.relayIndex > frame.relay.anchorIndex);
  assert.ok(contourDelta > 0.055, `expected relay contour, got ${contourDelta}`);
  assert.ok(routeDelta > 0.12, `expected relay gait, got ${routeDelta}`);
  assert.ok(frame.limbs.some((limb) => limb.route === 'relayed'));
  assert.ok(frame.limbs.filter((limb) => limb.route === 'relayed').every((limb) => limb.relayOrder));
});

test('SVG v008 visitor relay is bounded and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyRelay(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-relay');
  assert.ok(next.memory.at(-1).relayIndex > next.memory.at(-1).anchorIndex);
  assert.deepEqual(applyRelay(frame, { x: 99, y: -2 }), next);

  const restored = deleteRelay(next);
  const baseline = buildFrame(frame.stage, frame.memory);
  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.deepEqual(restored.memory, baseline.memory);
});

test('SVG v008 keeps a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v008/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v008/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v008/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="relay"/);
  assert.match(index, /data-gesture="unlink"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteRelay/);
  assert.match(sketch, /applyRelay/);
  assert.match(sketch, /relayPoint/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.relay/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v008 is registered as the unique 2026-09-10 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-10');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-10');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v008/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  const canonical = await readFile(new URL('works/svg-2026-09-10/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-10"/);
});
