import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v034/engine.mjs';

test('Brush v034 begins as a deterministic raster attention field', async () => {
  const { POOL_COUNT, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const replay = buildFrame(0, []);

  assert.equal(frame.grammar, 'unlooked-pigment');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.pools.length, POOL_COUNT);
  assert.ok(frame.ribbons.length >= 3);
  assert.ok(frame.pools.every((pool) => pool.points.length >= 8));
  assert.equal(geometrySignature(frame), geometrySignature(replay));
});

test('Brush v034 records proximity without changing geometry, then commits a remote absence', async () => {
  const { QUORUM_SIZE, applyObservation, buildFrame, geometrySignature } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const baseline = geometrySignature(frame);
  const indices = [0, 3, 6, 9, 11];

  for (const index of indices.slice(0, QUORUM_SIZE - 1)) {
    frame = applyObservation(frame, { x: frame.pools[index].cx, y: frame.pools[index].cy }, 'pointer-attention');
    assert.equal(frame.interaction, 'attention-held');
    assert.equal(geometrySignature(frame), baseline);
  }

  frame = applyObservation(frame, { x: frame.pools[indices.at(-1)].cx, y: frame.pools[indices.at(-1)].cy }, 'pointer-attention');
  assert.equal(frame.interaction, 'attention-committed');
  assert.equal(frame.memory.length, 1);
  assert.equal(frame.memory[0].kind, 'attention-census');
  assert.equal(frame.lastEvent.observed.length, QUORUM_SIZE);
  assert.ok(frame.lastEvent.dryIndex !== frame.lastEvent.witnessIndex);
  assert.ok(frame.lastEvent.ridgeIndex !== frame.lastEvent.dryIndex);
  assert.ok(frame.driedCount > 0);
  assert.ok(frame.ridgedCount > 0);
  assert.ok(frame.counterflowCount > 0);
  assert.notEqual(geometrySignature(frame), baseline);
});

test('Brush v034 refuses empty and duplicate attention, then lifts exact geometry', async () => {
  const { MEMORY_LIMIT, applyObservation, buildFrame, geometrySignature, liftLatestAttention, releaseAttention } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const baseline = geometrySignature(frame);

  assert.equal(applyObservation(frame, { x: 0.01, y: 0.01 }).interaction, 'attention-refused-empty');
  frame = applyObservation(frame, { x: frame.pools[2].cx, y: frame.pools[2].cy });
  assert.equal(applyObservation(frame, { x: frame.pools[2].cx, y: frame.pools[2].cy }).interaction, 'attention-refused-repeat');
  assert.equal(geometrySignature(frame), baseline);

  for (const index of [4, 7, 8, 10]) frame = applyObservation(frame, { x: frame.pools[index].cx, y: frame.pools[index].cy });
  assert.equal(frame.memory.length, 1);
  const committed = geometrySignature(frame);
  assert.notEqual(committed, baseline);
  assert.equal(geometrySignature(liftLatestAttention(frame)), baseline);
  assert.equal(releaseAttention(frame).memory.length, 0);

  for (let event = 0; event < MEMORY_LIMIT + 1; event += 1) {
    frame = buildFrame(frame.stage, frame.memory);
    for (const index of [0, 2, 5, 9, 12].map((value) => (value + event) % 13)) {
      frame = applyObservation(frame, { x: frame.pools[index].cx, y: frame.pools[index].cy }, 'control-census');
    }
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
});

test('Brush v034 keeps attention deterministic, rejects duplicate censuses, and exposes controls', async () => {
  const { applyObservation, buildFrame, buildTimeline, geometrySignature, nextControlCensus } = await import(engineUrl);
  const first = buildFrame(0, []);
  const event = nextControlCensus(0);
  let frame = first;
  for (const point of event.points) frame = applyObservation(frame, point, 'control-census');
  const repeated = applyObservation(frame, event.points[0], 'control-census');
  const timelineA = buildTimeline();
  const timelineB = buildTimeline();

  assert.equal(frame.interaction, 'attention-committed');
  assert.equal(repeated.interaction, 'attention-refused-repeat');
  assert.equal(geometrySignature(repeated), geometrySignature(frame));
  assert.equal(timelineA.length, 13);
  assert.equal(geometrySignature(timelineA.at(-1)), geometrySignature(timelineB.at(-1)));
  assert.equal(timelineA.at(-1).memory.length, 2);
});

test('Brush v034 has an executable attention surface, blind mode, and responsive controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v034/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v034/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v034/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v034/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v034/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v034/critiques.json', root), 'utf8'));

  assert.match(index, /id="attention-field"/);
  assert.match(index, /data-gesture="census"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /applyObservation/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /attention-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D unlooked-pigment field');
  assert.equal(critiques.length, 7);
});

test('Brush v034 is registered exactly once for the 2026-10-21 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-21');
  const canonical = await readFile(new URL('works/brush-2026-10-21/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-21');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v034/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-21');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-20');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /attention|remote|absence/i);
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-21"/);
});
