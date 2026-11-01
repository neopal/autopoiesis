import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v044/engine.mjs');

const {
  BAND_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyScrape,
  beginScrape,
  buildFrame,
  buildTimeline,
  commitScrape,
  continueScrape,
  geometrySignature,
  liftLatest,
  previewScrape,
  releaseField
} = engine;

const LEFT_PATH = [
  { x: 0.08, y: 0.42 },
  { x: 0.26, y: 0.46 },
  { x: 0.51, y: 0.49 },
  { x: 0.74, y: 0.53 },
  { x: 0.92, y: 0.56 }
];

 test('brush v044 begins as a deterministic counterfield of pigment strata', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'counterfield-etch');
  assert.equal(initial.renderer, 'deterministic p5.js Canvas 2D pressure-field strata');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.body.strata.length, BAND_COUNT);
  assert.ok(initial.body.strata.every((stratum) => stratum.top.length > 6 && stratum.bottom.length > 6));
  assert.ok(initial.body.pressureThresholds.length >= 3);
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v044 keeps a pressure preview geometry-neutral until the edge-to-edge release', () => {
  const initial = buildFrame();
  const started = beginScrape(initial, LEFT_PATH[0]);
  const preview = previewScrape(continueScrape(started, LEFT_PATH[2]), LEFT_PATH[3]);

  assert.equal(started.interaction, 'scrape-armed');
  assert.equal(preview.pending.active, true);
  assert.ok(preview.pending.thresholdCrossed);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v044 commits a material scrape only after crossing the field threshold', () => {
  const initial = buildFrame();
  const started = beginScrape(initial, LEFT_PATH[0]);
  const moved = LEFT_PATH.slice(1).reduce((frame, point) => continueScrape(frame, point), started);
  const changed = commitScrape(moved, LEFT_PATH.at(-1), 'test-traverse');

  assert.equal(changed.interaction, 'scrape-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'counterfield-etch');
  assert.ok(['shear', 'powder'].includes(changed.event.mode));
  assert.ok(changed.event.thresholdCrossed);
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
  assert.ok(changed.body.cuts.length > 0 || changed.body.deposits.length > 0);
});

test('brush v044 refuses an interior start, a short traverse, and a reversed threshold miss without geometry change', () => {
  const initial = buildFrame();
  const interior = beginScrape(initial, { x: 0.5, y: 0.5 });
  const short = commitScrape(beginScrape(initial, LEFT_PATH[0]), { x: 0.31, y: 0.48 }, 'test-short');
  const reversed = commitScrape(beginScrape(initial, { x: 0.92, y: 0.56 }), { x: 0.08, y: 0.42 }, 'test-reverse');

  assert.equal(interior.interaction, 'scrape-refused-edge');
  assert.equal(short.interaction, 'scrape-refused-incomplete');
  assert.equal(reversed.interaction, 'scrape-refused-direction');
  assert.equal(geometrySignature(interior), geometrySignature(initial));
  assert.equal(geometrySignature(short), geometrySignature(initial));
  assert.equal(geometrySignature(reversed), geometrySignature(initial));
});

test('brush v044 compounds four pressure events, lifts exactly, and releases to the seed', () => {
  const initial = buildFrame();
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.state.scrapeCount, MEMORY_LIMIT);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('brush v044 exposes the production handoff and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v044/index.html');
  const sketch = await read('studies/p5-brush/v044/sketch.js');
  const style = await read('studies/p5-brush/v044/style.css');
  const readme = await read('studies/p5-brush/v044/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v044/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v044/critiques.json'));

  assert.match(html, /id="counterfield-canvas"/);
  assert.match(html, /data-gesture="traverse"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitScrape/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523434');
  assert.equal(metrics.grammar, 'counterfield-etch');
  assert.equal(metrics.renderer, 'deterministic p5.js Canvas 2D pressure-field strata');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 9);
});

test('brush v044 is registered exactly once for the 2026-11-01 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-01');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-01');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v044/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-11-01');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-31');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /threshold|scrape|field/i);
  const canonical = await readFile(new URL('works/brush-2026-11-01/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-01"/);
});
