import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FAULT_COUNT,
  MEMORY_WINDOW,
  MIN_PRESSURE_MS,
  MAX_PRESSURE_MS,
  applyPressure,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestPressure,
  releaseSheet
} = await import('../studies/pure-svg/v033/engine.mjs');

test('SVG v033 makes a pressure offer change one compound sheet, not a collection of facets', () => {
  const initial = buildFrame();
  const next = applyPressure(initial, { x: 0.18, y: 0.72, duration: 320 });

  assert.equal(initial.grammar, 'resistant-crease');
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'pressure-redistribution');
  assert.equal(next.faults.length, FAULT_COUNT);
  assert.ok(next.sheetPath !== initial.sheetPath, 'the compound sheet path must change');
  assert.ok(next.faults.filter((fault) => fault.role !== 'quiet').length >= 3);
  assert.notEqual(next.event.sourceFault, next.event.counterFault);
  assert.notEqual(next.event.sourceFault, next.event.scarFault);
});

test('SVG v033 refuses weak and over-held pressure, then lifts exactly', () => {
  const initial = buildFrame();
  const weak = applyPressure(initial, { x: 0.2, y: 0.7, duration: MIN_PRESSURE_MS - 1 });
  const held = applyPressure(initial, { x: 0.2, y: 0.7, duration: MAX_PRESSURE_MS + 1 });
  assert.equal(weak.memory.length, 0);
  assert.equal(weak.interaction, 'pressure-refused-weak');
  assert.equal(held.memory.length, 0);
  assert.equal(held.interaction, 'pressure-refused-held');

  const committed = applyPressure(initial, { x: 0.2, y: 0.7, duration: 320 });
  const lifted = liftLatestPressure(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v033 is deterministic, bounded, and inherits pressure memory', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.faults.length, FAULT_COUNT);
  assert.deepEqual(buildTimeline(), timeline);

  const repeated = applyPressure(buildFrame(), { x: 0.66, y: 0.31, duration: 480 });
  assert.deepEqual(repeated, applyPressure(buildFrame(), { x: 0.66, y: 0.31, duration: 480 }));
  assert.notEqual(settled.sheetPath, buildFrame().sheetPath);
});

test('SVG v033 release clears the material ledger without changing the seed', () => {
  const settled = buildTimeline().at(-1);
  const released = releaseSheet();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(settled), geometrySignature(released));
});

test('SVG v033 exposes a tableau-first pressure encounter with a quiet blind mode', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v033/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v033/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v033/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v033/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v033/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="pressure"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /duration/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG resistant-crease sheet');
  assert.equal(metrics.commitThreshold, 'bounded pressure duration');
});

test('SVG v033 is registered exactly once for the 2026-10-21 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-21');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-21');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v033/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-21');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-20');
  assert.equal(matches[0].source.referenceId, 'p5-brush');

  const canonical = await readFile(new URL('works/svg-2026-10-21/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-21"/);
});
