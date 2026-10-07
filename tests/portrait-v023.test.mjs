import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FACE_COUNT,
  buildFrame,
  geometrySignature,
  armOrbit,
  sealObservation,
  liftLatestObservation,
  releaseObservations,
  buildTimeline,
  MEMORY_LIMIT,
  STAGES
} = await import('../studies/self-portrait/v023/engine.mjs');

test('portrait v023 turns a watched orbit into a structural change on the unseen face', () => {
  const baseline = buildFrame(0, []);
  const armed = armOrbit(baseline, -0.28);
  const changed = sealObservation(armed);
  const event = changed.memory.at(-1);

  assert.equal(baseline.composition, 'single-observed-solid');
  assert.equal(baseline.faces.length, FACE_COUNT);
  assert.equal(baseline.memory.length, 0);
  assert.equal(armed.memory.length, 0);
  assert.equal(event.kind, 'unseen-inversion');
  assert.notEqual(event.watchedFace, event.alteredFace);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.ok(changed.faces[event.alteredFace].notch > baseline.faces[event.alteredFace].notch);
  assert.equal(changed.faces[event.alteredFace].state, 'unseen-open');
  assert.equal(changed.interaction, 'observation-sealed');
});

test('portrait v023 keeps orbiting non-causal until the observer seals an unseen change', () => {
  const baseline = buildFrame(0, []);
  const armed = armOrbit(baseline, 0.64);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.interaction, 'orbit-armed');
  assert.equal(armed.armedFace, 5);
  assert.deepEqual(armed.faces.map((face) => face.notch), baseline.faces.map((face) => face.notch));
});

test('portrait v023 sends repeated observation to a different unseen face', () => {
  const first = sealObservation(armOrbit(buildFrame(0, []), -0.28));
  const second = sealObservation(armOrbit(first, -0.28));

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(second.memory.at(-1).alteredFace, first.memory.at(-1).alteredFace);
  assert.ok(second.faces[second.memory.at(-1).alteredFace].notch > 0);
});

test('portrait v023 bounds memory and lifts the latest observation exactly', () => {
  let frame = buildFrame(0, []);
  for (let index = 0; index < 9; index += 1) frame = sealObservation(armOrbit(frame, (index % 5) / 2 - 1));

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const restored = liftLatestObservation(frame);
  assert.equal(restored.memory.length, MEMORY_LIMIT - 1);
  assert.equal(geometrySignature(restored), geometrySignature(buildFrame(0, frame.memory.slice(0, -1))));
  assert.equal(geometrySignature(releaseObservations(0)), geometrySignature(buildFrame(0, [])));
});

test('portrait v023 replays a deterministic four-seal timeline', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.faces.filter((face) => face.notch > 0).length, 4);
  assert.equal(settled.faces.filter((face) => face.state === 'echo').length, 3);
  assert.equal(settled.interaction, 'sequence');
});

test('portrait v023 exposes a caption-free single-solid encounter and release evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v023/index.html');
  const sketch = await read('studies/self-portrait/v023/sketch.js');
  const style = await read('studies/self-portrait/v023/style.css');
  const readme = await read('studies/self-portrait/v023/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v023/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v023/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-10-07"/);
  assert.match(html, /id="observation-field"/);
  assert.match(html, /data-action="seal"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /sealObservation/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutinePortraitV023/);
  assert.match(sketch, /renderFrame\(frozen \? timeline\.at\(-1\) : currentFrame\)/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D single observed solid');
  assert.equal(metrics.memoryWindow, MEMORY_LIMIT);
  assert.match(metrics.interactionRule, /orbit|seal|unseen/i);
  assert.equal(critiques.length, 6);
});

test('portrait v023 is the unique 2026-10-07 daily work with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-07');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-07/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-10-07');
  assert.equal(record.rawPath, '/studies/self-portrait/v023/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-07');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /unseen|attention|face/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-07"/);
});
