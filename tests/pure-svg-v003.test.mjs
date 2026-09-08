import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFrame, buildTimeline, distance, applyRefusal, deleteRefusal } = await import('../studies/pure-svg/v003/engine.mjs');

const routeDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

test('SVG v003 turns remembered refusal into a topology change in later body routes', () => {
  const frame = buildTimeline()[6];
  assert.ok(frame.memory.length >= 2);

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const downstreamDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + routeDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(downstreamDelta > 0.08, `expected a route delta, got ${downstreamDelta}`);
  assert.ok(frame.limbs.some((limb) => limb.route === 'detour'));
  assert.ok(frame.memory.at(-1).influencedRoutes.includes('hind-leg'));
});

test('SVG v003 visitor refusal is bounded, deterministic, and structural', () => {
  const frame = buildTimeline()[4];
  const next = applyRefusal(frame, { x: 0.99, y: -0.2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.96, y: 0.12 });
  assert.equal(next.memory.at(-1).source, 'visitor-refusal');
  assert.ok(next.limbs.some((limb) => limb.route === 'detour'));
  assert.deepEqual(applyRefusal(frame, { x: 0.99, y: -0.2 }), next);
});

test('SVG v003 deleting the latest refusal restores the exact prior route', () => {
  const frame = buildTimeline()[5];
  const withRefusal = applyRefusal(frame, { x: 0.74, y: 0.42 });
  const restored = deleteRefusal(withRefusal);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.deepEqual(restored.points, baseline.points);
  assert.deepEqual(restored.limbs, baseline.limbs);
  assert.equal(restored.memory.length, frame.memory.length);
});

test('SVG v003 exposes a tableau-first interaction contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v003/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v003/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v003/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /document\.documentElement\.classList\.contains\('interactive-preview'\)/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.doesNotMatch(index, /<body class="work-page interactive-preview"/);
  assert.match(index, /data-gesture="refuse"/);
  assert.match(index, /data-gesture="delete"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteLatest/);
  assert.match(sketch, /\.has\('interaction'\)/);
  assert.match(sketch, /location\.hash === '#interaction'/);
  assert.match(sketch, /document\.documentElement\.classList\.contains\('interactive-preview'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1';/);
  assert.match(sketch, /location\.hash === '#static'/);
  assert.match(sketch, /lastRenderedStage/);
  assert.match(sketch, /current\.frame\.stage !== lastRenderedStage/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.route--detour/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('SVG v003 legacy aliases resolve to the new canonical daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const routes = await readFile(new URL('vercel.json', root), 'utf8');

  assert.match(routes, /"\/oeuvres\/svg-2026-09-03\/"/);
  assert.match(routes, /"\/chantiers\/pure-svg\/v003\/"/);
  assert.match(routes, /"\/works\/svg-2026-09-03\/"/);
  assert.match(routes, /"\/studies\/pure-svg\/v003\/"/);
});

test('SVG v003 canonical page carries the current atmosphere token', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const canonical = await readFile(new URL('works/svg-2026-09-03/index.html', root), 'utf8');

  assert.match(canonical, /<body class="work-page" data-current="svg" data-work-id="svg-2026-09-03">/);
});
