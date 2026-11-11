import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STATION_COUNT,
  MEMORY_LIMIT,
  SEED,
  buildField,
  geometrySignature,
  recordNotice,
  commitDeparture,
  liftLatest,
  releaseField,
  buildTimeline,
  departureSignature
} = await import('../studies/self-portrait/v048/engine.mjs');

const arm = (field, stations = [0, 2, 5]) => stations.reduce(
  (current, station) => recordNotice(current, station),
  field
);

test('portrait v048 begins as a deterministic departure body', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(SEED, 0x503048);
  assert.equal(STATION_COUNT, 7);
  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.composition, 'departure-portrait');
  assert.equal(first.renderer, 'canvas-raster');
  assert.equal(first.document.mode, 'quiet');
  assert.equal(first.body.length, 40);
  assert.equal(first.stations.length, STATION_COUNT);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v048 notices presence without changing geometry', () => {
  const quiet = buildField();
  const noticed = recordNotice(quiet, 2);

  assert.equal(noticed.pending.length, 1);
  assert.equal(noticed.pending[0].station, 2);
  assert.equal(noticed.interaction, 'presence noticed / 1 threshold');
  assert.equal(geometrySignature(noticed), geometrySignature(quiet));
});

test('portrait v048 refuses a departure before three distinct notices', () => {
  const quiet = buildField();
  const held = recordNotice(recordNotice(quiet, 2), 2);
  const result = commitDeparture(held, 5);

  assert.equal(result.accepted, false);
  assert.equal(result.event, null);
  assert.equal(result.field.interaction, 'refused / departure incomplete');
  assert.equal(result.field.document.revision, 0);
  assert.equal(geometrySignature(result.field), geometrySignature(quiet));
});

test('portrait v048 lets departure globally re-produce the body', () => {
  const quiet = buildField();
  const result = commitDeparture(arm(quiet), 5);

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'departure-rewrite');
  assert.equal(result.event.relation, 'presence-leaves-a-witness');
  assert.equal(result.field.document.revision, 1);
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.pending.length, 0);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.body.some((point, index) => point.x !== quiet.body[index].x || point.y !== quiet.body[index].y));
  assert.ok(result.field.stations.some((station, index) => station.lean !== quiet.stations[index].lean));
});

test('portrait v048 makes departure order structural', () => {
  const forward = commitDeparture(arm(buildField(), [0, 2, 5]), 5).field;
  const alternate = commitDeparture(arm(buildField(), [5, 2, 0]), 1).field;

  assert.notEqual(departureSignature(forward.memory[0]), departureSignature(alternate.memory[0]));
  assert.notEqual(geometrySignature(forward), geometrySignature(alternate));
});

test('portrait v048 compounds four departures and lifts the exact preceding body', () => {
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

test('portrait v048 exposes a canvas field and non-hover departure paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v048/index.html');
  const sketch = await read('studies/self-portrait/v048/sketch.js');
  const style = await read('studies/self-portrait/v048/style.css');

  assert.match(html, /data-departure-stage/);
  assert.match(html, /data-action="departure"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /__mutinePortraitV048/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v048 has one canonical daily record and tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-11');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/self-portrait/v048/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-portrait-2026-11-11/);
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].metrics.grammar, 'departure-portrait');
  const canonical = await read('works/portrait-2026-11-11/index.html');
  assert.match(canonical, /data-work-id="portrait-2026-11-11"/);
  assert.match(canonical, /catalog\.js/);
});
