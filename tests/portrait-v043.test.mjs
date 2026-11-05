import test from 'node:test';
import assert from 'node:assert/strict';

const {
  CHANNEL_COUNT,
  MEMORY_LIMIT,
  RESISTANCE_THRESHOLD,
  TRAVEL_THRESHOLD,
  ALIGNMENT_THRESHOLD,
  buildField,
  geometrySignature,
  loadPressure,
  commitPressure,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v043/engine.mjs');

test('portrait v043 builds a deterministic resistance-portrait slab', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(CHANNEL_COUNT, 9);
  assert.equal(first.composition, 'resistance-portrait');
  assert.equal(first.renderer, 'p5-canvas');
  assert.equal(first.channels.length, CHANNEL_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet slab');
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v043 keeps a pressure trace geometry-neutral until grain and resistance align', () => {
  const quiet = buildField();
  const loaded = loadPressure(quiet, {
    channel: 3,
    travel: TRAVEL_THRESHOLD - 0.08,
    alignment: ALIGNMENT_THRESHOLD + 0.1,
    pressure: RESISTANCE_THRESHOLD + 0.1
  });
  const refused = commitPressure(loaded);

  assert.equal(loaded.interaction, 'loaded / 3');
  assert.equal(refused.accepted, false);
  assert.equal(refused.field.revision, 0);
  assert.equal(refused.field.memory.length, 0);
  assert.equal(geometrySignature(refused.field), geometrySignature(quiet));
});

test('portrait v043 recasts an untouched remote channel after a directional pressure crossing', () => {
  const quiet = buildField();
  const loaded = loadPressure(quiet, {
    channel: 3,
    travel: TRAVEL_THRESHOLD + 0.2,
    alignment: ALIGNMENT_THRESHOLD + 0.18,
    pressure: RESISTANCE_THRESHOLD + 0.18
  });
  const result = commitPressure(loaded);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'resistance-recast');
  assert.equal(event.relation, 'pressure-remembered-elsewhere');
  assert.equal(event.source, 3);
  assert.notEqual(event.receiver, event.source);
  assert.equal(result.field.interaction, 'recast / remote');
  assert.equal(result.field.channels[3].state, 'quiet');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.equal(result.field.channels[event.receiver].state, 'recast');
  assert.ok(result.field.channels[event.receiver].contours > quiet.channels[event.receiver].contours);
  assert.notEqual(result.field.channels[event.receiver].density, quiet.channels[event.receiver].density);
});

test('portrait v043 compounds four material recasts and lifts the exact preceding slab', () => {
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

test('portrait v043 exposes a pressure stroke, pointer, touch, keyboard, and release paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v043/index.html');
  const sketch = await read('studies/self-portrait/v043/sketch.js');
  const style = await read('studies/self-portrait/v043/style.css');

  assert.match(html, /data-pressure-stage/);
  assert.match(html, /data-action="press"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /__mutinePortraitV043/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v043 keeps control clicks from becoming pointer strokes', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v043/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /event\.target\.closest\('\.pressure-controls'\)/);
});
