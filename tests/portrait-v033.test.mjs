import test from 'node:test';
import assert from 'node:assert/strict';

const {
  ZONE_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  decisionSignature,
  attend,
  withdraw,
  liftLatest,
  buildTimeline
} = await import('../studies/self-portrait/v033/engine.mjs');

test('portrait v033 holds attention without changing the body', () => {
  const baseline = buildFrame(0);
  const held = attend(baseline, 2);

  assert.equal(baseline.composition, 'reciprocal-absence');
  assert.equal(ZONE_COUNT, 8);
  assert.equal(held.accepted, false);
  assert.equal(held.reason, 'attention-held');
  assert.equal(held.frame.armedZone, 2);
  assert.equal(held.frame.attention[2], 1);
  assert.equal(geometrySignature(held.frame), geometrySignature(baseline));
  assert.notEqual(decisionSignature(held.frame), decisionSignature(baseline));
});

test('portrait v033 answers only when attention withdraws, and answers remotely', () => {
  const baseline = buildFrame(0);
  const pending = attend(baseline, 2).frame;
  const result = withdraw(pending);
  const event = result.frame.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'reciprocal-absence');
  assert.equal(event.seenIndex, 2);
  assert.notEqual(event.receiverIndex, event.seenIndex);
  assert.notEqual(event.echoIndex, event.seenIndex);
  assert.notEqual(event.receiverIndex, event.echoIndex);
  assert.notEqual(geometrySignature(result.frame), geometrySignature(baseline));
  assert.equal(result.frame.zones[event.seenIndex].state, 'witnessed');
  assert.equal(result.frame.zones[event.receiverIndex].state, 'answer');
  assert.equal(result.frame.zones[event.echoIndex].state, 'echo');
});

test('portrait v033 refuses an empty withdrawal and carries reciprocal memory forward', () => {
  const baseline = buildFrame(0);
  const refused = withdraw(baseline);
  const first = withdraw(attend(baseline, 0).frame).frame;
  const second = withdraw(attend(first, 5).frame).frame;
  const lifted = liftLatest(second);

  assert.equal(refused.accepted, false);
  assert.equal(refused.reason, 'no-attention-held');
  assert.equal(geometrySignature(refused.frame), geometrySignature(baseline));
  assert.equal(second.memory.length, 2);
  assert.equal(second.snapshots.length, 2);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(lifted.armedZone, null);
  assert.deepEqual(lifted.attention, first.attention);
  assert.equal(lifted.interaction, 'lifted');
  assert.ok(second.memory.length <= MEMORY_LIMIT);
});

test('portrait v033 exposes a deterministic reciprocal timeline', () => {
  const timeline = buildTimeline();

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(timeline.at(-1).memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(timeline[0]), geometrySignature(buildFrame(0)));
  assert.equal(geometrySignature(timeline.at(-1)), geometrySignature(buildTimeline().at(-1)));
});

test('portrait v033 exposes an SVG reciprocal field and equivalent controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v033/index.html');
  const sketch = await read('studies/self-portrait/v033/sketch.js');

  assert.match(html, /data-reciprocal-absence/);
  assert.match(html, /<svg[^>]+id="reciprocal-field"/);
  assert.match(html, /data-zone="0"/);
  assert.match(html, /data-zone="7"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-action="withdraw"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerenter/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /__mutinePortraitV033/);
  assert.match(sketch, /createElementNS/);
});

test('portrait v033 has one factual daily record and canonical work route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const catalog = JSON.parse(await read('studio/data/works.json'));
  const matches = catalog.works.filter((work) => work.id === 'portrait-2026-10-25');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-25/index.html');
  const critiques = await read('studies/self-portrait/v033/critiques.json');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-25');
  assert.equal(record.rawPath, '/studies/self-portrait/v033/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /withdraw|reciprocal|absence/i);
  assert.match(record.metrics.changedRule, /withdraw|reciprocal|absence/i);
  assert.equal(record.decision.lineage, 'portrait-2026-10-24');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-25"/);
  assert.ok(JSON.parse(critiques).length >= 7);
});
