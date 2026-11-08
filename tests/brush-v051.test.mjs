import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  buildFrame,
  geometrySignature,
  PULSE_MIN_MS,
  PULSE_WINDOW_END,
  PULSE_WINDOW_START,
  armPulse,
  tickPulse,
  releasePulse,
  buildTimeline,
  liftLatest,
  releaseField
} = await import('../studies/p5-brush/v051/engine.mjs');

test('Brush v051 starts as a deterministic phase ring with four pulse sites', () => {
  const frame = buildFrame();
  assert.equal(frame.grammar, 'phase-locked-material-ring');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.body.segments.length, 12);
  assert.equal(frame.body.pulseSites.length, 4);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame()));
  assert.ok(PULSE_WINDOW_START > 0);
  assert.ok(PULSE_WINDOW_END > PULSE_WINDOW_START);
  assert.ok(PULSE_MIN_MS > 0);
});

test('Brush v051 refuses short and mistimed releases without changing material', () => {
  const quiet = buildFrame();
  const armed = armPulse(quiet, 0);
  const short = releasePulse(tickPulse(armed, PULSE_MIN_MS - 1), 'pointer');
  assert.equal(short.memory.length, 0);
  assert.equal(short.interaction, 'pulse-refused-short');
  assert.equal(geometrySignature(short), geometrySignature(quiet));

  const mistimed = releasePulse(tickPulse(armPulse(quiet, 0), 760), 'pointer');
  assert.equal(mistimed.memory.length, 0);
  assert.equal(mistimed.interaction, 'pulse-refused-phase');
  assert.equal(geometrySignature(mistimed), geometrySignature(quiet));
});

test('Brush v051 phase-locks a valid release into actual ring geometry', () => {
  const quiet = buildFrame();
  const armed = armPulse(quiet, 1);
  const pending = tickPulse(armed, 420);
  const changed = releasePulse(pending, 'pointer');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].type, 'phase-slip');
  assert.notEqual(geometrySignature(changed), geometrySignature(quiet));
  assert.notEqual(changed.body.segments[1].outer, quiet.body.segments[1].outer);
  assert.equal(changed.body.core.aperture !== quiet.body.core.aperture, true);
});

test('Brush v051 compounds four phase slips and lifts the exact previous ring', () => {
  const timeline = buildTimeline();
  const final = timeline.at(-1);
  assert.equal(final.memory.length, 4);
  assert.equal(final.state.pulseCount, 4);
  assert.equal(new Set(final.memory.map((event) => event.site)).size, 4);
  const restored = liftLatest(final);
  assert.equal(geometrySignature(restored), geometrySignature(timeline.at(-2)));
  assert.deepEqual(restored.memory, timeline.at(-2).memory);
  assert.deepEqual(restored.state, timeline.at(-2).state);
  assert.deepEqual(releaseField(), buildFrame());
});

test('Brush v051 exposes a tableau-first phase interaction and release documentation', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const [index, sketch, style, readme, metrics] = await Promise.all([
    read('studies/p5-brush/v051/index.html'),
    read('studies/p5-brush/v051/sketch.js'),
    read('studies/p5-brush/v051/style.css'),
    read('studies/p5-brush/v051/README.md'),
    read('studies/p5-brush/v051/metrics.json')
  ]);
  assert.match(index, /data-gesture="pulse"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /params\.get\('blind'\) === '1'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /releasePulse/);
  assert.match(sketch, /liftLatest/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /Deletion condition/);
  assert.match(metrics, /phase-locked-material-ring/);
});

test('Brush v051 has exactly one dated brush record with a p5.brush translation', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-08');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-08');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v051/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /phase|timing/i);
  assert.match(matches[0].source.translatedRule, /release|phase/i);
  const canonical = await read('works/brush-2026-11-08/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-08"/);
});
