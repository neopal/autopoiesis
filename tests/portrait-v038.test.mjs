import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  buildField,
  structureSignature,
  poseSignature,
  gazeAt,
  departGaze,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v038/engine.mjs');

test('portrait v038 builds a deterministic syntax field of situated agents', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(AGENT_COUNT, 13);
  assert.equal(first.composition, 'departing-syntax');
  assert.equal(first.agents.length, AGENT_COUNT);
  assert.equal(structureSignature(first), structureSignature(second));
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
});

test('portrait v038 lets a situated clause turn toward attention without changing its structural form', () => {
  const quiet = buildField();
  const gazing = gazeAt(quiet, { index: 4, intensity: 0.84 });

  assert.equal(gazing.lastGaze.relation, 'reciprocal');
  assert.equal(structureSignature(gazing), structureSignature(quiet));
  assert.notEqual(poseSignature(gazing), poseSignature(quiet));
  assert.equal(gazing.agents[4].state, 'gazing');
});

test('portrait v038 turns a departing gaze into a non-local syntax decision', () => {
  const quiet = buildField();
  const gazing = gazeAt(quiet, { index: 4, intensity: 0.84 });
  const result = departGaze(gazing);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'departing-gaze');
  assert.equal(event.relation, 'non-local');
  assert.equal(result.field.lastGaze, null);
  assert.notEqual(event.witnessIndex, event.closedIndex);
  assert.notEqual(event.witnessIndex, event.openedIndex);
  assert.notEqual(event.witnessIndex, event.echoedIndex);
  assert.deepEqual(result.field.agents[event.witnessIndex], quiet.agents[event.witnessIndex]);
  assert.notEqual(structureSignature(result.field), structureSignature(quiet));
  assert.equal(result.field.agents[event.closedIndex].state, 'closed');
  assert.equal(result.field.agents[event.openedIndex].state, 'opened');
  assert.equal(result.field.agents[event.echoedIndex].state, 'echoed');
});

test('portrait v038 makes the remote roles visible in actual agent geometry', () => {
  const quiet = buildField();
  const result = departGaze(gazeAt(quiet, { index: 6, intensity: 0.72 }));
  const event = result.field.memory.at(-1);

  assert.equal(result.field.interaction, 'departed / remembered');
  assert.ok(result.field.agents[event.closedIndex].aperture < quiet.agents[event.closedIndex].aperture);
  assert.ok(result.field.agents[event.closedIndex].height > quiet.agents[event.closedIndex].height);
  assert.ok(result.field.agents[event.openedIndex].aperture > quiet.agents[event.openedIndex].aperture);
  assert.ok(result.field.agents[event.openedIndex].width > quiet.agents[event.openedIndex].width);
  assert.notEqual(result.field.agents[event.echoedIndex].x, quiet.agents[event.echoedIndex].x);
  assert.notEqual(result.field.agents[event.echoedIndex].angle, quiet.agents[event.echoedIndex].angle);
});

test('portrait v038 compounds four departures and lifts the exact previous syntax state', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(structureSignature(lifted), structureSignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
});

test('portrait v038 exposes an SVG syntax encounter with equivalent keyboard and touch paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v038/index.html');
  const sketch = await read('studies/self-portrait/v038/sketch.js');
  const style = await read('studies/self-portrait/v038/style.css');

  assert.match(html, /data-syntax-stage/);
  assert.match(html, /data-action="depart"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerenter/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutinePortraitV038/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v038 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-10-31');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-31/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-10-31');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-31');
  assert.equal(record.rawPath, '/studies/self-portrait/v038/');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'portrait-2026-10-30');
  assert.match(record.metrics.changedRule, /gaze|depart|remote/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-31"/);
  assert.equal(publicMatches.length, 1);
});
