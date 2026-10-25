import test from 'node:test';
import assert from 'node:assert/strict';

const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const loadEngine = () => import('../studies/handwriting/v033/engine.mjs');

test('handwriting v033 builds a deterministic material alphabet with negative wells', async () => {
  const { buildFrame, geometrySignature, GLYPH_COUNT, WELL_COUNT } = await loadEngine();
  const first = buildFrame([]);
  const second = buildFrame([]);

  assert.equal(GLYPH_COUNT, 11);
  assert.equal(WELL_COUNT, 5);
  assert.equal(first.glyphs.length, GLYPH_COUNT);
  assert.equal(first.wells.length, WELL_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.glyphs.every((glyph) => glyph.glyph && Number.isFinite(glyph.x) && Number.isFinite(glyph.y)));
  assert.ok(first.wells.every((well) => well.role === 'negative'));
});

test('handwriting v033 lets the first well load stay geometry-neutral', async () => {
  const { buildFrame, loadWell, geometrySignature } = await loadEngine();
  const baseline = buildFrame([]);
  const loaded = loadWell(baseline, 1);

  assert.deepEqual(loaded.span, [1]);
  assert.equal(loaded.lastEvent, 'loading');
  assert.equal(geometrySignature(loaded), geometrySignature(baseline));
  assert.equal(loaded.memory.length, 0);
});

test('handwriting v033 commits a gap span into a remote pressure fold', async () => {
  const { buildFrame, loadWell, commitSpan, geometrySignature, GAP_LENGTH } = await loadEngine();
  const baseline = buildFrame([]);
  let frame = loadWell(baseline, 0);
  frame = loadWell(frame, 3);
  const committed = commitSpan(frame);

  assert.equal(GAP_LENGTH, 2);
  assert.deepEqual(committed.memory[0].wells, [0, 3]);
  assert.equal(committed.span.length, 0);
  assert.equal(committed.lastEvent, 'fold');
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.ok(committed.changedGlyphIds.length >= 5);
  assert.ok(committed.folds.length === 1);
  assert.ok(committed.glyphs.some((glyph) => glyph.role === 'counterform' && glyph.blank));
  assert.ok(committed.glyphs.some((glyph) => glyph.role === 'inheritance' && glyph.inheritedFrom !== null));
});

test('handwriting v033 refuses repeated, adjacent, or incomplete wells without a structural mutation', async () => {
  const { buildFrame, loadWell, commitSpan, geometrySignature } = await loadEngine();
  const baseline = buildFrame([]);

  let repeated = loadWell(loadWell(baseline, 2), 2);
  assert.equal(repeated.lastEvent, 'refused');
  assert.equal(geometrySignature(repeated), geometrySignature(baseline));

  let adjacent = loadWell(loadWell(baseline, 1), 2);
  adjacent = commitSpan(adjacent);
  assert.equal(adjacent.lastEvent, 'refused');
  assert.equal(adjacent.memory.length, 0);
  assert.equal(geometrySignature(adjacent), geometrySignature(baseline));

  const incomplete = commitSpan(loadWell(baseline, 4));
  assert.equal(incomplete.lastEvent, 'refused');
  assert.equal(geometrySignature(incomplete), geometrySignature(baseline));
});

test('handwriting v033 lifts the latest fold exactly and compounds four material memories deterministically', async () => {
  const { buildFrame, loadWell, commitSpan, liftLatestSpan, geometrySignature, MEMORY_WINDOW } = await loadEngine();
  const spans = [[0, 3], [1, 4], [0, 4], [2, 4], [0, 2]];
  let frame = buildFrame([]);
  for (const [from, to] of spans) frame = commitSpan(loadWell(loadWell(frame, from), to));

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.deepEqual(frame.memory.map((event) => event.wells), spans.slice(-MEMORY_WINDOW));
  const lifted = liftLatestSpan(frame);
  assert.equal(lifted.memory.length, MEMORY_WINDOW);

  let replay = buildFrame([]);
  for (const [from, to] of spans.slice(0, -1)) replay = commitSpan(loadWell(loadWell(replay, from), to));
  assert.equal(geometrySignature(lifted), geometrySignature(replay));
});

test('handwriting v033 exposes an SVG material tableau before explanation', async () => {
  const html = await read('studies/handwriting/v033/index.html');
  const sketch = await read('studies/handwriting/v033/sketch.js');
  const style = await read('studies/handwriting/v033/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-10-25"/);
  assert.match(html, /<figure[^>]+class="material-work artwork-frame"/);
  assert.match(html, /id="material-svg"/);
  assert.match(html, /id="lift-span"/);
  assert.match(html, /id="release-span"/);
  assert.match(sketch, /loadWell/);
  assert.match(sketch, /commitSpan/);
  assert.match(sketch, /liftLatestSpan/);
  assert.match(sketch, /__mutineHandwritingV033/);
  assert.match(style, /preview-mode/);
});

test('handwriting v033 keeps an explicit radical art gate and one daily catalogue record', async () => {
  const readme = await read('studies/handwriting/v033/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v033/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v033/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-25');

  for (const heading of ['## Hypothesis', '## Changed rule', '## Visible consequence', '## Falsifier', '## Deletion condition', '## Radical progression gate']) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(metrics.seed, '0x48574933');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.ok(Array.isArray(critiques) && critiques.length >= 7);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-10-25');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v033/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-10-25');
  const workHtml = await read('works/typography-2026-10-25/index.html');
  assert.match(workHtml, /data-catalog-work-detail="typography-2026-10-25"/);
});

 test('handwriting v033 QA proof summary has the required release fields', async () => {
  const summary = JSON.parse(await read('research/qa/proofs/handwriting-v033-2026-10-25/qa-summary.json'));
  assert.equal(summary.localViewportRuns, 20);
  assert.equal(summary.productionViewportRuns, 20);
  assert.equal(summary.diagnosticCount, 0);
  assert.equal(summary.overflowCount, 0);
  assert.equal(summary.interaction.committedMemory, 1);
  assert.equal(summary.interaction.liftRestored, true);
  assert.equal(summary.blind.memory, 4);
  assert.equal(summary.production.registryMatches, 1);
});
