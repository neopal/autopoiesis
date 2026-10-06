import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFrame, geometrySignature } = await import('../studies/p5-brush/v025/engine.mjs');

test('Brush v025 begins as one deterministic hanging membrane', () => {
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'hanging-membrane');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.nodes.length, 9);
  assert.equal(frame.nodes.every((row) => row.length === 17), true);
  assert.equal(frame.nodes.flat().every((node) => Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)), true);
  assert.equal(frame.hinges.length, 0);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v025 commits a hinge into real depth geometry and reverses exactly', async () => {
  const { applyHinge, liftLatestHinge, releaseHinges } = await import('../studies/p5-brush/v025/engine.mjs');
  const frame = buildFrame(0, []);
  const folded = applyHinge(frame, 3, 'left');
  const repeated = applyHinge(folded, 3, 'left');
  const second = applyHinge(folded, 6, 'right');
  const restored = liftLatestHinge(second);

  assert.equal(folded.interaction, 'hinge-committed');
  assert.equal(folded.memory.length, 1);
  assert.deepEqual(folded.hinges[0], { row: 3, side: 'left' });
  assert.notEqual(geometrySignature(folded), geometrySignature(frame));
  assert.ok(folded.nodes.slice(4).flat().some((node) => Math.abs(node.z) > 0.04 && node.fold > 0));
  assert.equal(repeated.interaction, 'hinge-refused');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(folded));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(folded));
  assert.equal(geometrySignature(restored), geometrySignature(folded));
  assert.equal(releaseHinges(second).memory.length, 0);
  assert.equal(geometrySignature(releaseHinges(second)), geometrySignature(frame));
});

test('Brush v025 bounds hinge memory and exposes a settled material state', async () => {
  const { MEMORY_LIMIT, STAGES, buildTimeline, applyHinge } = await import('../studies/p5-brush/v025/engine.mjs');
  let frame = buildTimeline(1)[0];

  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    frame = applyHinge(frame, index + 1, index % 2 ? 'right' : 'left');
  }

  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.memory.every((event) => event.kind === 'weight-hinge'), true);
  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.nodes.flat().some((node) => node.fold > 0.2));
  assert.ok(settled.nodes.flat().some((node) => Math.abs(node.z) > 0.1));
});

test('Brush v025 exposes the tableau, interaction contract, and art-gate evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v025/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v025/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v025/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v025/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v025/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v025/critiques.json', root), 'utf8'));

  assert.match(index, /id="membrane-field"/);
  assert.match(index, /data-gesture="hinge"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /preview-mode/);
  assert.match(sketch, /applyHinge/);
  assert.match(sketch, /mousePressed|pointerdown/);
  assert.match(sketch, /event\?\.target !== p\.canvas/);
  assert.match(sketch, /hinge-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js WEBGL hanging membrane');
  assert.equal(critiques.length, 6);
});

test('Brush v025 is registered exactly once for the 2026-10-06 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-06');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-06');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v025/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-06');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-05');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.memoryRule, /hinge|depth|fold/i);

  const canonical = await readFile(new URL('works/brush-2026-10-06/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-06"/);
});
