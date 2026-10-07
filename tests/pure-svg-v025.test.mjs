import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  STATION_COUNT,
  applyDrawnSpan,
  armStation,
  buildFrame,
  geometrySignature,
  liftLatestCut,
  releaseBoundary
} = await import('../studies/pure-svg/v025/engine.mjs');

test('SVG v025 begins as one broken open contour with a movable rupture', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'broken-contour');
  assert.equal(frame.stations.length, STATION_COUNT);
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.boundary.closed, false);
  assert.equal(frame.boundary.fill, 'none');
  assert.equal(frame.boundary.pathCount, 1);
  assert.equal(frame.boundary.subpathCount, 1);
  assert.equal(frame.boundary.gapAt, 0);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
  assert.equal('ports' in frame, false);
  assert.equal('chambers' in frame, false);
  assert.equal('knot' in frame, false);
});

test('SVG v025 arms a station without writing and commits only a continuous drawn span', () => {
  const frame = buildFrame(0, []);
  const armed = armStation(frame, 1);
  const refused = applyDrawnSpan(armed, 1, 1);
  const next = applyDrawnSpan(armed, 1, 4);
  const replay = applyDrawnSpan(armed, 1, 4);
  const restored = liftLatestCut(next);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed, 1);
  assert.equal(geometrySignature(armed), geometrySignature(frame));
  assert.equal(refused.span.committed, false);
  assert.equal(refused.interaction, 'same-station-refused');
  assert.equal(refused.memory.length, 0);
  assert.equal(next.span.gesture, 'drawn-span');
  assert.equal(next.span.mode, 'rupture-transfer');
  assert.equal(next.span.source, 1);
  assert.equal(next.span.target, 4);
  assert.equal(next.span.committed, true);
  assert.equal(next.boundary.gapAt, next.span.relay);
  assert.notEqual(next.boundary.pathSignature, frame.boundary.pathSignature);
  assert.notEqual(next.stations[1].pathSignature, frame.stations[1].pathSignature);
  assert.notEqual(next.stations[4].pathSignature, frame.stations[4].pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v025 carries a bounded memory of transferred ruptures and releases exactly', () => {
  let frame = buildFrame(0, []);

  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    const source = index % STATION_COUNT;
    const target = (source + 2 + index) % STATION_COUNT;
    frame = applyDrawnSpan(frame, source, target);
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.memory.every((event) => event.gesture === 'drawn-span'), true);
  assert.ok(frame.memory.some((event) => event.relay !== event.source));
  assert.notEqual(frame.memory[0].source, frame.memory.at(-1).source);
  assert.equal(geometrySignature(releaseBoundary()), geometrySignature(buildFrame(0, [])));
});

test('SVG v025 timeline is deterministic and changes the open contour without becoming a filled object', () => {
  const first = buildFrame(STAGES - 1, [
    { source: 0, target: 3, relay: 5, force: 1.1, stage: 6, ordinal: 0 },
    { source: 2, target: 5, relay: 1, force: 1.18, stage: 9, ordinal: 1 }
  ]);
  const second = buildFrame(STAGES - 1, [
    { source: 0, target: 3, relay: 5, force: 1.1, stage: 6, ordinal: 0 },
    { source: 2, target: 5, relay: 1, force: 1.18, stage: 9, ordinal: 1 }
  ]);

  assert.deepEqual(first, second);
  assert.equal(first.boundary.closed, false);
  assert.equal(first.boundary.fill, 'none');
  assert.equal(first.boundary.pathCount, 1);
  assert.notEqual(first.boundary.gapAt, 0);
});

test('SVG v025 exposes a tableau-first study and explicit art-gate evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v025/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v025/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v025/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v025/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v025/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/pure-svg/v025/critiques.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="draw"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /getScreenCTM/);
  assert.match(sketch, /applyDrawnSpan/);
  assert.match(sketch, /drawn-span/);
  assert.match(sketch, /render\(frozen \? timeline\.at\(-1\) : timeline\[0\]\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.boundary/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG broken-contour');
  assert.equal(critiques.length, 5);
});

test('SVG v025 is registered exactly once for the 2026-10-07 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-07');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-07');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v025/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-07');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-06');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /rupture|draw|contour/i);

  const canonical = await readFile(new URL('works/svg-2026-10-07/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-07"/);
});
