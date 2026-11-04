import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/p5-brush/v047/engine.mjs');
const {
  applyAttention,
  buildFrame,
  commitAttention,
  focusAt,
  geometrySignature,
  liftLatest,
  releaseField,
  buildTimeline,
  CELL_COUNT,
  MEMORY_LIMIT,
  STAGES
} = engine;

test('brush v047 begins as a deterministic reciprocal-drying field', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'reciprocal-drying-field');
  assert.equal(initial.renderer, 'deterministic p5.js 1.11.3 Canvas 2D reciprocal drying field');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.memoryLimit, MEMORY_LIMIT);
  assert.equal(initial.body.cells.length, CELL_COUNT);
  assert.ok(initial.body.cells.every((cell) => cell.mass > 0 && cell.radius > 0 && cell.notch > 0));
  assert.ok(initial.body.cells.every((cell) => cell.responseCount === 0));
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v047 previews local attention without spending geometry, then dries an untouched respondent', () => {
  const initial = buildFrame();
  const source = initial.body.cells[0];
  const focused = focusAt(initial, { x: source.x, y: source.y });
  const previewSignature = geometrySignature(focused);
  const committed = commitAttention(focused, 'test-attention');
  const direct = applyAttention(initial, source.id, 'test-direct');

  assert.equal(focused.interaction, 'attention-preview');
  assert.equal(focused.pending.active, true);
  assert.equal(focused.pending.sourceCell, source.id);
  assert.equal(focused.memory.length, 0);
  assert.equal(previewSignature, geometrySignature(initial));
  assert.equal(committed.interaction, 'attention-committed');
  assert.equal(committed.event.type, 'reciprocal-drying');
  assert.equal(committed.memory.length, 1);
  assert.notEqual(committed.event.sourceCell, committed.event.responseCell);
  assert.deepEqual(committed.body.cells[source.id], initial.body.cells[source.id]);
  assert.notEqual(committed.body.cells[committed.event.responseCell], initial.body.cells[committed.event.responseCell]);
  assert.equal(geometrySignature(committed), geometrySignature(direct));
});

test('brush v047 rejects empty attention and compounds four responses with exact lift and release', () => {
  const initial = buildFrame();
  const empty = focusAt(initial, { x: 0.5, y: 0.5 });
  const refused = commitAttention(empty);
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(empty.interaction, 'attention-refused-empty');
  assert.equal(empty.memory.length, 0);
  assert.equal(geometrySignature(empty), geometrySignature(initial));
  assert.equal(refused.interaction, 'attention-refused-unfocused');
  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.state.responseCount, MEMORY_LIMIT);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('brush v047 exposes the browser and catalogue handoff contract', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/p5-brush/v047/index.html',
    'studies/p5-brush/v047/sketch.js',
    'studies/p5-brush/v047/style.css',
    'studies/p5-brush/v047/README.md',
    'studies/p5-brush/v047/metrics.json',
    'studies/p5-brush/v047/critiques.json',
    'works/brush-2026-11-04/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/p5-brush/v047/index.html');
  const sketch = await read('studies/p5-brush/v047/sketch.js');
  const style = await read('studies/p5-brush/v047/style.css');
  const readme = await read('studies/p5-brush/v047/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v047/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v047/critiques.json'));
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-04');

  assert.match(html, /id="drying-field"/);
  assert.match(html, /data-gesture="attend"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /createCanvas\([^)]*\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) assert.match(readme, new RegExp(phrase, 'i'));
  assert.equal(metrics.seed, '0x42523437');
  assert.equal(metrics.grammar, 'reciprocal-drying-field');
  assert.equal(metrics.referenceId, 'little-critters');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-04');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v047/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-11-04');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  const canonical = await read('works/brush-2026-11-04/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-04"/);
});
