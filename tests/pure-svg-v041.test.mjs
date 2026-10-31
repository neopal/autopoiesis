import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_WINDOW,
  NODE_COUNT,
  buildFrame,
  geometrySignature
} = await import('../studies/pure-svg/v041/engine.mjs');

test('SVG v041 builds a quiet deterministic hinge register', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'hinge-register');
  assert.equal(first.nodes.length, NODE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.nodes.every((node) => node.signature.length > 20));
});

test('SVG v041 arms a three-node route without changing hinge geometry', async () => {
  const { armNode } = await import('../studies/pure-svg/v041/engine.mjs');
  const initial = buildFrame();
  const armed = armNode(armNode(armNode(initial, 0), 4), 8);

  assert.deepEqual(armed.selection, [0, 4, 8]);
  assert.equal(armed.interaction, 'route-ready');
  assert.equal(armed.event.committed, false);
  assert.equal(geometrySignature(armed), geometrySignature(initial));
  assert.deepEqual(armed.nodes.map((node) => node.signature), initial.nodes.map((node) => node.signature));
});

test('SVG v041 commits a route into three remote hinge changes', async () => {
  const { armNode, commitRoute } = await import('../studies/pure-svg/v041/engine.mjs');
  const initial = buildFrame();
  const armed = armNode(armNode(armNode(initial, 0), 4), 8);
  const committed = commitRoute(armed);

  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'route-committed');
  assert.equal(committed.event.type, 'route-verdict');
  assert.deepEqual(committed.event.sourceIndices, [0, 4, 8]);
  assert.equal(committed.event.remoteIndices.length, 3);
  assert.ok(committed.event.remoteIndices.every((index) => !committed.event.sourceIndices.includes(index)));
  assert.notEqual(geometrySignature(committed), geometrySignature(initial));
  for (const index of committed.event.sourceIndices) {
    assert.equal(committed.nodes[index].signature, initial.nodes[index].signature);
  }
  assert.ok(committed.event.remoteIndices.some((index) => committed.nodes[index].signature !== initial.nodes[index].signature));
});

test('SVG v041 compounds four routes, lifts exactly, and releases to seed', async () => {
  const { buildTimeline, liftLatestRoute, releaseRegister } = await import('../studies/pure-svg/v041/engine.mjs');
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestRoute(settled);
  const released = releaseRegister();

  assert.equal(timeline.length, MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.routeCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('SVG v041 refuses incomplete or duplicate routes without a geometry shortcut', async () => {
  const { armNode, commitRoute } = await import('../studies/pure-svg/v041/engine.mjs');
  const initial = buildFrame();
  const incomplete = armNode(initial, 2);
  const duplicate = armNode(incomplete, 2);
  const complete = armNode(armNode(incomplete, 5), 7);
  const fourth = armNode(complete, 8);

  assert.equal(commitRoute(initial).interaction, 'route-refused-incomplete');
  assert.equal(geometrySignature(commitRoute(initial)), geometrySignature(initial));
  assert.deepEqual(duplicate.selection, [2]);
  assert.equal(geometrySignature(duplicate), geometrySignature(initial));
  assert.deepEqual(fourth.selection, complete.selection);
  assert.equal(fourth.interaction, 'route-neutral');
  assert.equal(geometrySignature(fourth), geometrySignature(complete));
});

test('SVG v041 exposes the production handoff and blind-preview contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v041/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v041/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v041/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v041/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v041/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="verdict"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /armNode/);
  assert.match(sketch, /commitRoute/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG hinge register');
  assert.equal(metrics.commitThreshold, 'three distinct hinges selected, then one verdict committed');
});

test('SVG v041 is registered exactly once for the 2026-10-31 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-31');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-31');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v041/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-31');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-30');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-31/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-31"/);
});
