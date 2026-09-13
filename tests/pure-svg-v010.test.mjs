import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyCounterweight,
  deleteCounterweight
} = await import('../studies/pure-svg/v010/engine.mjs');

const limbDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

const signature = (frame) => ({
  points: frame.points,
  limbs: frame.limbs,
  memory: frame.memory
});

test('SVG v010 turns a remembered refusal into a counterweight and changed gait', () => {
  const frame = buildTimeline()[STAGES - 2];
  assert.ok(frame.memory.length >= 2);
  assert.equal(frame.counterweight.kind, 'counterweight');
  assert.ok(frame.counterweight.balanceIndex > frame.counterweight.anchorIndex);
  assert.ok(frame.counterweight.leverage > 0.02);
  assert.ok(frame.limbs.some((limb) => limb.posture === 'loaded'));
  assert.ok(frame.limbs.some((limb) => limb.posture === 'countered'));

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const latest = frame.memory.at(-1);
  const contourDelta = frame.points
    .slice(latest.anchorIndex)
    .reduce((sum, point, index) => sum + distance(
      point,
      withoutLatest.points[latest.anchorIndex + index]
    ), 0);
  const gaitDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + limbDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(contourDelta > 0.08, `expected counterweight contour change, got ${contourDelta}`);
  assert.ok(gaitDelta > 0.18, `expected counterweight gait change, got ${gaitDelta}`);
  assert.ok(frame.counterweight.spine.some((point) => point.x !== frame.points[frame.counterweight.anchorIndex].x));
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v010 visitor counterweight is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[3];
  const next = applyCounterweight(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.94, y: 0.16 });
  assert.equal(next.memory.at(-1).source, 'visitor-counterweight');
  assert.ok(next.memory.at(-1).balanceIndex > next.memory.at(-1).anchorIndex);
  assert.deepEqual(applyCounterweight(frame, { x: 99, y: -2 }), next);

  const restored = deleteCounterweight(next);
  assert.deepEqual(signature(restored), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v010 keeps a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v010/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v010/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v010/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="weight"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteCounterweight/);
  assert.match(sketch, /applyCounterweight/);
  assert.match(sketch, /spine/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.counterweight/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v010 is registered as the unique 2026-09-13 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-13');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-13');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v010/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-13');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v009');

  const canonical = await readFile(new URL('works/svg-2026-09-13/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-13"/);
});
