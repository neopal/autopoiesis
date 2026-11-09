import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  CELL_COUNT,
  CUT_LIMIT,
  SEED,
  buildFrame,
  buildTimeline,
  cutCell,
  geometrySignature,
  liftLatest,
  releaseField
} = await import('../studies/p5-brush/v052/engine.mjs');

test('brush v052 begins as a deterministic vacancy register', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(SEED, 0x42523532);
  assert.equal(CELL_COUNT, 35);
  assert.equal(CUT_LIMIT, 4);
  assert.equal(first.composition, 'vacancy-register');
  assert.equal(first.renderer, 'canvas-2d');
  assert.equal(first.interaction, 'quiet substrate');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.cells.length, CELL_COUNT);
  assert.ok(first.body.cells.every((cell) => cell.present));
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('brush v052 turns one discrete cut into an actual vacancy and a global re-pack', () => {
  const quiet = buildFrame();
  const result = cutCell(quiet, 7);

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'vacancy-cut');
  assert.equal(result.event.index, 7);
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.body.cells[7].present, false);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.body.cells.some((cell, index) => index !== 7 && (cell.x !== quiet.body.cells[index].x || cell.y !== quiet.body.cells[index].y)));
});

test('brush v052 refuses repeated or out-of-range cuts without spending material', () => {
  const quiet = buildFrame();
  const changed = cutCell(quiet, 7).field;
  const repeated = cutCell(changed, 7);
  const invalid = cutCell(quiet, 99);

  assert.equal(repeated.accepted, false);
  assert.equal(repeated.event, null);
  assert.equal(geometrySignature(repeated.field), geometrySignature(changed));
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.event, null);
  assert.equal(geometrySignature(invalid.field), geometrySignature(quiet));
});

test('brush v052 makes cut order part of the re-pack geometry', () => {
  const forward = cutCell(cutCell(buildFrame(), 7).field, 23).field;
  const reverse = cutCell(cutCell(buildFrame(), 23).field, 7).field;

  assert.notEqual(geometrySignature(forward), geometrySignature(reverse));
  assert.deepEqual(forward.memory.map((event) => event.index), [7, 23]);
  assert.deepEqual(reverse.memory.map((event) => event.index), [23, 7]);
});

test('brush v052 compounds four vacancies and lifts the exact preceding register', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, CUT_LIMIT + 1);
  assert.equal(latest.memory.length, CUT_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, CUT_LIMIT - 1);
  assert.equal(releaseField().memory.length, 0);
  assert.equal(geometrySignature(releaseField()), geometrySignature(buildFrame()));
});

test('brush v052 exposes a canvas tableau and non-hover cut paths', async () => {
  const html = await read('studies/p5-brush/v052/index.html');
  const sketch = await read('studies/p5-brush/v052/sketch.js');
  const style = await read('studies/p5-brush/v052/style.css');

  assert.match(html, /data-register-stage/);
  assert.match(html, /data-register-canvas/);
  assert.match(html, /data-gesture="cut"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /cutCell/);
  assert.match(sketch, /__mutineBrushV052/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('brush v052 has one canonical daily record and tableau route', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'brush-2026-11-09');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'brush');
  assert.equal(matches[0].date, '2026-11-09');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v052/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-brush-2026-11-09/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.grammar, 'vacancy-register');
  const canonical = await read('works/brush-2026-11-09/index.html');
  assert.match(canonical, /data-work-id="brush-2026-11-09"/);
  assert.match(canonical, /catalog\.js/);
});

test('brush v052 records the art gate before the artwork is explained', async () => {
  const readme = await read('studies/p5-brush/v052/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v052/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v052/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.grammar, 'vacancy-register');
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.commitThreshold, 'one discrete cut on an occupied cell; repeated or empty cells refuse');
  assert.ok(critiques.some((critique) => critique.persona === 'Perceptual critic' && critique.status === 'unresolved'));
  assert.ok(critiques.some((critique) => critique.persona === 'Cynic' && critique.status === 'gate'));
});
