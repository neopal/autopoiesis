import test from 'node:test';
import assert from 'node:assert/strict';

test('handwriting v029 turns distributed attention into a collective text census', async () => {
  const {
    buildFrame,
    geometrySignature,
    observeTile,
    takeCensus
  } = await import('../studies/handwriting/v029/engine.mjs');

  const baseline = buildFrame(0, []);
  const observed = [0, 0, 3, 7, 10, 10].reduce(
    (frame, index) => observeTile(frame, { index }),
    baseline
  );

  assert.equal(geometrySignature(observed), geometrySignature(baseline));
  assert.equal(observed.material.observationCount, 6);
  assert.equal(observed.material.distinctObserved, 4);

  const censused = takeCensus(observed);

  assert.equal(censused.material.lastEvent, 'census');
  assert.equal(censused.memory.length, 1);
  assert.notEqual(geometrySignature(censused), geometrySignature(baseline));
  assert.notDeepEqual(
    censused.tiles.map((tile) => tile.text),
    observed.tiles.map((tile) => tile.text)
  );
  assert.notEqual(censused.material.speakerIndex, censused.material.silenceIndex);
  assert.notEqual(censused.material.relayIndex, censused.material.silenceIndex);
});

test('handwriting v029 keeps census memory bounded and liftable', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    geometrySignature,
    liftLatestCensus,
    observeTile,
    takeCensus
  } = await import('../studies/handwriting/v029/engine.mjs');

  const event = (frame, offset) => {
    const observed = [0, 2, 4, 6, 8].reduce(
      (next, index) => observeTile(next, { index: (index + offset) % 12 }),
      frame
    );
    return takeCensus(observed);
  };
  const baseline = buildFrame(0, []);
  const first = event(baseline, 0);
  const second = event(first, 1);
  const third = event(second, 2);
  const fourth = event(third, 3);
  const fifth = event(fourth, 4);

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(fifth.memory.length, MEMORY_LIMIT);
  assert.equal(fifth.material.censusCount, 5);
  assert.equal(geometrySignature(fifth), geometrySignature(event(fourth, 4)));
  assert.equal(geometrySignature(liftLatestCensus(fifth)), geometrySignature(fourth));
});

test('handwriting v029 refuses a census until attention has crossed four tiles', async () => {
  const { buildFrame, geometrySignature, observeTile, takeCensus } = await import('../studies/handwriting/v029/engine.mjs');
  const baseline = buildFrame(0, []);
  const observed = [1, 1, 6].reduce(
    (frame, index) => observeTile(frame, { index }),
    baseline
  );
  const refused = takeCensus(observed);

  assert.equal(refused.material.lastEvent, 'refused');
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.material.refusedCount, 1);
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});
