import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFrame, buildTimeline, distance, applyRefusal, deleteRefusal } = await import('../studies/pure-svg/v004/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v004 turns remembered refusal into a negative chamber and reroutes later limbs', () => {
  const frame = buildTimeline()[7];
  assert.ok(frame.memory.length >= 2);

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const chamberDelta = distance(frame.aperture.center, withoutLatest.aperture.center)
    + Math.abs(frame.aperture.radius - withoutLatest.aperture.radius);
  const downstreamDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + routeDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(chamberDelta > 0.035, `expected a changed negative chamber, got ${chamberDelta}`);
  assert.ok(downstreamDelta > 0.08, `expected a route delta, got ${downstreamDelta}`);
  assert.ok(frame.aperture.holePath.length > 20);
  const holeCoordinates = frame.aperture.holePath.match(/[0-9.]+/g).map(Number);
  assert.ok(Math.max(...holeCoordinates) > 100, 'the aperture path must use the SVG viewBox coordinate system');
  assert.ok(frame.limbs.some((limb) => limb.route === 'detour'));
});

test('SVG v004 visitor refusal is bounded, deterministic, and structural', () => {
  const frame = buildTimeline()[4];
  const next = applyRefusal(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-refusal');
  assert.ok(next.aperture.radius >= 0.06 && next.aperture.radius <= 0.18);
  assert.ok(next.limbs.some((limb) => limb.route === 'detour'));
  assert.deepEqual(applyRefusal(frame, { x: 99, y: -2 }), next);
});

test('SVG v004 deleting the latest refusal restores the exact prior body and routes', () => {
  const frame = buildTimeline()[5];
  const withRefusal = applyRefusal(frame, { x: 0.74, y: 0.42 });
  const restored = deleteRefusal(withRefusal);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.deepEqual(restored.aperture, baseline.aperture);
  assert.equal(restored.memory.length, frame.memory.length);
});

test('SVG v004 exposes a tableau-first, reversible interaction contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v004/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v004/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v004/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="refuse"/);
  assert.match(index, /data-gesture="delete"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteLatest/);
  assert.match(sketch, /applyRefusal/);
  assert.match(sketch, /aperture/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1';/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.aperture/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('SVG v004 is registered as the unique 2026-09-04 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-04');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-04');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v004/');
  const canonical = await readFile(new URL('works/svg-2026-09-04/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-04"/);
});
