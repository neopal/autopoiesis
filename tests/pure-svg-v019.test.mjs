import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CHANNEL_COUNT,
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyPressure,
  buildFrame,
  buildTimeline,
  geometrySignature,
  removeLatestPressure
} = await import('../studies/pure-svg/v019/engine.mjs');

test('SVG v019 changes from disjoint plates to one radial pressure valve', () => {
  const frame = buildTimeline()[STAGES - 1];

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.channels.length, CHANNEL_COUNT);
  assert.equal(frame.grammar, 'pressure-valve-stack');
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
  assert.ok(frame.channels.every((channel) => channel.closed === true));
  assert.ok(frame.channels.some((channel) => channel.role === 'pressure-flipped'));
  assert.ok(frame.channels.some((channel) => channel.aperture === true));
  assert.ok(frame.paintOrder.some((index, order) => index !== order));
  assert.equal('plates' in frame, false);
  assert.equal('links' in frame, false);
});

test('SVG v019 turns a global pressure event into changed occlusion and geometry', () => {
  const frame = buildFrame(5, []);
  const next = applyPressure(frame);
  const replay = applyPressure(frame);
  const restored = removeLatestPressure(next);

  assert.equal(next.memory.length, 1);
  assert.equal(next.memory.at(-1).source, 'visitor-pressure');
  assert.equal(next.memory.at(-1).mode, 'order-inversion');
  assert.notEqual(next.paintOrder.join(','), frame.paintOrder.join(','));
  assert.ok(next.channels[next.flippedIndex].role === 'pressure-flipped');
  assert.ok(next.channels[next.apertureIndex].aperture === true);
  assert.notEqual(next.channels[next.flippedIndex].pathSignature, frame.channels[next.flippedIndex].pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v019 bounds pressure history and replays the latest fold exactly', () => {
  let frame = buildFrame(4, []);
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) frame = applyPressure(frame);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.pressureCount, MEMORY_LIMIT);
  const lifted = removeLatestPressure(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
});

test('SVG v019 exposes a tableau-first pressure-valve browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v019/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v019/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v019/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v019/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v019/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="pressure"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /removeLatestPressure/);
  assert.match(sketch, /order-inversion/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.channel--pressure-flipped/);
  assert.match(style, /\.channel--aperture/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG pressure valve');
});

test('SVG v019 is registered exactly once for the 2026-10-01 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-01');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-01');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v019/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-01');
  assert.equal(matches[0].decision.lineage, 'svg-2026-09-27');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.memoryRule, 'a global pressure event flips one channel behind the stack, opens a real aperture, and changes the paint order for later channels');

  const canonical = await readFile(new URL('works/svg-2026-10-01/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-01"/);
});
