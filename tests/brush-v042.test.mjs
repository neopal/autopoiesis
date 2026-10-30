import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v042/engine.mjs');

const {
  MEMORY_LIMIT,
  STAGES,
  GRID_COLS,
  GRID_ROWS,
  WELL_COUNT,
  MIN_DWELL_MS,
  MAX_DWELL_MS,
  applyDwell,
  buildFrame,
  buildTimeline,
  commitDwell,
  geometrySignature,
  liftLatest,
  previewDwell,
  releasePlate
} = engine;

const WELL = { x: 0.18, y: 0.28 };
const REMOTE = { x: 0.78, y: 0.72 };

 test('brush v042 begins as one deterministic raster cure plate', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'dwell-cure-plate');
  assert.equal(initial.renderer, 'deterministic p5.js Canvas 2D raster cure plate');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.cells.length, GRID_COLS * GRID_ROWS);
  assert.equal(initial.zones.length, WELL_COUNT);
  assert.equal(geometrySignature(initial), geometrySignature(replay));
  assert.ok(initial.cells.some((cell) => cell.mask && cell.mass > 0.4));
  assert.ok(initial.cells.some((cell) => cell.mask && cell.crack > 0));
});

test('brush v042 previews a timed dwell without changing the plate', () => {
  const initial = buildFrame();
  const preview = previewDwell(initial, WELL, MIN_DWELL_MS + 220);

  assert.equal(preview.interaction, 'dwell-preview');
  assert.equal(preview.memory.length, 0);
  assert.notEqual(preview.pending.well, null);
  assert.equal(preview.pending.elapsed, MIN_DWELL_MS + 220);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v042 cures remote material only after a bounded dwell', () => {
  const initial = buildFrame();
  const changed = commitDwell(initial, WELL, MIN_DWELL_MS + 220, 'test-dwell');

  assert.equal(changed.interaction, 'dwell-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'remote-cure');
  assert.notEqual(changed.event.well, changed.event.sealZone);
  assert.notEqual(changed.event.well, changed.event.crackZone);
  assert.notEqual(changed.event.well, changed.event.bleedZone);
  assert.ok(changed.cells.some((cell, index) => cell.mask && geometrySignature(changed) !== geometrySignature(initial) && index > 0));
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v042 refuses a short dwell, an overcure, and a miss exactly', () => {
  const initial = buildFrame();
  const short = commitDwell(initial, WELL, MIN_DWELL_MS - 1, 'test-short');
  const over = commitDwell(initial, WELL, MAX_DWELL_MS + 1, 'test-over');
  const miss = commitDwell(initial, { x: 0.02, y: 0.02 }, MIN_DWELL_MS + 220, 'test-miss');

  assert.equal(short.interaction, 'dwell-refused-short');
  assert.equal(over.interaction, 'dwell-refused-overcured');
  assert.equal(miss.interaction, 'dwell-refused-miss');
  assert.equal(short.memory.length, 0);
  assert.equal(over.memory.length, 0);
  assert.equal(miss.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(initial));
  assert.equal(geometrySignature(over), geometrySignature(initial));
  assert.equal(geometrySignature(miss), geometrySignature(initial));
});

test('brush v042 lifts the latest cure exactly and release returns to the quiet plate', () => {
  const initial = buildFrame();
  const changed = applyDwell(initial, 0, MIN_DWELL_MS + 220, 'test-direct');
  const lifted = liftLatest(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(lifted.interaction, 'lifted');
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releasePlate(changed).interaction, 'released');
  assert.equal(releasePlate(changed).memory.length, 0);
});

test('brush v042 compounds four cures deterministically in one raster plate', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.ok(settled.cells.some((cell) => cell.bleed > 0));
  assert.ok(settled.cells.some((cell) => cell.crack > 0.25));
});

test('brush v042 exposes a timed raster encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v042/index.html');
  const sketch = await read('studies/p5-brush/v042/sketch.js');
  const style = await read('studies/p5-brush/v042/style.css');
  const readme = await read('studies/p5-brush/v042/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v042/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v042/critiques.json'));

  assert.match(html, /id="cure-canvas"/);
  assert.match(html, /data-gesture="cure"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitDwell/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /setTimeout|setInterval|performance\.now/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523432');
  assert.equal(metrics.grammar, 'dwell-cure-plate');
  assert.equal(metrics.renderer, 'deterministic p5.js Canvas 2D raster cure plate');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v042 is registered exactly once for the 2026-10-30 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-30');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-30');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v042/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-30');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-29');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /dwell|cure|remote|plate/i);
  const canonical = await readFile(new URL('works/brush-2026-10-30/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-30"/);
});
