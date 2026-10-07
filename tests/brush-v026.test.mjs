import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v026/engine.mjs';

 test('Brush v026 begins as a deterministic threshold slab, not a local mark', async () => {
  const { buildFrame, geometrySignature, GRID_COLS, GRID_ROWS } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'threshold-slab');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.cells.length, GRID_ROWS);
  assert.equal(frame.cells.every((row) => row.length === GRID_COLS), true);
  assert.equal(frame.cells.flat().every((cell) => Number.isFinite(cell.mass) && Number.isFinite(cell.shear)), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v026 samples one pressure but changes the global threshold field', async () => {
  const { applySqueeze, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const squeezed = applySqueeze(frame, 0.72, 'pointer-sample');
  const repeated = applySqueeze(squeezed, 0.72, 'pointer-sample');
  const second = applySqueeze(squeezed, 0.28, 'pointer-sample');
  const restored = (await import(engineUrl)).liftLatestSqueeze(second);

  assert.equal(squeezed.interaction, 'squeeze-committed');
  assert.equal(squeezed.memory.length, 1);
  assert.equal(squeezed.memory[0].kind, 'threshold-squeeze');
  assert.notEqual(geometrySignature(squeezed), geometrySignature(frame));
  assert.ok(squeezed.cells.flat().some((cell) => Math.abs(cell.shear) > 0.03));
  assert.ok(squeezed.cells.flat().some((cell) => cell.dryness > 0.25));
  assert.equal(repeated.interaction, 'squeeze-refused');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(squeezed));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(squeezed));
  assert.equal(geometrySignature(restored), geometrySignature(squeezed));
});

test('Brush v026 keeps a bounded pressure archive and can release it exactly', async () => {
  const { MEMORY_LIMIT, STAGES, applySqueeze, buildFrame, buildTimeline, geometrySignature, releaseSqueezes } = await import(engineUrl);
  let frame = buildFrame(0, []);
  for (const sample of [0.18, 0.72, 0.34, 0.86, 0.51, 0.27]) frame = applySqueeze(frame, sample, 'timeline');

  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.memory.every((event) => event.kind === 'threshold-squeeze'), true);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.cells.flat().some((cell) => cell.dryness > 0.45));
  assert.ok(settled.cells.flat().some((cell) => Math.abs(cell.shear) > 0.1));
  assert.equal(geometrySignature(releaseSqueezes(frame)), geometrySignature(buildFrame(0, [])));
});

test('Brush v026 exposes the threshold interaction and art-gate evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v026/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v026/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v026/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v026/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v026/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v026/critiques.json', root), 'utf8'));

  assert.match(index, /id="threshold-field"/);
  assert.match(index, /data-gesture="squeeze"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /preview-mode/);
  assert.match(sketch, /applySqueeze/);
  assert.match(sketch, /mouseClicked|pointerup/);
  assert.match(sketch, /squeeze-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D threshold slab');
  assert.equal(critiques.length, 6);
});

test('Brush v026 is registered exactly once for the 2026-10-07 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-07');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-07');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v026/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-07');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-06');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /threshold|pressure|global/i);

  const canonical = await readFile(new URL('works/brush-2026-10-07/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-07"/);
});
