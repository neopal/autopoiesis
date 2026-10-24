import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PORT_COUNT,
  MEMORY_WINDOW,
  MIN_DWELL_MS,
  MAX_DWELL_MS,
  applyAttention,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAttention,
  releaseTopology
} = await import('../studies/pure-svg/v035/engine.mjs');

test('SVG v035 turns situated attention into a non-local topological opening', () => {
  const initial = buildFrame();
  const next = applyAttention(initial, { x: 0.76, y: 0.22, duration: 520 });

  assert.equal(initial.grammar, 'attention-topology');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'attention-rewire');
  assert.equal(next.ports.length, PORT_COUNT);
  assert.ok(next.bodyPath !== initial.bodyPath, 'the topology path must change');
  assert.notEqual(next.event.watchedPort, next.event.unobservedPort);
  assert.ok(next.ports.filter((port) => port.role !== 'quiet').length >= 3);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
});

test('SVG v035 refuses weak or over-held attention and lifts the exact prior topology', () => {
  const initial = buildFrame();
  const weak = applyAttention(initial, { x: 0.5, y: 0.5, duration: MIN_DWELL_MS - 1 });
  const held = applyAttention(initial, { x: 0.5, y: 0.5, duration: MAX_DWELL_MS + 1 });
  assert.equal(weak.memory.length, 0);
  assert.equal(weak.interaction, 'attention-refused-flicker');
  assert.equal(held.memory.length, 0);
  assert.equal(held.interaction, 'attention-refused-overheld');

  const committed = applyAttention(initial, { x: 0.5, y: 0.5, duration: 520 });
  const lifted = liftLatestAttention(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v035 preserves bounded attention memory and deterministic topology replay', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.ports.length, PORT_COUNT);
  assert.ok(settled.state.cuts.length >= 3, 'successive attention should open more than one threshold');
  assert.deepEqual(buildTimeline(), timeline);
  assert.deepEqual(
    applyAttention(buildFrame(), { x: 0.23, y: 0.77, duration: 420 }),
    applyAttention(buildFrame(), { x: 0.23, y: 0.77, duration: 420 })
  );

  const released = releaseTopology();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(settled), geometrySignature(released));
});

test('SVG v035 exposes a tableau-first topological attention encounter', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v035/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v035/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v035/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v035/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v035/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attention"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /duration/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG attention topology');
  assert.equal(metrics.commitThreshold, 'bounded dwell that reroutes an unobserved opening');
});

test('SVG v035 is registered exactly once for the 2026-10-24 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-24');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-24');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v035/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-24');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-22');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-24/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-24"/);
});
