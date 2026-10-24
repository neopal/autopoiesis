import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DIRECTION_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  propose,
  liftLatest,
  buildTimeline
} = await import('../studies/self-portrait/v032/engine.mjs');

test('portrait v032 holds the first proposal without changing the hinge', () => {
  const baseline = buildFrame(0);
  const held = propose(baseline, 1);

  assert.equal(baseline.composition, 'hinge-of-refusal');
  assert.equal(DIRECTION_COUNT, 4);
  assert.equal(held.accepted, false);
  assert.equal(held.reason, 'awaiting-contradiction');
  assert.equal(held.frame.pendingDirection, 1);
  assert.equal(held.frame.memory.length, 0);
  assert.equal(geometrySignature(held.frame), geometrySignature(baseline));
});

test('portrait v032 refuses repetition and commits only a directional contradiction', () => {
  const baseline = buildFrame(0);
  const held = propose(baseline, 1).frame;
  const repeated = propose(held, 1);
  const changed = propose(held, 3);
  const event = changed.frame.memory.at(-1);

  assert.equal(repeated.accepted, false);
  assert.equal(repeated.reason, 'duplicate-proposal');
  assert.equal(geometrySignature(repeated.frame), geometrySignature(held));
  assert.equal(changed.accepted, true);
  assert.equal(changed.frame.pendingDirection, null);
  assert.equal(changed.frame.memory.length, 1);
  assert.notEqual(geometrySignature(changed.frame), geometrySignature(baseline));
  assert.equal(event.kind, 'contradiction-hinge');
  assert.notEqual(event.firstDirection, event.secondDirection);
  assert.notEqual(changed.frame.hinge.axis, baseline.hinge.axis);
  assert.notEqual(changed.frame.hinge.voidScale, baseline.hinge.voidScale);
});

test('portrait v032 carries incompatible proposals forward and lifts the exact prior state', () => {
  const baseline = buildFrame(0);
  const first = propose(propose(baseline, 0).frame, 2).frame;
  const second = propose(propose(first, 1).frame, 2).frame;
  const lifted = liftLatest(second);

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.ok(second.revision > first.revision);
  assert.equal(second.snapshots.length, 2);
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(lifted.interaction, 'lifted');
  assert.ok(second.memory.length <= MEMORY_LIMIT);
});

test('portrait v032 exposes a deterministic contradiction timeline', () => {
  const timeline = buildTimeline();

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(timeline.at(-1).memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(timeline[0]), geometrySignature(buildFrame(0)));
  assert.equal(geometrySignature(timeline.at(-1)), geometrySignature(buildTimeline().at(-1)));
});

test('portrait v032 exposes a 3D hinge tableau and equivalent proposal controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v032/index.html');
  const sketch = await read('studies/self-portrait/v032/sketch.js');

  assert.match(html, /data-hinge-of-refusal/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-action="propose"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /data-direction="0"/);
  assert.match(html, /data-direction="3"/);
  assert.match(sketch, /createCanvas/);
  assert.match(sketch, /WEBGL/);
  assert.match(sketch, /p5ctx\.createCanvas/);
  assert.match(sketch, /p5ctx\.background/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /__mutinePortraitV032/);
});

test('portrait v032 has one factual catalogue record and a canonical work route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const catalog = JSON.parse(await read('studio/data/works.json'));
  const matches = catalog.works.filter((work) => work.id === 'portrait-2026-10-24');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-24/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-24');
  assert.equal(record.rawPath, '/studies/self-portrait/v032/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /refus|contradict/i);
  assert.match(record.metrics.changedRule, /contradict|hinge/i);
  assert.equal(record.decision.lineage, 'portrait-2026-10-23');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-24"/);
});
