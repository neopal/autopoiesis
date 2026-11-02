import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v045/engine.mjs');

const {
  applyCompression,
  beginCompression,
  buildFrame,
  buildTimeline,
  continueCompression,
  geometrySignature,
  liftLatest,
  MEMORY_LIMIT,
  PANEL_COUNT,
  previewCompression,
  releaseField,
  STAGES
} = engine;

test('brush v045 begins as a deterministic opposing-jaw clasp', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'opposing-jaw-clasp');
  assert.equal(initial.renderer, 'deterministic p5.js Canvas 2D compressed pigment clasp');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.body.panels.length, PANEL_COUNT);
  assert.ok(initial.body.panels.every((panel) => panel.vertices.length >= 4));
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('brush v045 keeps a single jaw compression geometry-neutral until both sides close', () => {
  const initial = buildFrame();
  const armed = beginCompression(initial, { x: 0.08, y: 0.38 });
  const preview = previewCompression(continueCompression(armed, { x: 0.46, y: 0.38 }), { x: 0.46, y: 0.38 });
  const leftSet = engine.commitCompression(preview, { x: 0.46, y: 0.38 });

  assert.equal(armed.interaction, 'compression-armed-left');
  assert.equal(preview.pending.active, true);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
  assert.equal(leftSet.interaction, 'compression-left-set');
  assert.equal(leftSet.pending.leftReady, true);
  assert.equal(geometrySignature(leftSet), geometrySignature(initial));
});

test('brush v045 commits only when opposing jaws close in the correct order', () => {
  const initial = buildFrame();
  const leftSet = engine.commitCompression(
    beginCompression(initial, { x: 0.08, y: 0.36 }),
    { x: 0.44, y: 0.36 },
    'test-left'
  );
  const rightArmed = beginCompression(leftSet, { x: 0.92, y: 0.64 });
  const changed = engine.commitCompression(rightArmed, { x: 0.56, y: 0.64 }, 'test-opposing');

  assert.equal(changed.interaction, 'compression-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'opposing-compression');
  assert.ok(changed.event.pressure > 0.36);
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v045 refuses interior, incomplete, and reversed compression without geometry change', () => {
  const initial = buildFrame();
  const interior = beginCompression(initial, { x: 0.5, y: 0.5 });
  const incomplete = engine.commitCompression(beginCompression(initial, { x: 0.08, y: 0.5 }), { x: 0.22, y: 0.5 });
  const reversed = applyCompression(initial, { x: 0.58, y: 0.5 }, { x: 0.42, y: 0.5 }, 'test-reversed');

  assert.equal(interior.interaction, 'compression-refused-interior');
  assert.equal(incomplete.interaction, 'compression-refused-incomplete');
  assert.equal(reversed.interaction, 'compression-refused-order');
  assert.equal(geometrySignature(interior), geometrySignature(initial));
  assert.equal(geometrySignature(incomplete), geometrySignature(initial));
  assert.equal(geometrySignature(reversed), geometrySignature(initial));
});

test('brush v045 compounds four compression memories, lifts exactly, and releases to the seed', () => {
  const initial = buildFrame();
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.state.compressionCount, MEMORY_LIMIT);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('brush v045 exposes the production handoff and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v045/index.html');
  const sketch = await read('studies/p5-brush/v045/sketch.js');
  const style = await read('studies/p5-brush/v045/style.css');
  const readme = await read('studies/p5-brush/v045/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v045/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v045/critiques.json'));

  assert.match(html, /id="clasp-canvas"/);
  assert.match(html, /data-gesture="compress"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitCompression/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523435');
  assert.equal(metrics.grammar, 'opposing-jaw-clasp');
  assert.equal(metrics.renderer, 'deterministic p5.js Canvas 2D compressed pigment clasp');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 9);
});

test('brush v045 is registered exactly once for the 2026-11-02 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-02');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-02');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v045/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-11-02');
  assert.equal(matches[0].decision.lineage, 'brush-2026-11-01');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /oppos|jaw|compression/i);
  const canonical = await readFile(new URL('works/brush-2026-11-02/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-02"/);
});
