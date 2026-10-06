import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_LIMIT,
  PORT_COUNT,
  applyWitnessPair,
  armWitness,
  buildFrame,
  geometrySignature,
  liftLatestWitness,
  releaseWitness
} = await import('../studies/pure-svg/v024/engine.mjs');

test('SVG v024 begins as one asymmetrical witness-knot with a single compound path', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'witness-knot');
  assert.equal(frame.ports.length, PORT_COUNT);
  assert.equal(frame.ports.every((port) => port.points.length >= 5), true);
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.knot.closed, true);
  assert.equal(frame.knot.fillRule, 'evenodd');
  assert.equal(frame.knot.pathCount, 1);
  assert.equal(frame.primitiveBudget, 1);
  assert.equal('chambers' in frame, false);
  assert.equal('facets' in frame, false);
  assert.equal('ribbon' in frame, false);
});

test('SVG v024 keeps a first witness as latent attention and commits only a distinct second witness', () => {
  const frame = buildFrame(0, []);
  const armed = armWitness(frame, 2);
  const refused = applyWitnessPair(armed, 2, 2);
  const next = applyWitnessPair(armed, 2, 5);
  const replay = applyWitnessPair(armed, 2, 5);
  const restored = liftLatestWitness(next);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed, 2);
  assert.equal(geometrySignature(armed), geometrySignature(frame));
  assert.equal(refused.witness.committed, false);
  assert.equal(refused.interaction, 'same-witness-refused');
  assert.equal(refused.memory.length, 0);
  assert.equal(next.witness.gesture, 'two-witness-click');
  assert.equal(next.witness.mode, 'topological-splice');
  assert.equal(next.witness.source, 2);
  assert.equal(next.witness.remote, 5);
  assert.equal(next.witness.committed, true);
  assert.equal(next.ports[2].role, 'sealed');
  assert.equal(next.ports[5].role, 'opened');
  assert.notEqual(next.knot.pathSignature, frame.knot.pathSignature);
  assert.notEqual(next.ports[2].pathSignature, frame.ports[2].pathSignature);
  assert.notEqual(next.ports[5].pathSignature, frame.ports[5].pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v024 bounds witness memory and releases to the deterministic baseline', () => {
  let frame = buildFrame(0, []);

  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    const source = index % PORT_COUNT;
    const remote = (source + 2 + index) % PORT_COUNT;
    frame = applyWitnessPair(frame, source, remote);
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.memory.every((event) => event.gesture === 'two-witness-click'), true);
  assert.ok(frame.ports.some((port) => port.role === 'opened'));
  assert.ok(frame.ports.some((port) => port.role === 'sealed'));
  assert.notEqual(frame.memory[0].source, frame.memory.at(-1).source);
  assert.equal(geometrySignature(releaseWitness()), geometrySignature(buildFrame(0, [])));
});

test('SVG v024 exposes a tableau-first study and explicit art gate evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v024/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v024/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v024/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v024/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v024/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/pure-svg/v024/critiques.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="splice"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyWitnessPair/);
  assert.match(sketch, /two-witness-click/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.port/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG witness-knot');
  assert.equal(critiques.length, 5);
});

test('SVG v024 is registered exactly once for the 2026-10-06 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-06');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-06');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v024/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-06');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-05');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /witness|splice|topology/i);

  const canonical = await readFile(new URL('works/svg-2026-10-06/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-06"/);
});
