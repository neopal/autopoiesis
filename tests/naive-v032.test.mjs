import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NODE_COUNT,
  MEMORY_WINDOW,
  buildFrame,
  buildTimeline,
  commitPath,
  geometrySignature,
  liftLatestPath,
  releaseMemory,
  pathIsValid
} = await import('../studies/naive-art/v032/engine.mjs');

test('naive v032 begins as a deterministic recursive wrong-family tree', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'wrong-family-tree');
  assert.equal(first.memory.length, 0);
  assert.equal(first.nodes.length, NODE_COUNT);
  assert.equal(first.nodes.filter((node) => node.kind === 'branch-witness').length, NODE_COUNT);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.nodes.some((node) => node.parent === null));
});

test('naive v032 keeps an incomplete or repeated path geometry-neutral', () => {
  const baseline = buildFrame();
  const incomplete = commitPath(baseline, { path: [1, 3] });
  const repeated = commitPath(baseline, { path: [1, 3, 3] });

  assert.equal(incomplete.memory.length, 0);
  assert.equal(incomplete.interaction, 'path-refused');
  assert.equal(repeated.memory.length, 0);
  assert.equal(repeated.interaction, 'path-refused');
  assert.equal(geometrySignature(incomplete), geometrySignature(baseline));
  assert.equal(geometrySignature(repeated), geometrySignature(baseline));
});

test('naive v032 commits a three-stop path as an actual wrong-parent topology', () => {
  const baseline = buildFrame();
  const changed = commitPath(baseline, { path: [1, 3, 8] });
  const event = changed.memory.at(-1);
  const changedNodes = changed.nodes.filter((node, index) => geometrySignature({ nodes: [node] }) !== geometrySignature({ nodes: [baseline.nodes[index]] }));

  assert.equal(event.kind, 'wrong-parent');
  assert.deepEqual(event.path, [1, 3, 8]);
  assert.notEqual(event.remote, 1);
  assert.notEqual(event.remote, 3);
  assert.notEqual(event.remote, 8);
  assert.equal(changedNodes.length, 4);
  assert.equal(changed.nodes[1].state, 'unparented');
  assert.equal(changed.nodes[3].state, 'misparented');
  assert.equal(changed.nodes[8].state, 'remembering');
  assert.equal(changed.nodes[event.remote].state, 'orphan-gap');
  assert.notEqual(changed.nodes[3].parent, baseline.nodes[3].parent);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
});

test('naive v032 exposes a DOM tree tableau and its path interaction surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('studies/naive-art/v032/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/naive-art/v032/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/naive-art/v032/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/naive-art/v032/README.md', root), 'utf8');

  assert.match(html, /id="family-tree"/);
  assert.match(html, /data-action="path"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutineNaiveV032/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('naive v032 bounds path memory and lifts the exact preceding topology', () => {
  let frame = buildFrame();
  const signatures = [geometrySignature(frame)];
  for (const path of [...buildTimeline(), ...buildTimeline()]) {
    assert.equal(pathIsValid(path), true);
    frame = commitPath(frame, { path });
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatestPath(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseMemory(frame)), signatures[0]);
});

test('naive v032 is registered exactly once for the 2026-10-22 daily slot with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'naive' && entry.date === '2026-10-22');
  const work = matches[0];
  const canonical = await readFile(new URL('works/naive-2026-10-22/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'naive-2026-10-22');
  assert.equal(work.rawPath, '/studies/naive-art/v032/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-naive-2026-10-22');
  assert.equal(work.decision.lineage, 'naive-2026-10-20');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(canonical, /data-catalog-work-detail="naive-2026-10-22"/);
});
