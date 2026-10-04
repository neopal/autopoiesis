import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FACET_COUNT,
  MEMORY_LIMIT,
  applyAttention,
  buildFrame,
  geometrySignature,
  removeLatestAttention
} = await import('../studies/pure-svg/v022/engine.mjs');

test('SVG v022 begins as one faceted folding object, not a ribbon, contour, or radial valve', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'folding-object');
  assert.equal(frame.facets.length, FACET_COUNT);
  assert.equal(frame.facets.every((facet) => facet.points.length === 4), true);
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.object.closed, true);
  assert.equal('ribbon' in frame, false);
  assert.equal('contour' in frame, false);
  assert.equal('channels' in frame, false);
});

test('SVG v022 translates reciprocal attention into an approach-departure edge exchange', () => {
  const frame = buildFrame(0, []);
  const next = applyAttention(frame, 1, 0.84);
  const replay = applyAttention(frame, 1, 0.84);
  const restored = removeLatestAttention(next);

  assert.equal(next.attention.gesture, 'approach-departure');
  assert.equal(next.attention.mode, 'edge-exchange');
  assert.equal(next.attention.source, 1);
  assert.equal(next.facets[1].role, 'turning-away');
  assert.equal(next.facets[4].role, 'answering');
  assert.notEqual(next.object.pathSignature, frame.object.pathSignature);
  assert.notEqual(next.facets[1].pathSignature, frame.facets[1].pathSignature);
  assert.notEqual(next.facets[4].pathSignature, frame.facets[4].pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v022 keeps edge-exchange memory bounded and changes the next answering facet', () => {
  let frame = buildFrame(0, []);
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    frame = applyAttention(frame, index % FACET_COUNT, 0.75 + index * 0.03);
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.memory.every((event) => event.gesture === 'approach-departure'), true);
  assert.notEqual(frame.memory[0].source, frame.memory.at(-1).remote);
  assert.ok(frame.facets.some((facet) => facet.role === 'answering'));
});

test('SVG v022 exposes a tableau-first study and honest daily record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v022/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v022/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v022/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v022/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v022/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/pure-svg/v022/critiques.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /removeLatestAttention/);
  assert.match(sketch, /approach-departure/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.facet/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG folding object');
  assert.equal(critiques.length, 5);
});

test('SVG v022 is registered exactly once for the 2026-10-04 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-04');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-04');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v022/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-04');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-03');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /edge|facet|answer/i);

  const canonical = await readFile(new URL('works/svg-2026-10-04/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-04"/);
});
