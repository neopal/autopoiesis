import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/pure-svg/v027/engine.mjs';

test('Pure SVG v027 begins as a deterministic stratified material, not a fragment field', async () => {
  const { buildFrame, ROW_COUNT, SEGMENT_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'slip-strata');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.rows.length, ROW_COUNT);
  assert.equal(frame.rows.every((row) => row.top.length === SEGMENT_COUNT + 1 && row.bottom.length === SEGMENT_COUNT + 1), true);
  assert.equal(frame.rows.every((row) => row.pathSignature.length > 20), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v027 lets one pressure puncture choose a weak seam and re-form the stack', async () => {
  const { applyLoad, buildFrame } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const loaded = applyLoad(baseline, { x: 0.13, y: 0.77 });

  assert.equal(loaded.interaction, 'material-slip');
  assert.equal(loaded.memory.length, 1);
  assert.equal(loaded.event.committed, true);
  assert.ok(Number.isInteger(loaded.event.seam));
  assert.ok(loaded.rows.filter((row, index) => row.pathSignature !== baseline.rows[index].pathSignature).length >= 5);
  assert.notEqual(loaded.signature, baseline.signature);
});

test('Pure SVG v027 carries a slip into the next load and lifts the exact prior geometry', async () => {
  const { applyLoad, buildFrame, geometrySignature, liftLatestSlip } = await import(engineUrl);
  const baseline = buildFrame(4, []);
  const first = applyLoad(baseline, { x: 0.81, y: 0.18 });
  const second = applyLoad(first, { x: 0.23, y: 0.82 });
  const lifted = liftLatestSlip(second);

  assert.equal(second.memory.length, 2);
  assert.notEqual(second.event.seam, undefined);
  assert.notEqual(geometrySignature(second), geometrySignature(first));
  assert.equal(geometrySignature(lifted), geometrySignature(first));
});

test('Pure SVG v027 retains four material slips, refuses a fifth, and releases to baseline', async () => {
  const { applyLoad, buildFrame, buildTimeline, geometrySignature, releaseStrata } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const settled = buildTimeline().at(-1);
  const refused = applyLoad(settled, { x: 0.5, y: 0.5 });
  const released = releaseStrata();

  assert.equal(settled.memory.length, 4);
  assert.equal(refused.interaction, 'material-memory-full');
  assert.equal(refused.event.committed, false);
  assert.equal(geometrySignature(released), geometrySignature(baseline));
});
