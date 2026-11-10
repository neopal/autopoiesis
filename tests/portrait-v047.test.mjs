import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NODE_COUNT,
  MEMORY_LIMIT,
  SEED,
  buildField,
  geometrySignature,
  recordPoint,
  commitCounterstroke,
  liftLatest,
  releaseField,
  buildTimeline,
  gestureSignature
} = await import('../studies/self-portrait/v047/engine.mjs');

const validStroke = [
  [0.12, 0.72],
  [0.26, 0.56],
  [0.18, 0.42],
  [0.42, 0.30],
  [0.34, 0.18],
  [0.68, 0.24],
  [0.58, 0.62],
  [0.86, 0.40]
];

const arm = (field, points = validStroke) => points.reduce(
  (current, [x, y], index) => recordPoint(current, x, y, index * 40),
  field
);

test('portrait v047 begins as a deterministic counterpressure profile', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(SEED, 0x503047);
  assert.equal(NODE_COUNT, 28);
  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.composition, 'counterpressure-profile');
  assert.equal(first.renderer, 'svg-lattice');
  assert.equal(first.document.mode, 'quiet');
  assert.equal(first.ribs.length, NODE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v047 stores a counterstroke without changing the profile', () => {
  const quiet = buildField();
  const held = arm(quiet, validStroke.slice(0, 4));

  assert.equal(held.interaction, 'counterstroke held / 4 points');
  assert.equal(held.pending.length, 4);
  assert.equal(geometrySignature(held), geometrySignature(quiet));
  assert.equal(gestureSignature(held.pending), gestureSignature(validStroke.slice(0, 4)));
});

test('portrait v047 refuses a straight or underspecified release', () => {
  const quiet = buildField();
  const straight = arm(quiet, [[0.1, 0.5], [0.3, 0.5], [0.5, 0.5], [0.7, 0.5], [0.9, 0.5]]);
  const result = commitCounterstroke(straight);

  assert.equal(result.accepted, false);
  assert.equal(result.event, null);
  assert.equal(result.field.interaction, 'refused / no counterpressure');
  assert.equal(result.field.document.revision, 0);
  assert.equal(geometrySignature(result.field), geometrySignature(quiet));
});

test('portrait v047 releases counterpressure into a whole-profile rewrite', () => {
  const quiet = buildField();
  const result = commitCounterstroke(arm(quiet));

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'counterstroke-rewrite');
  assert.equal(result.event.relation, 'release-inverts-profile');
  assert.equal(result.field.document.revision, 1);
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.pending.length, 0);
  assert.notEqual(result.field.document.mode, 'quiet');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.ribs.some((rib, index) => rib.x !== quiet.ribs[index].x || rib.y !== quiet.ribs[index].y || rib.angle !== quiet.ribs[index].angle));
});

test('portrait v047 makes reversal order change the produced profile', () => {
  const reverse = [...validStroke].reverse();
  const forward = commitCounterstroke(arm(buildField(), validStroke)).field;
  const backwards = commitCounterstroke(arm(buildField(), reverse)).field;

  assert.notEqual(forward.memory[0].reversalCode, backwards.memory[0].reversalCode);
  assert.notEqual(geometrySignature(forward), geometrySignature(backwards));
  assert.notEqual(forward.ribs[0].x, backwards.ribs[0].x);
});

test('portrait v047 compounds four rewrites and lifts the exact preceding profile', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().document.revision, 0);
});

test('portrait v047 exposes an SVG field, p5 layer, and non-hover paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v047/index.html');
  const sketch = await read('studies/self-portrait/v047/sketch.js');
  const style = await read('studies/self-portrait/v047/style.css');

  assert.match(html, /data-profile-stage/);
  assert.match(html, /data-profile-svg/);
  assert.match(html, /data-action="counterstroke"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitCounterstroke/);
  assert.match(sketch, /__mutinePortraitV047/);
  assert.match(sketch, /event\.target\.closest\('\.counterpressure-controls'\)/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v047 has one canonical daily record and tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-10');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/self-portrait/v047/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-portrait-2026-11-10/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.grammar, 'counterpressure-profile');
  const canonical = await read('works/portrait-2026-11-10/index.html');
  assert.match(canonical, /data-work-id="portrait-2026-11-10"/);
  assert.match(canonical, /catalog\.js/);
});
