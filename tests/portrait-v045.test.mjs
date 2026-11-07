import test from 'node:test';
import assert from 'node:assert/strict';

const {
  LOOP_SEGMENTS,
  MEMORY_LIMIT,
  SEED,
  buildField,
  buildTimeline,
  compileLoop,
  geometrySignature,
  liftLatest,
  releaseField,
  traceLoop,
  validLoop
} = await import('../studies/self-portrait/v045/engine.mjs');

test('portrait v045 builds a deterministic loop compiler', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(SEED, 0x503045);
  assert.equal(LOOP_SEGMENTS, 36);
  assert.equal(first.composition, 'loop-compiler');
  assert.equal(first.renderer, 'p5-webgl');
  assert.equal(first.form.segments, LOOP_SEGMENTS);
  assert.equal(first.form.revision, 0);
  assert.equal(first.memory.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v045 holds an open trace without changing the body', () => {
  const quiet = buildField();
  const traced = traceLoop(quiet, [
    { x: -0.8, y: -0.2 },
    { x: -0.25, y: -0.2 },
    { x: 0.3, y: -0.1 }
  ]);
  const result = compileLoop(traced);

  assert.equal(result.accepted, false);
  assert.equal(result.field.interaction, 'refused / open loop');
  assert.equal(result.field.form.revision, 0);
  assert.equal(geometrySignature(result.field), geometrySignature(quiet));
});

test('portrait v045 compiles a closed loop into the form that produced it', () => {
  const quiet = buildField();
  const traced = traceLoop(quiet, validLoop(1));
  const result = compileLoop(traced);

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'closed-loop-compile');
  assert.equal(result.event.relation, 'trace-rewrites-own-form');
  assert.equal(result.field.form.revision, 1);
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.form.mode, 'hinge');
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.form.aperture !== quiet.form.aperture || result.field.form.twist !== quiet.form.twist);
});

test('portrait v045 uses winding as a structural rule, not a cosmetic label', () => {
  const forward = compileLoop(traceLoop(buildField(), validLoop(1))).field;
  const reverse = compileLoop(traceLoop(buildField(), validLoop(-1))).field;

  assert.notEqual(forward.form.mode, reverse.form.mode);
  assert.notEqual(forward.form.twist, reverse.form.twist);
  assert.notEqual(forward.form.aperture, reverse.form.aperture);
});

test('portrait v045 compounds four loop compilations and lifts the exact prior form', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().form.revision, 0);
});

test('portrait v045 exposes loop, touch, keyboard, and non-hover paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v045/index.html');
  const sketch = await read('studies/self-portrait/v045/sketch.js');
  const style = await read('studies/self-portrait/v045/style.css');

  assert.match(html, /data-loop-stage/);
  assert.match(html, /data-action="compile"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /WEBGL/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /compileLoop/);
  assert.match(sketch, /__mutinePortraitV045/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v045 keeps controls outside the loop trace', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v045/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /event\.target\.closest\('\.compiler-controls'\)/);
});

test('portrait v045 has one canonical daily record and tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const works = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-07');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/self-portrait/v045/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-portrait-2026-11-07/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  const canonical = await readFile(new URL('../works/portrait-2026-11-07/index.html', import.meta.url), 'utf8');
  assert.match(canonical, /data-work-id="portrait-2026-11-07"/);
  assert.match(canonical, /catalog\.js/);
});
