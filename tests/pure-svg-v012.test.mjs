import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

test('SVG v012 has a dedicated study tableau path', async () => {
  await access(new URL('../studies/pure-svg/v012/index.html', import.meta.url));
  assert.ok(true);
});

test('SVG v012 turns a remembered refusal into a threshold crossed by the body and routes', async () => {
  const {
    STAGES,
    PRIMITIVE_BUDGET,
    buildFrame,
    buildTimeline,
    distance
  } = await import('../studies/pure-svg/v012/engine.mjs');
  const frame = buildTimeline()[STAGES - 1];
  const latest = frame.memory.at(-1);
  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const contourDelta = frame.points
    .slice(latest.anchorIndex)
    .reduce((sum, point, index) => sum + distance(point, withoutLatest.points[latest.anchorIndex + index]), 0);
  const routeDelta = frame.routes.reduce((sum, route, index) => sum + ['joint', 'queue', 'knee', 'pass', 'foot']
    .reduce((routeSum, key) => routeSum + distance(route[key], withoutLatest.routes[index][key]), 0), 0);

  assert.ok(frame.memory.length >= 2);
  assert.equal(latest.kind, 'threshold');
  assert.ok(latest.thresholdIndex > latest.anchorIndex);
  assert.ok(latest.exitIndex > latest.thresholdIndex);
  assert.ok(latest.aperture.length >= 4);
  assert.ok(latest.gapWidth > 0.02);
  assert.ok(contourDelta > 0.12, `expected threshold contour change, got ${contourDelta}`);
  assert.ok(routeDelta > 0.24, `expected threshold route change, got ${routeDelta}`);
  assert.ok(frame.routes.some((route) => route.posture === 'waiting'));
  assert.ok(frame.routes.some((route) => route.posture === 'crossing'));
  assert.ok(frame.routes.some((route) => route.posture === 'cleared'));
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v012 visitor threshold is bounded, deterministic, and exactly reversible', async () => {
  const {
    applyThreshold,
    buildFrame,
    buildTimeline,
    deleteThreshold
  } = await import('../studies/pure-svg/v012/engine.mjs');
  const frame = buildTimeline()[4];
  const next = applyThreshold(frame, { x: 99, y: -2 });
  const signature = (candidate) => ({
    points: candidate.points,
    routes: candidate.routes,
    memory: candidate.memory
  });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.94, y: 0.16 });
  assert.equal(next.memory.at(-1).source, 'visitor-threshold');
  assert.ok(next.memory.at(-1).exitIndex > next.memory.at(-1).thresholdIndex);
  assert.deepEqual(applyThreshold(frame, { x: 99, y: -2 }), next);
  assert.deepEqual(signature(deleteThreshold(next)), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v012 exposes a tableau-first reversible browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v012/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v012/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v012/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="threshold"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteThreshold/);
  assert.match(sketch, /applyThreshold/);
  assert.match(sketch, /aperture/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.threshold/);
  assert.match(style, /static-mode[^}]*threshold-aperture/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v012 is registered as the unique 2026-09-15 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-15');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-15');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v012/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-15');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v011');

  const canonical = await readFile(new URL('works/svg-2026-09-15/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-15"/);
});
