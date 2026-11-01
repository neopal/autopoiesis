import test from 'node:test';
import assert from 'node:assert/strict';

const {
  GATE_COUNT,
  MEMORY_WINDOW,
  buildFrame,
  geometrySignature
} = await import('../studies/pure-svg/v042/engine.mjs');

test('SVG v042 builds a deterministic quiet chamber body', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'chamber-body');
  assert.equal(first.chambers.length, 7);
  assert.equal(first.gates.length, GATE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.chambers.every((chamber) => chamber.signature.length > 20));
});

test('SVG v042 makes a continuous two-gate sweep geometry-neutral until release', async () => {
  const { beginSweep, visitGate, commitSweep, GATE_CHAMBERS } = await import('../studies/pure-svg/v042/engine.mjs');
  const initial = buildFrame();
  const armed = visitGate(beginSweep(initial, 0), 3);
  const committed = commitSweep(armed);

  assert.deepEqual(armed.pending, [0, 3]);
  assert.equal(armed.interaction, 'sweep-ready');
  assert.equal(geometrySignature(armed), geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'sweep-committed');
  assert.equal(committed.event.type, 'chamber-knot');
  assert.deepEqual(committed.event.sourceIndices, [0, 3]);
  assert.equal(committed.event.remoteIndices.length, 3);
  assert.ok(committed.event.remoteIndices.every((index) => !committed.event.sourceIndices.map((gate) => GATE_CHAMBERS[gate]).includes(index)));
  assert.notEqual(geometrySignature(committed), geometrySignature(initial));
  for (const gate of committed.event.sourceIndices) {
    assert.equal(committed.chambers[GATE_CHAMBERS[gate]].signature, initial.chambers[GATE_CHAMBERS[gate]].signature);
  }
});


test('SVG v042 compounds four chamber knots, lifts exactly, and releases to seed', async () => {
  const { buildTimeline, liftLatestSweep, releaseRegister } = await import('../studies/pure-svg/v042/engine.mjs');
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestSweep(settled);
  const released = releaseRegister();

  assert.equal(timeline.length, MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.sweepCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('SVG v042 refuses an incomplete or repeated gate without a geometry shortcut', async () => {
  const { beginSweep, visitGate, commitSweep } = await import('../studies/pure-svg/v042/engine.mjs');
  const initial = buildFrame();
  const started = beginSweep(initial, 2);
  const repeated = visitGate(started, 2);
  const incomplete = commitSweep(started);
  const ready = visitGate(repeated, 5);
  const fourth = visitGate(ready, 1);

  assert.deepEqual(repeated.pending, [2]);
  assert.equal(geometrySignature(repeated), geometrySignature(initial));
  assert.equal(incomplete.interaction, 'sweep-refused-incomplete');
  assert.equal(geometrySignature(incomplete), geometrySignature(initial));
  assert.deepEqual(fourth.pending, ready.pending);
  assert.equal(geometrySignature(fourth), geometrySignature(ready));
});

test('SVG v042 is registered exactly once for the 2026-11-01 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-11-01');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-11-01');
  assert.equal(matches[0].title, 'The body knots a second opening.');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v042/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-11-01');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-31');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-11-01/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-01"/);
});

test('SVG v042 exposes the production handoff and blind-preview contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v042/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v042/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v042/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v042/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v042/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="cross"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginSweep/);
  assert.match(sketch, /commitSweep/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG chamber body');
  assert.equal(metrics.commitThreshold, 'one continuous sweep crossing two distinct gates, then one chamber knot committed');
});
