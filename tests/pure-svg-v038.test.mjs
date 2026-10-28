import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FOLD_COUNT,
  MEMORY_WINDOW,
  MIN_EDGE_SEPARATION,
  applyAccord,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAccord,
  releaseField
} = await import('../studies/pure-svg/v038/engine.mjs');

const ACCORD = {
  start: { x: 0.16, y: 0.23 },
  end: { x: 0.84, y: 0.72 }
};

test('SVG v038 refuses the offered pair and produces an unoffered counterfold', () => {
  const initial = buildFrame();
  const next = applyAccord(initial, ACCORD);

  assert.equal(initial.grammar, 'counterfold');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'edge-accord');
  assert.equal(next.folds.length, FOLD_COUNT);
  assert.ok(next.event.startFold !== next.event.endFold);
  assert.ok(![next.event.startFold, next.event.endFold].includes(next.event.counterFold));
  assert.ok(next.event.separation >= MIN_EDGE_SEPARATION);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.ok(next.folds.filter((fold) => fold.role !== 'quiet').length >= 3);
  assert.ok(!geometrySignature(next).includes('0.16 0.23'));
});

test('SVG v038 refuses one-edge and near-pair offers, then lifts the exact prior accord', () => {
  const initial = buildFrame();
  const oneEdge = applyAccord(initial, { start: { x: 0.16, y: 0.23 } });
  const nearPair = applyAccord(initial, { start: { x: 0.42, y: 0.45 }, end: { x: 0.44, y: 0.46 } });

  assert.equal(oneEdge.memory.length, 0);
  assert.equal(oneEdge.interaction, 'accord-refused-incomplete');
  assert.equal(nearPair.memory.length, 0);
  assert.equal(nearPair.interaction, 'accord-refused-near');

  const committed = applyAccord(initial, ACCORD);
  const lifted = liftLatestAccord(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v038 preserves deterministic four-accord memory and releases to the seed field', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.folds.length, FOLD_COUNT);
  assert.ok(settled.state.counterfoldCount > 0);
  assert.deepEqual(buildTimeline(), timeline);
  assert.deepEqual(applyAccord(buildFrame(), ACCORD), applyAccord(buildFrame(), ACCORD));

  const released = releaseField();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(settled), geometrySignature(released));
});

test('SVG v038 exposes a tableau-first two-edge encounter and honest production metadata', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v038/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v038/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v038/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v038/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v038/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="accord"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyAccord/);
  assert.match(sketch, /start/);
  assert.match(sketch, /end/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG counterfold field');
  assert.equal(metrics.commitThreshold, 'a bounded two-edge accord with separated edge folds');
});

test('SVG v038 is registered exactly once for the 2026-10-28 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-28');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-28');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v038/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-28');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-26');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-28/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-28"/);
});
