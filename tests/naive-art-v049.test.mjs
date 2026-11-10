import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  CELL_COUNT,
  MEMORY_LIMIT,
  PRESSURE_THRESHOLD,
  buildFrame,
  buildTimeline,
  commitPressure,
  geometrySignature,
  liftLatest,
  releaseMemory
} = await import('../studies/naive-art/v049/engine.mjs');

test('Naive v049 begins as a deterministic SVG pressure topology', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(CELL_COUNT, 12);
  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.composition, 'pressure-topology');
  assert.equal(first.renderer, 'svg');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.cells.length, CELL_COUNT);
  assert.equal(first.body.joins.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('Naive v049 converts opposed pressure into whole-topology geometry', () => {
  const quiet = buildFrame();
  const result = commitPressure(quiet, {
    direction: -0.42,
    opposition: 0.82,
    pressure: 0.78,
    resistance: 0.74,
    turns: 3
  });

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'pressure-fold');
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.body.joins.length, 1);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.body.cells.every((cell, index) => {
    const base = quiet.body.cells[index];
    return cell.x !== base.x || cell.y !== base.y || cell.angle !== base.angle || cell.scale !== base.scale;
  }));
  assert.notDeepEqual(result.field.body.apertures, quiet.body.apertures);
});

test('Naive v049 refuses a cosmetic, weak, or unopposed gesture', () => {
  const quiet = buildFrame();
  for (const gesture of [
    { direction: 0.1, opposition: 0.81, pressure: 0.8, resistance: 0.2, turns: 3 },
    { direction: 0.1, opposition: 0.2, pressure: 0.9, resistance: 0.8, turns: 3 },
    { direction: 0.1, opposition: 0.8, pressure: 0.2, resistance: 0.8, turns: 3 },
    { direction: 0.1, opposition: 0.8, pressure: 0.8, resistance: 0.8, turns: 1 }
  ]) {
    const result = commitPressure(quiet, gesture);
    assert.equal(result.accepted, false);
    assert.equal(geometrySignature(result.field), geometrySignature(quiet));
  }
  assert.ok(PRESSURE_THRESHOLD > 0.5);
});

test('Naive v049 makes order part of topology and lifts exactly', () => {
  const first = { direction: -0.42, opposition: 0.82, pressure: 0.78, resistance: 0.74, turns: 3 };
  const second = { direction: 1.18, opposition: 0.72, pressure: 0.69, resistance: 0.77, turns: 4 };
  const forward = commitPressure(commitPressure(buildFrame(), first).field, second).field;
  const reverse = commitPressure(commitPressure(buildFrame(), second).field, first).field;
  const timeline = buildTimeline();

  assert.notEqual(geometrySignature(forward), geometrySignature(reverse));
  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(timeline.at(-1).memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(liftLatest(timeline.at(-1))), geometrySignature(timeline.at(-2)));
  assert.equal(releaseMemory().memory.length, 0);
  assert.equal(geometrySignature(releaseMemory()), geometrySignature(buildFrame()));
});

test('Naive v049 exposes an SVG pressure tableau and non-hover paths', async () => {
  const html = await read('studies/naive-art/v049/index.html');
  const sketch = await read('studies/naive-art/v049/sketch.js');
  const style = await read('studies/naive-art/v049/style.css');
  const readme = await read('studies/naive-art/v049/README.md');

  assert.match(html, /<svg[^>]+id="pressure-svg"/);
  assert.match(html, /data-action="fold"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /__mutineNaiveV049/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('Naive v049 has one honest daily record and canonical route', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'naive-2026-11-10');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'naive');
  assert.equal(matches[0].date, '2026-11-10');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v049/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-naive-2026-11-10/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.grammar, 'pressure-topology');
  const canonical = await read('works/naive-2026-11-10/index.html');
  assert.match(canonical, /data-work-id="naive-2026-11-10"/);
  assert.match(canonical, /catalog\.js/);
});

test('Naive v049 records unresolved perceptual and deletion gates', async () => {
  const metrics = JSON.parse(await read('studies/naive-art/v049/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v049/critiques.json'));

  assert.equal(metrics.grammar, 'pressure-topology');
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.ok(critiques.some((critique) => critique.persona === 'Perceptual critic' && critique.status === 'unresolved'));
  assert.ok(critiques.some((critique) => critique.persona === 'Cynic' && critique.status === 'gate'));
});
