import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FRAGMENT_COUNT,
  MEMORY_LIMIT,
  applyDeparture,
  attendFragment,
  buildFrame,
  geometrySignature,
  liftLatestDeparture
} = await import('../studies/pure-svg/v026/engine.mjs');

test('SVG v026 begins as a discrete choir of filled fragments, not a boundary', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'discrete-choir');
  assert.equal(frame.tiles.length, FRAGMENT_COUNT);
  assert.equal(frame.tiles.every((tile) => tile.points.length >= 5), true);
  assert.equal(frame.tiles.every((tile) => tile.role === 'quiet'), true);
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.primitiveBudget, FRAGMENT_COUNT);
  assert.equal('boundary' in frame, false);
  assert.equal('contour' in frame, false);
  assert.equal('stations' in frame, false);
  assert.equal('chambers' in frame, false);
});

test('SVG v026 treats attention as temporary and departure as the structural event', () => {
  const frame = buildFrame(3, []);
  const attended = attendFragment(frame, 4);
  const departed = applyDeparture(attended, 4);
  const replay = applyDeparture(attended, 4);

  assert.equal(attended.armed, 4);
  assert.equal(attended.memory.length, 0);
  assert.equal(attended.interaction, 'attend-only');
  assert.equal(departed.departure.gesture, 'attend-then-depart');
  assert.equal(departed.departure.committed, true);
  assert.equal(departed.departure.source, 4);
  assert.notEqual(departed.departure.source, departed.departure.relay);
  assert.notEqual(departed.tiles[4].pathSignature, frame.tiles[4].pathSignature);
  assert.notEqual(departed.tiles[departed.departure.relay].pathSignature, frame.tiles[departed.departure.relay].pathSignature);
  assert.notEqual(departed.tiles[departed.departure.echo].pathSignature, frame.tiles[departed.departure.echo].pathSignature);
  assert.deepEqual(replay, departed);
});

test('SVG v026 bounds absence memory and lifts the latest departure exactly', () => {
  const frame = buildFrame(0, []);
  const refused = applyDeparture(frame, 2);

  assert.equal(refused.departure.committed, true);

  let changed = frame;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    changed = applyDeparture(changed, index % FRAGMENT_COUNT);
  }

  assert.equal(changed.memory.length, MEMORY_LIMIT);
  assert.equal(changed.memory.every((event) => event.gesture === 'attend-then-depart'), true);
  assert.ok(changed.tiles.some((tile) => tile.role === 'withdrawn'));
  assert.ok(changed.tiles.some((tile) => tile.role === 'overheard'));

  const restored = liftLatestDeparture(changed);
  assert.equal(restored.memory.length, MEMORY_LIMIT - 1);
  assert.equal(geometrySignature(restored), geometrySignature(
    buildFrame(changed.stage, changed.memory.slice(0, -1))
  ));
});

test('SVG v026 exposes a tableau-first study and honest daily record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v026/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v026/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v026/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v026/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v026/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/pure-svg/v026/critiques.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="depart"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /id="lift-control"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyDeparture/);
  assert.match(sketch, /attend-then-depart/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.fragment/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG discrete choir');
  assert.equal(critiques.length, 5);
});

test('SVG v026 is registered exactly once for the 2026-10-08 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-08');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-08');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v026/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-08');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-07');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /departure|absence|choir/i);

  const canonical = await readFile(new URL('works/svg-2026-10-08/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-08"/);
});
