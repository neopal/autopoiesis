import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  commitPressure,
  geometrySignature,
  liftLatestPressure,
  releaseMemory,
  pressureIsValid,
  ZONE_COUNT,
  MEMORY_WINDOW,
  MIN_DWELL
} = await import('../studies/naive-art/v030/engine.mjs');

test('naive v030 begins as one deterministic pressure slab, not a field of parts', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'pressure-slab');
  assert.equal(first.memory.length, 0);
  assert.equal(first.surface.closed, true);
  assert.equal(first.surface.boundary.length, 18);
  assert.equal(first.surface.seams.length, 5);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('naive v030 refuses a light press and commits only a sustained material load', () => {
  const base = buildFrame();
  const shallow = commitPressure(base, { zone: 2, dwell: MIN_DWELL - 1, intensity: 0.9 });
  const loaded = commitPressure(base, { zone: 2, dwell: MIN_DWELL + 180, intensity: 0.9 });

  assert.equal(pressureIsValid({ zone: 2, dwell: MIN_DWELL - 1, intensity: 0.9 }), false);
  assert.equal(shallow.interaction, 'pressure-refused-light');
  assert.equal(shallow.memory.length, 0);
  assert.equal(geometrySignature(shallow), geometrySignature(base));
  assert.equal(loaded.interaction, 'pressure-committed');
  assert.equal(loaded.memory.length, 1);
  assert.notEqual(geometrySignature(loaded), geometrySignature(base));
  assert.ok(loaded.surface.changedBoundaryIds.length >= 3);
  assert.ok(loaded.surface.remoteZone !== 2);
});

test('naive v030 carries pressure into later geometry and lifts exactly', () => {
  let state = buildFrame();
  const first = commitPressure(state, { zone: 1, dwell: MIN_DWELL + 120, intensity: 0.76 });
  const second = commitPressure(first, { zone: 5, dwell: MIN_DWELL + 240, intensity: 0.62 });
  const lifted = liftLatestPressure(second);

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(first));
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(lifted.memory.length, 1);
});

test('naive v030 pressure memory is bounded, deterministic, and releasable', () => {
  let a = buildFrame();
  let b = buildFrame();
  for (let index = 0; index < MEMORY_WINDOW + 2; index += 1) {
    const gesture = { zone: index % ZONE_COUNT, dwell: MIN_DWELL + 90 + index, intensity: 0.55 + index * 0.04 };
    a = commitPressure(a, gesture);
    b = commitPressure(b, gesture);
  }

  assert.equal(a.memory.length, MEMORY_WINDOW);
  assert.deepEqual(a.memory, b.memory);
  assert.equal(geometrySignature(a), geometrySignature(b));
  const released = releaseMemory(a);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
});
