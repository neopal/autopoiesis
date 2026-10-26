import test from 'node:test';
import assert from 'node:assert/strict';

const {
  SIGNAL_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  decisionSignature,
  registerSignal,
  liftLatest,
  buildTimeline
} = await import('../studies/self-portrait/v034/engine.mjs');

test('portrait v034 seeds a forecast without changing the loom', () => {
  const baseline = buildFrame(0);
  const seeded = registerSignal(baseline, 1);

  assert.equal(baseline.composition, 'forecast-loom');
  assert.equal(SIGNAL_COUNT, 4);
  assert.equal(seeded.accepted, false);
  assert.equal(seeded.reason, 'forecast-seeded');
  assert.equal(seeded.frame.forecast, 1);
  assert.equal(seeded.frame.ribs.length, 10);
  assert.equal(geometrySignature(seeded.frame), geometrySignature(baseline));
  assert.notEqual(decisionSignature(seeded.frame), decisionSignature(baseline));
});

test('portrait v034 hardens a distant rib when the forecast is confirmed', () => {
  const baseline = buildFrame(0);
  const pending = registerSignal(baseline, 1).frame;
  const result = registerSignal(pending, 1);
  const event = result.frame.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'forecast-confirmed');
  assert.equal(event.signal, 1);
  assert.equal(event.forecast, 1);
  assert.notEqual(event.receiverIndex, event.signal);
  assert.equal(result.frame.ribs[event.receiverIndex].state, 'confirmed');
  assert.notEqual(geometrySignature(result.frame), geometrySignature(baseline));
  assert.equal(result.frame.forecast, event.nextForecast);
});

test('portrait v034 turns a wrong signal into a remote prediction error', () => {
  const baseline = buildFrame(0);
  const pending = registerSignal(baseline, 0).frame;
  const result = registerSignal(pending, 2);
  const event = result.frame.memory.at(-1);
  const roles = result.frame.ribs.map((rib) => rib.state);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'forecast-mismatch');
  assert.equal(event.signal, 2);
  assert.equal(event.forecast, 0);
  assert.notEqual(event.errorIndex, event.signal);
  assert.notEqual(event.counterfactualIndex, event.errorIndex);
  assert.equal(roles.filter((state) => state === 'error').length, 1);
  assert.equal(roles.filter((state) => state === 'counterfactual').length, 1);
  assert.notEqual(geometrySignature(result.frame), geometrySignature(baseline));
});

test('portrait v034 carries four forecast errors and lifts the exact prior loom', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.forecast, timeline.at(-2).forecast);
  assert.equal(lifted.interaction, 'lifted');
  assert.ok(latest.memory.every((event) => event.kind === 'forecast-confirmed' || event.kind === 'forecast-mismatch'));
});

test('portrait v034 timeline is deterministic and uses a bounded signal alphabet', () => {
  const first = buildTimeline();
  const second = buildTimeline();

  assert.deepEqual(first, second);
  assert.ok(first.at(-1).memory.every((event) => event.signal >= 0 && event.signal < SIGNAL_COUNT));
  assert.ok(first.at(-1).ribs.every((rib) => ['quiet', 'confirmed', 'error', 'counterfactual', 'witness'].includes(rib.state)));
});

test('portrait v034 exposes a p5 loom and equivalent signal controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v034/index.html');
  const sketch = await read('studies/self-portrait/v034/sketch.js');

  assert.match(html, /data-forecast-loom/);
  assert.match(html, /id="loom-canvas"/);
  assert.match(html, /data-signal="0"/);
  assert.match(html, /data-signal="3"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /createCanvas/);
  assert.match(sketch, /__mutinePortraitV034/);
  assert.match(sketch, /pointerdown/);
});

test('portrait v034 has one factual daily record and canonical work route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const catalog = JSON.parse(await read('studio/data/works.json'));
  const matches = catalog.works.filter((work) => work.id === 'portrait-2026-10-26');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-26/index.html');
  const critiques = await read('studies/self-portrait/v034/critiques.json');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-26');
  assert.equal(record.rawPath, '/studies/self-portrait/v034/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /forecast|prediction|pressure/i);
  assert.match(record.metrics.changedRule, /forecast|prediction|pressure/i);
  assert.equal(record.decision.lineage, 'portrait-2026-10-25');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-26"/);
  assert.ok(JSON.parse(critiques).length >= 8);
});
