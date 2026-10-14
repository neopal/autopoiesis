import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v031/engine.mjs';

test('Brush v031 begins as one deterministic looped paint ribbon', async () => {
  const { buildFrame, geometrySignature, SEGMENT_COUNT } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const replay = buildFrame(0, []);

  assert.equal(frame.grammar, 'negative-ribbon');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.segments.length, SEGMENT_COUNT);
  assert.equal(frame.segments.every((segment) => segment.points.length === 4), true);
  assert.equal(frame.segmentPaths.length, SEGMENT_COUNT);
  assert.equal(frame.segmentPaths.every((path) => path.startsWith('M') && path.endsWith('Z')), true);
  assert.equal(geometrySignature(frame), geometrySignature(replay));
});

test('Brush v031 refuses the offered mark and stores one remote negative stroke', async () => {
  const { applyStroke, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const stroke = {
    start: { x: 0.18, y: 0.72 },
    end: { x: 0.42, y: 0.34 },
    duration: 260
  };
  const changed = applyStroke(frame, stroke, 'pointer-stroke');

  assert.equal(changed.interaction, 'stroke-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'negative-stroke');
  assert.ok(changed.erodedCount > 0);
  assert.ok(changed.swollenCount > 0);
  assert.ok(changed.scarredCount > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
  assert.ok(changed.lastStroke.cutIndex !== changed.lastStroke.entryIndex);
  assert.ok(changed.lastStroke.swellIndex !== changed.lastStroke.cutIndex);
  assert.ok(changed.lastStroke.scarIndex !== changed.lastStroke.swellIndex);
});

test('Brush v031 refuses weak, over-held, and still offers, while lifting restores exact geometry', async () => {
  const { MAX_STROKE_MS, MEMORY_LIMIT, MIN_STROKE_MS, applyStroke, buildFrame, geometrySignature, liftLatestStroke, releaseStrokes } = await import(engineUrl);
  const strokeA = { start: { x: 0.18, y: 0.72 }, end: { x: 0.42, y: 0.34 }, duration: 260 };
  let frame = buildFrame(0, []);

  assert.equal(applyStroke(frame, { ...strokeA, duration: MIN_STROKE_MS - 1 }).interaction, 'stroke-refused-weak');
  assert.equal(applyStroke(frame, { ...strokeA, duration: MAX_STROKE_MS + 1 }).interaction, 'stroke-refused-overheld');
  assert.equal(applyStroke(frame, { ...strokeA, end: { x: 0.19, y: 0.73 } }).interaction, 'stroke-refused-still');

  frame = applyStroke(frame, strokeA);
  const beforeSecond = geometrySignature(frame);
  frame = applyStroke(frame, { start: { x: 0.78, y: 0.31 }, end: { x: 0.53, y: 0.72 }, duration: 420 });
  assert.equal(frame.memory.length, 2);
  assert.notEqual(geometrySignature(frame), beforeSecond);

  const lifted = liftLatestStroke(frame);
  assert.equal(geometrySignature(lifted), beforeSecond);
  assert.equal(releaseStrokes(frame).memory.length, 0);

  for (let index = 0; index < 5; index += 1) {
    frame = applyStroke(frame, { start: { x: 0.18 + index * 0.12, y: 0.72 }, end: { x: 0.42, y: 0.34 + index * 0.08 }, duration: 180 + index * 50 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
});

test('Brush v031 keeps the negative stroke deterministic and refuses duplicate offers', async () => {
  const { applyStroke, buildFrame, buildTimeline, geometrySignature } = await import(engineUrl);
  const stroke = { start: { x: 0.18, y: 0.72 }, end: { x: 0.42, y: 0.34 }, duration: 260 };
  const frame = applyStroke(buildFrame(), stroke);
  const repeated = applyStroke(frame, stroke);
  const timelineA = buildTimeline();
  const timelineB = buildTimeline();

  assert.equal(repeated.interaction, 'stroke-refused-repeat');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(frame));
  assert.equal(timelineA.length, 13);
  assert.equal(geometrySignature(timelineA.at(-1)), geometrySignature(timelineB.at(-1)));
  assert.equal(timelineA.at(-1).memory.length, 4);
  assert.ok(timelineA.at(-1).erodedCount > 0);
});

test('Brush v031 has an executable art-gate surface, blind mode, and responsive controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v031/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v031/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v031/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v031/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v031/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v031/critiques.json', root), 'utf8'));

  assert.match(index, /id="negative-field"/);
  assert.match(index, /data-gesture="offer"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /applyStroke/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /stroke-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D negative-ribbon loop');
  assert.equal(critiques.length, 6);
});

test('Brush v031 is registered exactly once for the 2026-10-14 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-14');
  const canonical = await readFile(new URL('works/brush-2026-10-14/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-14');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v031/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-14');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-13');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /negative|remote|ribbon/i);
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-14"/);
});
