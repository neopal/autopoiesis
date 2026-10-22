import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v035/engine.mjs');

const { applyTick, buildFrame, buildTimeline, geometrySignature, liftLatest, releaseMembrane } = engine;

function armThenReverse(frame, direction = 1) {
  let next = frame;
  for (let index = 0; index < 3; index += 1) next = applyTick(next, direction, 'test-arm');
  return applyTick(next, -direction, 'test-reversal');
}

test('brush v035 keeps the membrane geometrically still while a direction accumulates', () => {
  const baseline = buildFrame(0, []);
  const first = applyTick(baseline, 1, 'test-forward');
  const second = applyTick(first, 1, 'test-forward');
  const armed = applyTick(second, 1, 'test-forward');

  assert.equal(first.memory.length, 0);
  assert.equal(second.memory.length, 0);
  assert.equal(armed.memory.length, 0);
  assert.equal(armed.pending.direction, 1);
  assert.equal(armed.pending.streak, 3);
  assert.equal(geometrySignature(armed), geometrySignature(baseline));
});

test('brush v035 commits a reversal as structural membrane shear and lifts it exactly', () => {
  const baseline = buildFrame(0, []);
  const changed = armThenReverse(baseline, 1);

  assert.equal(changed.memory.length, 1);
  assert.equal(changed.interaction, 'reversal-committed');
  assert.equal(changed.event.from, 1);
  assert.equal(changed.event.to, -1);
  assert.ok(changed.shearedCount > 0);
  assert.ok(changed.voidCount > 0);
  assert.ok(changed.stainedCount > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));

  const lifted = liftLatest(changed);
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(baseline));
});

test('brush v035 timeline is deterministic and bounded to four reversal events', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const replay = buildTimeline();

  assert.equal(timeline.length, 13);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.memory.length, settled.memoryLimit);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.equal(releaseMembrane(settled).memory.length, 0);
  assert.equal(releaseMembrane(settled).pending.streak, 0);
});
