import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CHAMBER_COUNT,
  MEMORY_LIMIT,
  applyDryingHold,
  buildFrame,
  geometrySignature,
  liftLatestDrying
} = await import('../studies/pure-svg/v023/engine.mjs');

test('SVG v023 begins as one compound material sheet with negative chambers', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'drying-sheet');
  assert.equal(frame.chambers.length, CHAMBER_COUNT);
  assert.equal(frame.chambers.every((chamber) => chamber.points.length >= 6), true);
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.sheet.closed, true);
  assert.equal(frame.sheet.fillRule, 'evenodd');
  assert.equal(frame.primitiveBudget, 1);
  assert.equal('facets' in frame, false);
  assert.equal('ribbon' in frame, false);
  assert.equal('contour' in frame, false);
});

test('SVG v023 translates material resistance into a dwell-threshold topology change', () => {
  const frame = buildFrame(0, []);
  const next = applyDryingHold(frame, 2, 620);
  const replay = applyDryingHold(frame, 2, 620);
  const restored = liftLatestDrying(next);

  assert.equal(next.drying.gesture, 'press-and-hold');
  assert.equal(next.drying.mode, 'topology-threshold');
  assert.equal(next.drying.source, 2);
  assert.equal(next.drying.committed, true);
  assert.equal(next.chambers[2].role, 'sealed');
  assert.equal(next.chambers[0].role, 'opened');
  assert.notEqual(next.sheet.pathSignature, frame.sheet.pathSignature);
  assert.notEqual(next.chambers[2].pathSignature, frame.chambers[2].pathSignature);
  assert.notEqual(next.chambers[0].pathSignature, frame.chambers[0].pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v023 refuses a short hold, bounds drying memory, and changes later topology', () => {
  const frame = buildFrame(0, []);
  const refused = applyDryingHold(frame, 2, 240);

  assert.equal(refused.drying.committed, false);
  assert.equal(refused.memory.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(frame));

  let changed = frame;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    changed = applyDryingHold(changed, index % CHAMBER_COUNT, 620 + index * 10);
  }

  assert.equal(changed.memory.length, MEMORY_LIMIT);
  assert.equal(changed.memory.every((event) => event.gesture === 'press-and-hold'), true);
  assert.ok(changed.chambers.some((chamber) => chamber.role === 'opened'));
  assert.notEqual(changed.memory[0].source, changed.memory.at(-1).source);
});

test('SVG v023 exposes a tableau-first study and honest daily record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v023/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v023/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v023/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v023/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v023/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/pure-svg/v023/critiques.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="dry"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyDryingHold/);
  assert.match(sketch, /press-and-hold/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.chamber/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG compound drying sheet');
  assert.equal(critiques.length, 5);
});

test('SVG v023 is registered exactly once for the 2026-10-05 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-05');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-05');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v023/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-05');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-04');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /chamber|topology|dry/i);

  const canonical = await readFile(new URL('works/svg-2026-10-05/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-05"/);
});
