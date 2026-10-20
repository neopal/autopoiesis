import test from 'node:test';
import assert from 'node:assert/strict';

const {
  TILE_COUNT,
  buildFrame,
  geometrySignature,
  commitAttention
} = await import('../studies/naive-art/v031/engine.mjs');

test('naive v031 begins as a deterministic orbit of counterfeit paper witnesses', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'counterfeit-orbit');
  assert.equal(first.memory.length, 0);
  assert.equal(first.tiles.length, TILE_COUNT);
  assert.ok(first.tiles.every((tile) => tile.kind === 'paper-witness'));
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('naive v031 turns a valid paired attention into a remote counterfeit, not a local cosmetic change', () => {
  const baseline = buildFrame();
  const changed = commitAttention(baseline, {
    first: 1,
    second: 4,
    dwell: 620,
    distance: 0.28
  });
  const event = changed.memory.at(-1);
  const changedTiles = changed.tiles.filter((tile, index) => geometrySignature({ tiles: [tile] }) !== geometrySignature({ tiles: [baseline.tiles[index]] }));

  assert.equal(event.kind, 'reciprocal-misread');
  assert.equal(event.first, 1);
  assert.equal(event.second, 4);
  assert.equal(event.sourceMark, baseline.tiles[1].mark);
  assert.equal(event.copiedMark, baseline.tiles[1].mark);
  assert.notEqual(event.remote, event.first);
  assert.notEqual(event.remote, event.second);
  assert.equal(changedTiles.length, 3);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(changed.tiles[event.first].state, 'averted');
  assert.equal(changed.tiles[event.second].state, 'counterfeit');
  assert.equal(changed.tiles[event.remote].state, 'vacant-witness');
});

test('naive v031 exposes a native WebGL witness tableau and a work-specific pairing path', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('studies/naive-art/v031/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/naive-art/v031/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/naive-art/v031/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/naive-art/v031/README.md', root), 'utf8');

  assert.match(html, /id="witness-canvas"/);
  assert.match(html, /data-action="pair"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /getContext\(['"]webgl2?['"]\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutineNaiveV031/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('naive v031 is registered exactly once for the 2026-10-20 daily slot with a canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'naive' && entry.date === '2026-10-20');
  const work = matches[0];
  const canonical = await readFile(new URL('works/naive-2026-10-20/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'naive-2026-10-20');
  assert.equal(work.rawPath, '/studies/naive-art/v031/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-naive-2026-10-20');
  assert.equal(work.decision.lineage, 'naive-2026-10-19');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(canonical, /data-catalog-work-detail="naive-2026-10-20"/);
});

test('naive v031 bounds reciprocal memory and lifts the exact preceding orbit', async () => {
  const { buildFrame, buildTimeline, commitAttention, geometrySignature, liftLatestAttention, releaseMemory, MEMORY_WINDOW } = await import('../studies/naive-art/v031/engine.mjs');
  let frame = buildFrame();
  const signatures = [geometrySignature(frame)];
  for (const attention of [...buildTimeline(), ...buildTimeline()]) {
    frame = commitAttention(frame, attention);
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatestAttention(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseMemory(frame)), signatures[0]);
});
