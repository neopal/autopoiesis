import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyHinge,
  deleteHinge
} = await import('../studies/pure-svg/v011/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

const signature = (frame) => ({
  points: frame.points,
  routes: frame.routes,
  memory: frame.memory
});

test('SVG v011 turns a remembered refusal into a hinge that folds body and routes', () => {
  const frame = buildTimeline()[STAGES - 1];
  const latest = frame.memory.at(-1);
  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));

  assert.ok(frame.memory.length >= 2);
  assert.equal(latest.kind, 'hinge');
  assert.ok(latest.creaseIndex > latest.pivotIndex);
  assert.ok(Math.abs(latest.foldAngle) > 0.08);
  assert.ok(latest.gate.x !== latest.pivot.x || latest.gate.y !== latest.pivot.y);
  assert.ok(frame.routes.some((route) => route.posture === 'folded'));
  assert.ok(frame.routes.some((route) => route.posture === 'braced'));

  const contourDelta = frame.points
    .slice(latest.pivotIndex)
    .reduce((sum, point, index) => sum + distance(point, withoutLatest.points[latest.pivotIndex + index]), 0);
  const routeDelta = frame.routes.reduce((sum, route, index) => sum + routeDistance(route, withoutLatest.routes[index]), 0);

  assert.ok(contourDelta > 0.12, `expected hinge contour change, got ${contourDelta}`);
  assert.ok(routeDelta > 0.24, `expected hinge route change, got ${routeDelta}`);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v011 visitor hinge is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyHinge(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.94, y: 0.16 });
  assert.equal(next.memory.at(-1).source, 'visitor-hinge');
  assert.ok(next.memory.at(-1).creaseIndex > next.memory.at(-1).pivotIndex);
  assert.deepEqual(applyHinge(frame, { x: 99, y: -2 }), next);

  const restored = deleteHinge(next);
  assert.deepEqual(signature(restored), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v011 exposes a tableau-first reversible browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v011/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v011/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v011/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="hinge"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteHinge/);
  assert.match(sketch, /applyHinge/);
  assert.match(sketch, /hinge/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.hinge/);
  assert.match(style, /static-mode[^}]*animal-notch/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v011 is registered as the unique 2026-09-14 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-14');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-14');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v011/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-14');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v010');

  const canonical = await readFile(new URL('works/svg-2026-09-14/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-14"/);
});
