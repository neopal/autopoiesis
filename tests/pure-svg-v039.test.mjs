import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_WINDOW,
  applyClosureAttempt,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAttempt,
  releaseContour
} = await import('../studies/pure-svg/v039/engine.mjs');

const SWEEP = {
  points: [
    { x: 0.22, y: 0.66 },
    { x: 0.30, y: 0.35 },
    { x: 0.62, y: 0.25 },
    { x: 0.78, y: 0.32 }
  ]
};

test('SVG v039 turns a bounded closure attempt into one changed winding contour', () => {
  const initial = buildFrame();
  const next = applyClosureAttempt(initial, SWEEP);

  assert.equal(initial.grammar, 'winding-contour');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'closure-attempt');
  assert.equal(next.contours.length, 1);
  assert.ok(next.event.separation > 0);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.notEqual(next.contours[0].pathSignature, initial.contours[0].pathSignature);
  assert.notEqual(next.state.winding, initial.state.winding);
  assert.ok(next.state.gapIndex !== initial.state.gapIndex);
});


test('SVG v039 requires a turned closure path rather than a straight offer', () => {
  const initial = buildFrame();
  const flat = applyClosureAttempt(initial, {
    points: [{ x: 0.22, y: 0.66 }, { x: 0.50, y: 0.49 }, { x: 0.78, y: 0.32 }]
  });
  const turned = applyClosureAttempt(initial, {
    points: [
      { x: 0.22, y: 0.66 },
      { x: 0.30, y: 0.35 },
      { x: 0.62, y: 0.25 },
      { x: 0.78, y: 0.32 }
    ]
  });

  assert.equal(flat.memory.length, 0);
  assert.equal(flat.interaction, 'attempt-refused-flat');
  assert.equal(turned.memory.length, 1);
  assert.equal(turned.event.turns > 0, true);
  assert.equal(turned.event.committed, true);
});


test('SVG v039 compounds four winding changes, lifts exactly, and releases to seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestAttempt(settled);
  const released = releaseContour();

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.closureCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});


test('SVG v039 exposes a tableau-first turned-contour encounter and release metadata', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v039/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v039/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v039/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v039/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v039/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attempt"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyClosureAttempt/);
  assert.match(sketch, /points/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG winding contour');
  assert.equal(metrics.commitThreshold, 'a bounded turned closure attempt with path-length and turn thresholds');
});


test('SVG v039 is registered exactly once for the 2026-10-29 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-29');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-29');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v039/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-29');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-28');
  assert.equal(matches[0].source.referenceId, 'p5-brush');

  const canonical = await readFile(new URL('works/svg-2026-10-29/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-29"/);
});
