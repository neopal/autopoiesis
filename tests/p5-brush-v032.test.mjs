import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v032/engine.mjs';

test('Brush v032 begins as a deterministic bristle-weather sheet', async () => {
  const { BAND_COUNT, BRISTLE_COUNT, POINT_COUNT, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const replay = buildFrame(0, []);

  assert.equal(frame.grammar, 'bristle-weather');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.bands.length, BAND_COUNT);
  assert.equal(frame.bristleCount, BAND_COUNT * BRISTLE_COUNT);
  assert.equal(frame.bands.every((band) => band.bristles.length === BRISTLE_COUNT), true);
  assert.equal(frame.bands.every((band) => band.bristles.every((bristle) => bristle.points.length === POINT_COUNT)), true);
  assert.equal(frame.visiblePointCount > 0, true);
  assert.equal(geometrySignature(frame), geometrySignature(replay));
});

test('Brush v032 translates a local rake into remote weather roles', async () => {
  const { applyRake, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const rake = { start: { x: 0.16, y: 0.72 }, end: { x: 0.46, y: 0.28 }, duration: 320, pressure: 0.78 };
  const changed = applyRake(frame, rake, 'pointer-rake');

  assert.equal(changed.interaction, 'rake-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'weather-rake');
  assert.equal(changed.effects.length, 1);
  const effect = changed.effects[0];
  assert.notEqual(effect.remoteBand, effect.entryBand);
  assert.notEqual(effect.counterBand, effect.remoteBand);
  assert.notEqual(effect.scarBand, effect.counterBand);
  assert.ok(changed.shearedCount > 0);
  assert.ok(changed.thinnedCount > 0);
  assert.ok(changed.swollenCount > 0);
  assert.ok(changed.scoredCount > 0);
  assert.ok(changed.visiblePointCount < frame.visiblePointCount);
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
});

test('Brush v032 refuses weak, over-held, and still rakes, then lifts exactly', async () => {
  const { MAX_RAKE_MS, MEMORY_LIMIT, MIN_RAKE_MS, applyRake, buildFrame, geometrySignature, liftLatestRake, releaseRakes } = await import(engineUrl);
  const rake = { start: { x: 0.16, y: 0.72 }, end: { x: 0.46, y: 0.28 }, duration: 320, pressure: 0.78 };
  let frame = buildFrame(0, []);

  assert.equal(applyRake(frame, { ...rake, duration: MIN_RAKE_MS - 1 }).interaction, 'rake-refused-weak');
  assert.equal(applyRake(frame, { ...rake, duration: MAX_RAKE_MS + 1 }).interaction, 'rake-refused-overheld');
  assert.equal(applyRake(frame, { ...rake, end: { x: 0.17, y: 0.73 } }).interaction, 'rake-refused-still');

  frame = applyRake(frame, rake);
  const beforeSecond = geometrySignature(frame);
  frame = applyRake(frame, { start: { x: 0.78, y: 0.3 }, end: { x: 0.55, y: 0.7 }, duration: 520, pressure: 0.9 });
  assert.equal(frame.memory.length, 2);
  assert.notEqual(geometrySignature(frame), beforeSecond);
  assert.equal(geometrySignature(liftLatestRake(frame)), beforeSecond);
  assert.equal(releaseRakes(frame).memory.length, 0);

  for (let index = 0; index < 5; index += 1) {
    frame = applyRake(frame, { start: { x: 0.15 + index * 0.12, y: 0.72 }, end: { x: 0.44, y: 0.28 + index * 0.08 }, duration: 220 + index * 60, pressure: 0.55 + index * 0.08 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
});

test('Brush v032 keeps weather deterministic and refuses duplicate rakes', async () => {
  const { applyRake, buildFrame, buildTimeline, geometrySignature } = await import(engineUrl);
  const rake = { start: { x: 0.16, y: 0.72 }, end: { x: 0.46, y: 0.28 }, duration: 320, pressure: 0.78 };
  const frame = applyRake(buildFrame(), rake);
  const repeated = applyRake(frame, rake);
  const timelineA = buildTimeline();
  const timelineB = buildTimeline();

  assert.equal(repeated.interaction, 'rake-refused-repeat');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(frame));
  assert.equal(timelineA.length, 13);
  assert.equal(geometrySignature(timelineA.at(-1)), geometrySignature(timelineB.at(-1)));
  assert.equal(timelineA.at(-1).memory.length, 3);
  assert.ok(timelineA.at(-1).visiblePointCount > 0);
});

test('Brush v032 restores overflowed weather exactly and control rakes do not stall', async () => {
  const { applyRake, buildFrame, geometrySignature, liftLatestRake, nextControlRake, MEMORY_LIMIT } = await import(engineUrl);
  let frame = buildFrame();
  let beforeFourth;
  for (let cursor = 0; cursor < 4; cursor += 1) {
    if (cursor === 3) beforeFourth = geometrySignature(frame);
    const event = nextControlRake(cursor);
    frame = applyRake(frame, event, 'control-rake');
    assert.equal(frame.interaction, 'rake-committed');
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(liftLatestRake(frame)), beforeFourth);

  frame = buildFrame();
  for (let cursor = 0; cursor < 8; cursor += 1) {
    frame = applyRake(frame, nextControlRake(cursor), 'control-rake');
    assert.equal(frame.interaction, 'rake-committed');
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
});

test('Brush v032 has a first-render material surface and explicit spike gate', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v032/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v032/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v032/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v032/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v032/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v032/critiques.json', root), 'utf8'));

  assert.match(index, /id="weather-field"/);
  assert.match(index, /data-gesture="rake"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /applyRake/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /rake-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D bristle-weather sheet');
  assert.equal(critiques.length, 6);
});
