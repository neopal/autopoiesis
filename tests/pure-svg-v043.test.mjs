import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STRAND_COUNT,
  ZONE_COUNT,
  MEMORY_WINDOW,
  buildFrame,
  buildTimeline,
  beginPass,
  commitPass,
  geometrySignature,
  liftLatestPass,
  releaseLoom,
  sampleZone
} = await import('../studies/pure-svg/v043/engine.mjs');

test('SVG v043 builds a deterministic pressure loom with a continuous material grammar', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'pressure-loom');
  assert.equal(first.strands.length, STRAND_COUNT);
  assert.equal(first.zones.length, ZONE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.strands.every((strand) => strand.signature.length > 40));
  assert.ok(first.strands.every((strand) => strand.points.length >= 8));
});

test('SVG v043 keeps a material pass geometry-neutral until a full pressure crossing is released', () => {
  const initial = buildFrame();
  const started = beginPass(initial, 0);
  const crossed = sampleZone(sampleZone(started, 1), 2);
  const committed = commitPass(crossed);

  assert.deepEqual(crossed.pending, [0, 1, 2]);
  assert.equal(crossed.interaction, 'pass-ready');
  assert.equal(geometrySignature(crossed), geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'pass-committed');
  assert.equal(committed.event.type, 'pressure-shear');
  assert.deepEqual(committed.event.sourceZones, [0, 1, 2]);
  assert.ok(committed.event.pressure > 0);
  assert.notEqual(geometrySignature(committed), geometrySignature(initial));
  assert.ok(committed.strands.filter((strand, index) => strand.signature !== initial.strands[index].signature).length >= 6);
});

test('SVG v043 compounds four material passes, lifts exactly, and releases to the seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestPass(settled);
  const released = releaseLoom();

  assert.equal(timeline.length, MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.passCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('SVG v043 refuses incomplete, repeated, or reversed material passes without a geometry shortcut', () => {
  const initial = buildFrame();
  const started = beginPass(initial, 1);
  const repeated = sampleZone(started, 1);
  const incomplete = commitPass(repeated);
  const reversed = sampleZone(sampleZone(beginPass(initial, 2), 1), 0);

  assert.deepEqual(repeated.pending, [1]);
  assert.equal(geometrySignature(repeated), geometrySignature(initial));
  assert.equal(incomplete.interaction, 'pass-refused-incomplete');
  assert.equal(geometrySignature(incomplete), geometrySignature(initial));
  assert.deepEqual(reversed.pending, [2, 1, 0]);
  assert.equal(reversed.interaction, 'pass-reversed');
  assert.equal(geometrySignature(reversed), geometrySignature(initial));
  assert.equal(commitPass(reversed).interaction, 'pass-refused-direction');
  assert.equal(geometrySignature(commitPass(reversed)), geometrySignature(initial));
});

test('SVG v043 is registered exactly once for the 2026-11-02 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-11-02');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-11-02');
  assert.equal(matches[0].title, 'The loom spends the pressure.');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v043/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-11-02');
  assert.equal(matches[0].decision.lineage, 'svg-2026-11-01');
  assert.equal(matches[0].source.referenceId, 'p5-brush');

  const canonical = await readFile(new URL('works/svg-2026-11-02/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-02"/);
});

test('SVG v043 exposes the production handoff and blind-preview contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v043/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v043/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v043/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v043/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v043/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="pass"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginPass/);
  assert.match(sketch, /commitPass/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG pressure loom');
  assert.equal(metrics.commitThreshold, 'one ordered three-zone pressure crossing, then release');
});
