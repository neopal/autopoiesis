import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  geometrySignature,
  submitStroke,
  liftLatestStroke,
  releaseStrain,
  buildTimeline,
  STAGES,
  MEMORY_LIMIT,
  RING_COUNT
} = await import('../studies/self-portrait/v024/engine.mjs');

test('portrait v024 lets the membrane choose its own rupture from visitor strain', () => {
  const baseline = buildFrame(0, []);
  const changed = submitStroke(baseline, { start: [-0.72, -0.18], end: [0.64, 0.28] });
  const event = changed.memory.at(-1);

  assert.equal(baseline.composition, 'self-measuring-membrane');
  assert.equal(baseline.rings.length, RING_COUNT);
  assert.equal(baseline.memory.length, 0);
  assert.equal(event.kind, 'resistance-rupture');
  assert.notEqual(event.rupturedRing, event.relayRing);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.ok(changed.rings[event.rupturedRing].notch > baseline.rings[event.rupturedRing].notch);
  assert.equal(changed.rings[event.rupturedRing].state, 'ruptured');
});

test('portrait v024 refuses a stroke too short to carry strain', () => {
  const baseline = buildFrame(0, []);
  const refused = submitStroke(baseline, { start: [0, 0], end: [0.02, 0.01] });

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'stroke-refused');
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});

test('portrait v024 bounds strain memory and lifts the latest rupture exactly', () => {
  let frame = buildFrame(0, []);
  for (let index = 0; index < 7; index += 1) {
    frame = submitStroke(frame, {
      start: [-0.8, -0.5 + index * 0.1],
      end: [0.7, 0.45 - index * 0.08]
    });
  }

  const restored = liftLatestStroke(frame);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(restored.memory.length, MEMORY_LIMIT - 1);
  assert.equal(geometrySignature(restored), geometrySignature(buildFrame(0, frame.memory.slice(0, -1))));
  assert.equal(geometrySignature(releaseStrain(0)), geometrySignature(buildFrame(0, [])));
});

test('portrait v024 replays four deterministic ruptures and relays strain', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const events = settled.memory;

  assert.equal(timeline.length, STAGES);
  assert.equal(events.length, MEMORY_LIMIT);
  assert.ok(events.every((event) => event.rupturedRing !== event.relayRing));
  assert.ok(new Set(events.map((event) => event.rupturedRing)).size >= 2);
  assert.ok(settled.rings.some((ring) => ring.state === 'relayed'));
});

test('portrait v024 exposes an SVG membrane tableau with causal controls and evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v024/index.html');
  const sketch = await read('studies/self-portrait/v024/sketch.js');
  const style = await read('studies/self-portrait/v024/style.css');
  const readme = await read('studies/self-portrait/v024/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v024/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v024/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-08"/);
  assert.match(html, /<svg[^>]+id="field"/);
  assert.match(html, /data-action="strain"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /submitStroke/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV024/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic SVG self-measuring membrane');
  assert.equal(metrics.memoryWindow, MEMORY_LIMIT);
  assert.match(metrics.interactionRule, /stroke|rupture|resistance/i);
  assert.equal(critiques.length, 6);
});

test('portrait v024 is the unique 2026-10-08 daily work with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-08');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-08/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-10-08');
  assert.equal(record.rawPath, '/studies/self-portrait/v024/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-08');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /resistance|rupture|strain/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-08"/);
});
