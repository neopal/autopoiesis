import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  geometrySignature,
  traverse,
  commitDeparture,
  liftLatestDeparture,
  releaseAttention,
  buildTimeline,
  STAGES,
  MEMORY_LIMIT,
  SEGMENT_COUNT
} = await import('../studies/self-portrait/v025/engine.mjs');

test('portrait v025 accumulates a route and lets the ribbon choose a non-local detour', () => {
  const baseline = buildFrame(0, []);
  const traversed = traverse(baseline, {
    points: [[-0.82, -0.18], [-0.25, 0.2], [0.14, -0.08], [0.74, 0.3]]
  });
  const departed = commitDeparture(traversed);
  const event = departed.memory.at(-1);

  assert.equal(baseline.composition, 'decision-ribbon');
  assert.equal(baseline.segments.length, SEGMENT_COUNT);
  assert.equal(event.kind, 'detour-departure');
  assert.notEqual(event.observedSegment, event.detourSegment);
  assert.notEqual(event.detourSegment, event.replySegment);
  assert.notEqual(geometrySignature(baseline), geometrySignature(departed));
  assert.ok(departed.segments[event.detourSegment].gap > baseline.segments[event.detourSegment].gap);
  assert.equal(departed.segments[event.detourSegment].state, 'detoured');
  assert.ok(departed.segments[event.replySegment].bend !== baseline.segments[event.replySegment].bend);
});

test('portrait v025 treats a short or empty route as no departure', () => {
  const baseline = buildFrame(0, []);
  const traversed = traverse(baseline, { points: [[0, 0]] });
  const refused = commitDeparture(traversed);

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'route-refused');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});

test('portrait v025 bounds attention memory and lifts the latest detour exactly', () => {
  let frame = buildFrame(0, []);
  for (let index = 0; index < 7; index += 1) {
    frame = commitDeparture(traverse(frame, {
      points: [[-0.8, -0.42 + index * 0.06], [-0.12, 0.28], [0.78, 0.34 - index * 0.07]]
    }));
  }

  const restored = liftLatestDeparture(frame);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(restored.memory.length, MEMORY_LIMIT - 1);
  assert.equal(geometrySignature(restored), geometrySignature(buildFrame(0, frame.memory.slice(0, -1))));
  assert.equal(geometrySignature(releaseAttention(0)), geometrySignature(buildFrame(0, [])));
});

test('portrait v025 replays deterministic departures with changed replies', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const events = settled.memory;

  assert.equal(timeline.length, STAGES);
  assert.equal(events.length, MEMORY_LIMIT);
  assert.ok(events.every((event) => event.detourSegment !== event.replySegment));
  assert.ok(new Set(events.map((event) => event.detourSegment)).size >= 2);
  assert.ok(settled.segments.some((segment) => segment.state === 'replied'));
});

test('portrait v025 exposes a traversable ribbon tableau and evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v025/index.html');
  const sketch = await read('studies/self-portrait/v025/sketch.js');
  const style = await read('studies/self-portrait/v025/style.css');
  const readme = await read('studies/self-portrait/v025/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v025/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v025/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-09"/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-action="depart"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /__mutinePortraitV025/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D decision ribbon');
  assert.equal(metrics.memoryWindow, MEMORY_LIMIT);
  assert.match(metrics.interactionRule, /traverse|depart|detour/i);
  assert.equal(critiques.length, 6);
});

test('portrait v025 is the unique 2026-10-09 daily work with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-09');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-09/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-10-09');
  assert.equal(record.rawPath, '/studies/self-portrait/v025/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-09');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /situated|route|detour/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-09"/);
});
