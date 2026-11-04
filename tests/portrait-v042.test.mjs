import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NODE_COUNT,
  MEMORY_LIMIT,
  DEPARTURE_THRESHOLD,
  buildField,
  geometrySignature,
  approach,
  commitDeparture,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v042/engine.mjs');

test('portrait v042 builds a deterministic absence-ledger canvas composition', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(NODE_COUNT, 17);
  assert.equal(first.composition, 'absence-ledger');
  assert.equal(first.renderer, 'p5-canvas');
  assert.equal(first.nodes.length, NODE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet field');
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v042 makes presence geometry-neutral until absence is committed', () => {
  const quiet = buildField();
  const present = approach(quiet, { site: 5, load: DEPARTURE_THRESHOLD - 0.08 });
  const refused = commitDeparture(present);

  assert.equal(present.interaction, 'present / 5');
  assert.equal(refused.accepted, false);
  assert.equal(refused.field.revision, 0);
  assert.equal(refused.field.memory.length, 0);
  assert.equal(geometrySignature(refused.field), geometrySignature(quiet));
});

test('portrait v042 only leaves a structural absence after the threshold', () => {
  const quiet = buildField();
  const present = approach(quiet, { site: 5, load: DEPARTURE_THRESHOLD + 0.18 });
  const result = commitDeparture(present);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'departure-recomposition');
  assert.equal(event.relation, 'absence-remembers-remotely');
  assert.equal(event.source, 5);
  assert.notEqual(event.receiver, event.source);
  assert.equal(result.field.interaction, 'left / remote');
  assert.equal(result.field.nodes[5].state, 'quiet');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.equal(result.field.nodes[event.receiver].state, 'hollow');
  assert.ok(result.field.nodes[event.receiver].voidScale > quiet.nodes[event.receiver].voidScale);
});

test('portrait v042 compounds four departures and lifts the exact preceding field', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().revision, 0);
});

test('portrait v042 exposes canvas, presence/absence, pointer, touch, keyboard, and release paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v042/index.html');
  const sketch = await read('studies/self-portrait/v042/sketch.js');
  const style = await read('studies/self-portrait/v042/style.css');

  assert.match(html, /data-absence-stage/);
  assert.match(html, /data-action="leave"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerenter/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /__mutinePortraitV042/);
  assert.match(sketch, /function nodePosition/);
  assert.doesNotMatch(sketch, /renderer\.nodePosition/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v042 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-04');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-11-04/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-11-04');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-11-04');
  assert.equal(record.rawPath, '/studies/self-portrait/v042/');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'portrait-2026-11-03');
  assert.match(record.metrics.changedRule, /absence|leave|remote/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-11-04"/);
  assert.equal(publicMatches.length, 1);
});
