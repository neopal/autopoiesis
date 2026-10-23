import test from 'node:test';
import assert from 'node:assert/strict';

const {
  BAND_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  probe,
  liftLatest,
  buildTimeline
} = await import('../studies/self-portrait/v031/engine.mjs');

test('portrait v031 refuses pressure outside the calibration window', () => {
  const baseline = buildFrame(0);
  const weak = probe(baseline, { duration: 80, targetIndex: 3 });
  const overheld = probe(baseline, { duration: 880, targetIndex: 3 });

  assert.equal(weak.accepted, false);
  assert.equal(overheld.accepted, false);
  assert.equal(weak.frame.memory.length, 0);
  assert.equal(overheld.frame.memory.length, 0);
  assert.equal(geometrySignature(weak.frame), geometrySignature(baseline));
  assert.equal(geometrySignature(overheld.frame), geometrySignature(baseline));
});

test('portrait v031 translates a valid pressure hold into remote geometry', () => {
  const baseline = buildFrame(0);
  const result = probe(baseline, { duration: 260, targetIndex: 3 });
  const event = result.frame.memory.at(-1);

  assert.equal(baseline.composition, 'checksum-membrane');
  assert.equal(baseline.bands.length, BAND_COUNT);
  assert.equal(result.accepted, true);
  assert.equal(result.frame.memory.length, 1);
  assert.notEqual(geometrySignature(result.frame), geometrySignature(baseline));
  assert.notEqual(event.targetIndex, event.donorIndex);
  assert.notEqual(event.targetIndex, event.relayIndex);
  assert.notEqual(event.donorIndex, event.relayIndex);
  assert.equal(result.frame.bands[event.donorIndex].state, 'opened');
  assert.equal(result.frame.bands[event.relayIndex].state, 'inherited');
  assert.equal(result.frame.bands[event.targetIndex].state, 'shed');
});

test('portrait v031 carries pressure load forward and lifts the exact prior membrane', () => {
  const baseline = buildFrame(0);
  const first = probe(baseline, { duration: 260, targetIndex: 3 }).frame;
  const second = probe(first, { duration: 420, targetIndex: 9 }).frame;
  const lifted = liftLatest(second);

  assert.equal(second.memory.length, 2);
  assert.ok(second.load > first.load);
  assert.equal(second.snapshots.length, 2);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(lifted.interaction, 'lifted');
  assert.ok(second.memory.length <= MEMORY_LIMIT);
});

test('portrait v031 provides a deterministic settled timeline', () => {
  const timeline = buildTimeline();
  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(timeline.at(-1).memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(timeline[0]), geometrySignature(buildFrame(0)));
  assert.equal(geometrySignature(timeline.at(-1)), geometrySignature(buildTimeline().at(-1)));
});

test('portrait v031 exposes a canvas pressure surface and deterministic state bridge', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v031/index.html');
  const sketch = await read('studies/self-portrait/v031/sketch.js');

  assert.match(html, /data-checksum-membrane/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-action="probe"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /createCanvas/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV031/);
});
