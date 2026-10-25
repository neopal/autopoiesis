import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FILAMENT_COUNT,
  MEMORY_WINDOW,
  MIN_STROKE_POINTS,
  applyStroke,
  buildFrame,
  geometrySignature,
  liftLatestStroke
} = await import('../studies/pure-svg/v036/engine.mjs');

const STROKE = {
  points: [
    { x: 0.22, y: 0.72 },
    { x: 0.31, y: 0.64 },
    { x: 0.43, y: 0.56 },
    { x: 0.56, y: 0.39 }
  ]
};

test('SVG v036 turns a drawn path into remote filament growth without copying the gesture', () => {
  const initial = buildFrame();
  const next = applyStroke(initial, STROKE);

  assert.equal(initial.grammar, 'field-grown-filament');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'material-stroke');
  assert.equal(next.filaments.length, FILAMENT_COUNT);
  assert.ok(next.spinePath !== initial.spinePath, 'the open spine must be produced differently');
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.notEqual(next.event.sourceFilament, next.event.remoteFilament);
  assert.ok(next.filaments.filter((filament) => filament.role !== 'quiet').length >= 3);
  assert.ok(!next.spinePath.includes('0.22 0.72'), 'the visitor gesture must not be copied as a trace');
});

test('SVG v036 refuses weak or sprawling strokes and lifts the exact preceding growth', () => {
  const initial = buildFrame();
  const weak = applyStroke(initial, { points: [{ x: 0.4, y: 0.4 }, { x: 0.41, y: 0.4 }, { x: 0.42, y: 0.4 }] });
  const short = applyStroke(initial, { points: [{ x: 0.4, y: 0.4 }] });
  const sprawling = applyStroke(initial, { points: [{ x: 0.02, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.98, y: 0.5 }] });

  assert.equal(weak.memory.length, 0);
  assert.equal(weak.interaction, 'stroke-refused-short');
  assert.equal(short.memory.length, 0);
  assert.equal(short.interaction, 'stroke-refused-short');
  assert.equal(sprawling.memory.length, 0);
  assert.equal(sprawling.interaction, 'stroke-refused-sprawling');

  const committed = applyStroke(initial, STROKE);
  const lifted = liftLatestStroke(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v036 preserves deterministic bounded growth memory and releases to the seed', async () => {
  const { buildTimeline, releaseGrowth } = await import('../studies/pure-svg/v036/engine.mjs');
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.filaments.length, FILAMENT_COUNT);
  assert.ok(settled.state.growth > 0);
  assert.deepEqual(buildTimeline(), timeline);
  assert.deepEqual(applyStroke(buildFrame(), STROKE), applyStroke(buildFrame(), STROKE));

  const released = releaseGrowth();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(settled), geometrySignature(released));
});

test('SVG v036 exposes a tableau-first drawn-field encounter and honest production metadata', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v036/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v036/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v036/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v036/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v036/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="stroke"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /field\.addEventListener\('pointerdown'[\s\S]*?\}, true\);/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /applyStroke/);
  assert.match(sketch, /points/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG field-grown filament');
  assert.equal(metrics.commitThreshold, 'a bounded drawn path with at least three points');
});

test('SVG v036 is registered exactly once for the 2026-10-25 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-25');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-25');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v036/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-25');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-24');
  assert.equal(matches[0].source.referenceId, 'p5-brush');

  const canonical = await readFile(new URL('works/svg-2026-10-25/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-25"/);
});
