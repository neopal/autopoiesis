import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyFold,
  deleteFold
} = await import('../studies/pure-svg/v009/engine.mjs');

const limbDistance = (a, b) => ['joint', 'knee', 'foot']
  .reduce((sum, key) => sum + distance(a[key], b[key]), 0);

const pointSignature = (frame) => ({
  points: frame.points,
  limbs: frame.limbs,
  memory: frame.memory
});

test('SVG v009 turns a remembered refusal into a contour pocket and inside gait', () => {
  const frame = buildTimeline()[STAGES - 2];
  assert.ok(frame.memory.length >= 2);
  assert.ok(frame.fold, 'the frame must expose the active fold');
  assert.ok(frame.fold.seamIndex > frame.fold.anchorIndex);
  assert.ok(frame.fold.pocketDepth > 0.02);
  assert.ok(frame.fold.pocketWidth > 0.02);
  assert.equal(frame.fold.kind, 'pocket');
  assert.ok(frame.limbs.some((limb) => limb.route === 'folded'));
  assert.ok(frame.limbs.some((limb) => limb.gaitSide === 'inside'));
  assert.ok(frame.limbs.some((limb) => limb.gaitSide === 'outside'));

  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));
  const latest = frame.memory.at(-1);
  const downstreamDelta = frame.points
    .slice(latest.anchorIndex)
    .reduce((sum, point, index) => sum + distance(
      point,
      withoutLatest.points[latest.anchorIndex + index]
    ), 0);
  const gaitDelta = frame.limbs.reduce((sum, limb, index) => (
    sum + limbDistance(limb, withoutLatest.limbs[index])
  ), 0);

  assert.ok(downstreamDelta > 0.08, `expected pocket contour change, got ${downstreamDelta}`);
  assert.ok(gaitDelta > 0.18, `expected inside gait change, got ${gaitDelta}`);
  assert.ok(frame.fold.opening.some((point) => point.x !== frame.points[frame.fold.anchorIndex].x));
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v009 visitor fold is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[3];
  const next = applyFold(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.94, y: 0.16 });
  assert.equal(next.memory.at(-1).source, 'visitor-fold');
  assert.ok(next.memory.at(-1).seamIndex > next.memory.at(-1).anchorIndex);
  assert.deepEqual(applyFold(frame, { x: 99, y: -2 }), next);

  const restored = deleteFold(next);
  assert.deepEqual(pointSignature(restored), pointSignature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v009 keeps a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v009/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v009/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v009/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="fold"/);
  assert.match(index, /data-gesture="unfold"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteFold/);
  assert.match(sketch, /applyFold/);
  assert.match(sketch, /pocket/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.pocket/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v009 is registered as the unique 2026-09-12 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-12');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-12');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v009/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-12');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v008');

  const canonical = await readFile(new URL('works/svg-2026-09-12/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-12"/);
});
