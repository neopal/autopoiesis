import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CLAUSE_COUNT,
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyConstraint,
  buildFrame,
  buildTimeline,
  geometrySignature,
  removeLatestConstraint
} = await import('../studies/pure-svg/v020/engine.mjs');

test('SVG v020 changes the radial valve and plate grammars into one compound contour', () => {
  const frame = buildTimeline()[STAGES - 1];

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.clauses.length, CLAUSE_COUNT);
  assert.equal(frame.grammar, 'single-contour-constraint');
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
  assert.ok(frame.contour.closed);
  assert.ok(frame.pockets.length >= 2);
  assert.ok(frame.clauses.some((clause) => clause.role === 'contour-reply'));
  assert.ok(frame.clauses.some((clause) => clause.role === 'negative-pocket'));
  assert.equal('channels' in frame, false);
  assert.equal('plates' in frame, false);
  assert.equal('paintOrder' in frame, false);
});

test('SVG v020 turns a chosen constraint into contour topology and exact replay', () => {
  const frame = buildFrame(5, []);
  const next = applyConstraint(frame, 4);
  const replay = applyConstraint(frame, 4);
  const restored = removeLatestConstraint(next);

  assert.equal(next.memory.length, 1);
  assert.equal(next.memory.at(-1).source, 'visitor-constraint');
  assert.equal(next.memory.at(-1).mode, 'contour-reply');
  assert.equal(next.memory.at(-1).clauseIndex, 4);
  assert.equal(next.clauses[4].role, 'contour-reply');
  assert.ok(next.pockets.some((pocket) => pocket.sourceClause === 4));
  assert.notEqual(next.contour.pathSignature, frame.contour.pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v020 bounds constraint memory and lifts the latest rule', () => {
  let frame = buildFrame(4, []);
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) frame = applyConstraint(frame);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.constraintCount, MEMORY_LIMIT);
  const lifted = removeLatestConstraint(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
});

test('SVG v020 exposes a tableau-first compound-contour browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v020/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v020/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v020/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v020/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v020/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="constraint"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyConstraint/);
  assert.match(sketch, /removeLatestConstraint/);
  assert.match(sketch, /contour-reply/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.contour--contour-reply/);
  assert.match(style, /\.pocket/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG compound contour');
});

test('SVG v020 is registered exactly once for the 2026-10-02 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-02');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-02');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v020/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-02');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-01');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /constraint|contour|pocket/i);

  const canonical = await readFile(new URL('works/svg-2026-10-02/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-02"/);
});
