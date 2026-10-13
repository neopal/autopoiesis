import test from 'node:test';
import assert from 'node:assert/strict';

test('handwriting v027 makes sustained global pressure yield space to a remote word', async () => {
  const { buildFrame, commitPressure, geometrySignature } = await import('../studies/handwriting/v027/engine.mjs');
  const baseline = buildFrame(0, []);
  const refused = commitPressure(baseline, { duration: 0.18 });
  const changed = commitPressure(baseline, { duration: 0.82 });

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.material.lastEvent, 'refused');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.material.lastEvent, 'pressed');
  assert.notEqual(changed.memory[0].reliefIndex, changed.memory[0].keystoneIndex);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.notEqual(changed.bands[changed.memory[0].keystoneIndex].tracking, baseline.bands[changed.memory[0].keystoneIndex].tracking);
  assert.notEqual(changed.bands[changed.memory[0].reliefIndex].tracking, baseline.bands[changed.memory[0].reliefIndex].tracking);
});

test('the pressure ledger is bounded and replayable from duration alone', async () => {
  const { MEMORY_LIMIT, buildFrame, commitPressure, geometrySignature } = await import('../studies/handwriting/v027/engine.mjs');
  const durations = [0.82, 0.57, 0.94, 0.66, 0.79];
  const first = durations.reduce((frame, duration) => commitPressure(frame, { duration }), buildFrame(0, []));
  const repeat = durations.reduce((frame, duration) => commitPressure(frame, { duration }), buildFrame(0, []));

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.memory.length, 4);
  assert.equal(first.material.pressureCount, 5);
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.match(first.material.custody, /^[a-z]{4}$/);
});

test('lifting the latest pressure restores the exact preceding typographic loom', async () => {
  const { buildFrame, commitPressure, liftLatestPressure, geometrySignature } = await import('../studies/handwriting/v027/engine.mjs');
  const baseline = buildFrame(0, []);
  const first = commitPressure(baseline, { duration: 0.74 });
  const changed = commitPressure(first, { duration: 0.88 });

  const lifted = liftLatestPressure(changed);
  assert.equal(lifted.memory.length, 1);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
});
