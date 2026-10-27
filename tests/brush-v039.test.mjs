import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v039/engine.mjs');

const {
  BASIN_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyRemoval,
  buildFrame,
  buildTimeline,
  commitLoop,
  geometrySignature,
  liftLatest,
  previewLoop,
  releaseField
} = engine;

const CLOSED_LOOP = [
  { x: 0.48, y: 0.25 },
  { x: 0.58, y: 0.22 },
  { x: 0.65, y: 0.30 },
  { x: 0.63, y: 0.39 },
  { x: 0.54, y: 0.43 },
  { x: 0.45, y: 0.37 },
  { x: 0.48, y: 0.25 }
];

test('brush v039 begins as a deterministic continuous SVG wound field', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'closed-wound-field');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.basins.length, BASIN_COUNT);
  assert.ok(initial.contours.length >= 12);
  assert.ok(initial.channels.length >= 5);
  assert.equal(initial.renderer, 'deterministic inline SVG topological wound field');
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v039 previews an open loop without changing produced geometry', () => {
  const initial = buildFrame();
  const preview = previewLoop(initial, CLOSED_LOOP.slice(0, -1));

  assert.equal(preview.interaction, 'loop-preview');
  assert.equal(preview.memory.length, 0);
  assert.deepEqual(preview.pending.trace, CLOSED_LOOP.slice(0, -1));
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v039 converts a closed pressure loop into a true remembered wound', () => {
  const initial = buildFrame();
  const changed = commitLoop(initial, CLOSED_LOOP, 'test-closed-loop');

  assert.equal(changed.interaction, 'wound-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'closed-wound');
  assert.equal(changed.event.committed, true);
  assert.ok(changed.event.area > 0.01);
  assert.ok(changed.removed.includes(changed.event.basin));
  assert.ok(changed.holeCount >= 1);
  assert.ok(changed.contours.some((contour) => contour.wound > 0));
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v039 refuses open and undersized loops exactly', () => {
  const initial = buildFrame();
  const open = commitLoop(initial, CLOSED_LOOP.slice(0, -1), 'test-open');
  const tiny = commitLoop(initial, [{ x: 0.2, y: 0.2 }, { x: 0.205, y: 0.2 }, { x: 0.2, y: 0.2 }], 'test-tiny');

  assert.equal(open.interaction, 'loop-refused-open');
  assert.equal(tiny.interaction, 'loop-refused-small');
  assert.equal(open.memory.length, 0);
  assert.equal(tiny.memory.length, 0);
  assert.equal(geometrySignature(open), geometrySignature(initial));
  assert.equal(geometrySignature(tiny), geometrySignature(initial));
});

test('brush v039 lifts the latest wound exactly and release returns to quiet matter', () => {
  const initial = buildFrame();
  const changed = applyRemoval(initial, 2, 'test-removal');
  const lifted = liftLatest(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(lifted.interaction, 'lifted');
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releaseField(changed).memory.length, 0);
  assert.equal(releaseField(changed).interaction, 'released');
});

test('brush v039 bounds topological wound memory to four deterministic removals', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.equal(settled.holeCount, 4);
  assert.ok(settled.channels.some((channel) => channel.suture > 0));
});

test('brush v039 exposes an SVG-first closed-loop encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v039/index.html');
  const sketch = await read('studies/p5-brush/v039/sketch.js');
  const style = await read('studies/p5-brush/v039/style.css');
  const readme = await read('studies/p5-brush/v039/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v039/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v039/critiques.json'));

  assert.match(html, /id="wound-svg"/);
  assert.match(html, /data-gesture="remove"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitLoop/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523939');
  assert.equal(metrics.grammar, 'closed-wound-field');
  assert.equal(metrics.renderer, 'deterministic inline SVG topological wound field');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v039 is registered exactly once for the 2026-10-27 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-27');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-27');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v039/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-27');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-26');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /closed|loop|wound|topolog/i);
  const canonical = await readFile(new URL('works/brush-2026-10-27/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-27"/);
});
