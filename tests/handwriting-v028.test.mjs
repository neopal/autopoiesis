import test from 'node:test';
import assert from 'node:assert/strict';

test('handwriting v028 makes a two-counter reply change actual letter bodies', async () => {
  const { buildFrame, armCounter, commitReply, geometrySignature } = await import('../studies/handwriting/v028/engine.mjs');
  const baseline = buildFrame(0, []);
  const armed = armCounter(baseline, { source: 1 });
  const refused = commitReply(armed, { target: 1 });
  const changed = commitReply(armed, { target: 9 });

  assert.equal(armed.material.lastEvent, 'armed');
  assert.equal(refused.memory.length, 0);
  assert.equal(refused.material.lastEvent, 'refused');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.material.lastEvent, 'replied');
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(changed.memory[0].sourceIndex, 1);
  assert.equal(changed.memory[0].targetIndex, 9);
  assert.notEqual(changed.glyphs[1].text, baseline.glyphs[1].text);
  assert.notEqual(changed.glyphs[9].text, baseline.glyphs[9].text);
  assert.notEqual(changed.glyphs[changed.memory[0].relayIndex].x, baseline.glyphs[changed.memory[0].relayIndex].x);
});

test('the counter ledger is bounded and deterministic from the same two-gap offers', async () => {
  const { MEMORY_LIMIT, buildFrame, armCounter, commitReply, geometrySignature } = await import('../studies/handwriting/v028/engine.mjs');
  const offers = [[0, 7], [3, 10], [6, 2], [9, 4], [1, 8]];
  const play = () => offers.reduce((frame, [source, target]) => commitReply(armCounter(frame, { source }), { target }), buildFrame(0, []));
  const first = play();
  const repeat = play();

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.memory.length, 4);
  assert.equal(first.material.replyCount, 5);
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.match(first.material.custody, /^[a-z]{4}$/);
});

test('lifting the latest counter reply restores the exact preceding typographic body', async () => {
  const { buildFrame, armCounter, commitReply, liftLatestReply, geometrySignature } = await import('../studies/handwriting/v028/engine.mjs');
  const baseline = buildFrame(0, []);
  const first = commitReply(armCounter(baseline, { source: 0 }), { target: 7 });
  const changed = commitReply(armCounter(first, { source: 4 }), { target: 10 });

  const lifted = liftLatestReply(changed);
  assert.equal(lifted.memory.length, 1);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
});
