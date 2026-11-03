import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/p5-brush/v046/engine.mjs');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const {
  applyCut,
  beginCut,
  buildFrame,
  commitCut,
  continueCut,
  buildTimeline,
  geometrySignature,
  liftLatest,
  MASS_COUNT,
  previewCut,
  releaseField,
  MEMORY_LIMIT,
  STAGES
} = engine;

test('brush v046 begins as a deterministic depth-cut monolith', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'depth-cut-monolith');
  assert.equal(initial.renderer, 'deterministic p5.js 1.11.3 WebGL depth-cut monolith');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.body.mass.length, MASS_COUNT);
  assert.ok(initial.body.mass.every((piece) => piece.depth > 0 && piece.width > 0 && piece.height > 0));
  assert.ok(initial.body.voids.some((voidCell) => voidCell.depth > 0));
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v046 keeps a cut inert until it travels through the central void and exits the opposite bank', () => {
  const initial = buildFrame();
  const armed = beginCut(initial, { x: 0.08, y: 0.46 });
  const preview = continueCut(armed, { x: 0.5, y: 0.5 });
  const committed = commitCut(preview, { x: 0.92, y: 0.54 }, 'test-through-void');
  const direct = applyCut(initial, { x: 0.08, y: 0.46 }, { x: 0.92, y: 0.54 }, [{ x: 0.08, y: 0.46 }, { x: 0.5, y: 0.5 }, { x: 0.92, y: 0.54 }], 'test-direct');

  assert.equal(armed.interaction, 'cut-armed-left');
  assert.equal(preview.interaction, 'cut-preview');
  assert.equal(preview.pending.throughVoid, true);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
  assert.equal(committed.interaction, 'cut-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'through-void-cut');
  assert.notEqual(geometrySignature(committed), geometrySignature(initial));
  assert.equal(geometrySignature(committed), geometrySignature(direct));
});

test('brush v046 exposes a preview operation that never spends material', () => {
  const initial = buildFrame();
  const preview = previewCut(beginCut(initial, { x: 0.92, y: 0.58 }), { x: 0.5, y: 0.5 });

  assert.equal(preview.interaction, 'cut-preview');
  assert.equal(preview.pending.throughVoid, true);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v046 compounds four depth cuts, lifts exactly, and releases to the seed', () => {
  const initial = buildFrame();
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.state.cutCount, MEMORY_LIMIT);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('brush v046 exposes the browser handoff contract', async () => {
  for (const path of [
    'studies/p5-brush/v046/index.html',
    'studies/p5-brush/v046/sketch.js',
    'studies/p5-brush/v046/style.css',
    'studies/p5-brush/v046/README.md',
    'studies/p5-brush/v046/metrics.json',
    'studies/p5-brush/v046/critiques.json',
    'works/brush-2026-11-03/index.html'
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
  }
  const html = await read('studies/p5-brush/v046/index.html');
  const sketch = await read('studies/p5-brush/v046/sketch.js');
  const style = await read('studies/p5-brush/v046/style.css');
  const readme = await read('studies/p5-brush/v046/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v046/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v046/critiques.json'));

  assert.match(html, /id="cut-field"/);
  assert.match(html, /data-gesture="cut"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /createCanvas\([^)]*WEBGL/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523436');
  assert.equal(metrics.grammar, 'depth-cut-monolith');
  assert.equal(metrics.renderer, 'deterministic p5.js 1.11.3 WebGL depth-cut monolith');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('brush v046 is registered exactly once for the 2026-11-03 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-03');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-03');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v046/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-11-03');
  assert.equal(matches[0].decision.lineage, 'brush-2026-11-02');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /void|depth|opposite/i);
  const canonical = await read('works/brush-2026-11-03/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-03"/);
});
