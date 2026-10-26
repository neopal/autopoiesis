import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CELL_COUNT,
  MEMORY_WINDOW,
  MIN_TOUR_POINTS,
  applyTour,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestTour,
  releaseField
} = await import('../studies/pure-svg/v037/engine.mjs');

const TOUR = {
  points: [
    { x: 0.15, y: 0.22 },
    { x: 0.28, y: 0.18 },
    { x: 0.42, y: 0.25 },
    { x: 0.61, y: 0.17 },
    { x: 0.76, y: 0.25 }
  ]
};

test('SVG v037 turns a proximity tour into a non-local vacancy exchange without copying the route', () => {
  const initial = buildFrame();
  const next = applyTour(initial, TOUR);

  assert.equal(initial.grammar, 'witness-vacancy');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'proximity-tour');
  assert.equal(next.cells.length, CELL_COUNT);
  assert.ok(next.event.route.length >= 3);
  assert.ok(next.event.witnessCell !== next.event.vacancyCell);
  assert.ok(next.event.vacancyCell !== next.event.relayCell);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.ok(next.cells.filter((cell) => cell.role !== 'quiet').length >= 3);
  assert.ok(!geometrySignature(next).includes('0.15 0.22'), 'the visitor route must not be copied into SVG geometry');
});

test('SVG v037 refuses flicker and one-cell tours, then lifts the exact preceding exchange', () => {
  const initial = buildFrame();
  const flicker = applyTour(initial, { points: [{ x: 0.4, y: 0.4 }, { x: 0.41, y: 0.4 }] });
  const oneCell = applyTour(initial, { points: [{ x: 0.15, y: 0.22 }, { x: 0.151, y: 0.221 }, { x: 0.152, y: 0.222 }] });

  assert.equal(flicker.memory.length, 0);
  assert.equal(flicker.interaction, 'tour-refused-short');
  assert.equal(oneCell.memory.length, 0);
  assert.equal(oneCell.interaction, 'tour-refused-single-cell');

  const committed = applyTour(initial, TOUR);
  const lifted = liftLatestTour(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v037 preserves deterministic bounded tour memory and releases to the seed field', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.cells.length, CELL_COUNT);
  assert.ok(settled.state.vacancyCount > 0);
  assert.deepEqual(buildTimeline(), timeline);
  assert.deepEqual(applyTour(buildFrame(), TOUR), applyTour(buildFrame(), TOUR));

  const released = releaseField();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(settled), geometrySignature(released));
});

test('SVG v037 exposes a tableau-first proximity encounter and honest production metadata', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v037/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v037/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v037/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v037/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v037/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="tour"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /applyTour/);
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
  assert.equal(metrics.renderer, 'deterministic inline SVG witness vacancy field');
  assert.equal(metrics.commitThreshold, 'a bounded proximity tour visiting at least three cells');
});

test('SVG v037 is registered exactly once for the 2026-10-26 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-26');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-26');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v037/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-26');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-25');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-26/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-26"/);
});
