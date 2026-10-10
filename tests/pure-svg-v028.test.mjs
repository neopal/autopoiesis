import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const engineUrl = '../studies/pure-svg/v028/engine.mjs';

test('Pure SVG v028 begins as a deterministic aperture array, not a line field', async () => {
  const { buildFrame, PLATE_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'aperture-array');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.plates.length, PLATE_COUNT);
  assert.equal(frame.plates.every((plate) => plate.pathSignature.startsWith('M') && plate.pathSignature.includes('Z')), true);
  assert.equal(frame.plates.every((plate) => plate.aperture.radius > 0), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v028 keeps proximity non-causal and commits a departure across non-local plate geometry', async () => {
  const { armPlate, applyDeparture, buildFrame } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const armed = armPlate(baseline, { x: 0.16, y: 0.42 });
  const departed = applyDeparture(armed, { x: 0.16, y: 0.42 });

  assert.equal(armed.interaction, 'attention-armed');
  assert.equal(armed.memory.length, 0);
  assert.equal(departed.interaction, 'departure-relay');
  assert.equal(departed.memory.length, 1);
  assert.equal(departed.event.committed, true);
  assert.notEqual(departed.event.source, departed.event.target);
  assert.notEqual(departed.plates[departed.event.source].pathSignature, baseline.plates[departed.event.source].pathSignature);
  assert.notEqual(departed.plates[departed.event.target].pathSignature, baseline.plates[departed.event.target].pathSignature);
  assert.notEqual(departed.signature, baseline.signature);
});

test('Pure SVG v028 carries a hinge relay, lifts the exact preceding array, and releases to baseline', async () => {
  const { applyDeparture, buildFrame, geometrySignature, liftLatestDeparture, releaseArray } = await import(engineUrl);
  const baseline = buildFrame(2, []);
  const first = applyDeparture(baseline, { x: 0.84, y: 0.2 });
  const second = applyDeparture(first, { x: 0.28, y: 0.8 });
  const lifted = liftLatestDeparture(second);
  const released = releaseArray();

  assert.equal(second.memory.length, 2);
  assert.notEqual(second.event.relay, undefined);
  assert.notEqual(geometrySignature(second), geometrySignature(first));
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v028 retains four departures and refuses a fifth', async () => {
  const { applyDeparture, buildTimeline } = await import(engineUrl);
  const settled = buildTimeline().at(-1);
  const refused = applyDeparture(settled, { x: 0.5, y: 0.5 });

  assert.equal(settled.memory.length, 4);
  assert.equal(refused.interaction, 'departure-memory-full');
  assert.equal(refused.event.committed, false);
});

test('Pure SVG v028 publishes a self-contained tableau with equivalent pointer and keyboard paths', async () => {
  const tableau = await read('studies/pure-svg/v028/index.html');
  const sketch = await read('studies/pure-svg/v028/sketch.js');
  const style = await read('studies/pure-svg/v028/style.css');

  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="depart"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
});
