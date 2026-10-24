import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v037/engine.mjs');

const { applyStroke, buildFrame, buildTimeline, geometrySignature, previewStroke } = engine;

test('brush v037 turns a completed local crease into remembered material geometry', () => {
  const initial = buildFrame(0, []);
  const stroke = [
    { x: 0.28, y: 0.44 },
    { x: 0.37, y: 0.48 },
    { x: 0.46, y: 0.51 },
    { x: 0.55, y: 0.54 },
    { x: 0.64, y: 0.58 }
  ];
  const changed = applyStroke(initial, stroke, 420, 'test-crease');

  assert.equal(initial.grammar, 'crease-sheet');
  assert.equal(initial.memory.length, 0);
  assert.equal(changed.interaction, 'crease-committed');
  assert.equal(changed.memory.length, 1);
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
  assert.ok(changed.creaseCount > 0);
  assert.ok(changed.openingCount > 0);
  assert.ok(changed.event.local === true);
});

test('brush v037 exposes a drying frontier that changes phase after the wet gesture', () => {
  const initial = buildFrame(0, []);
  const stroke = [{ x: 0.22, y: 0.38 }, { x: 0.34, y: 0.43 }, { x: 0.47, y: 0.49 }, { x: 0.61, y: 0.55 }];
  const fresh = applyStroke(initial, stroke, 420, 'test-drying');
  const settled = buildTimeline().at(-1);

  assert.equal(fresh.drying.phase, 'fresh');
  assert.deepEqual(fresh.drying.frontier, fresh.event.path);
  assert.equal(settled.drying.phase, 'dry');
  assert.ok(settled.drying.frontier.length >= 3);
});

test('brush v037 carries the dried incision into the next local stroke', () => {
  const initial = buildFrame(0, []);
  const first = applyStroke(initial, [{ x: 0.20, y: 0.36 }, { x: 0.34, y: 0.42 }, { x: 0.48, y: 0.46 }], 360, 'first-crease');
  const second = applyStroke(first, [{ x: 0.64, y: 0.64 }, { x: 0.54, y: 0.60 }, { x: 0.44, y: 0.58 }], 520, 'second-crease');

  assert.equal(second.memory.length, 2);
  assert.equal(second.event.priorCreaseCount, 1);
  assert.ok(second.event.inheritedDryness > 0);
  assert.ok(second.dryCount >= first.dryCount);
});

test('brush v037 previews a pressure line without changing the dried sheet', () => {
  const initial = buildFrame(0, []);
  const stroke = [{ x: 0.24, y: 0.45 }, { x: 0.38, y: 0.49 }, { x: 0.53, y: 0.55 }];
  const preview = previewStroke(initial, stroke);

  assert.equal(preview.interaction, 'stroke-preview');
  assert.deepEqual(preview.pending.points, stroke);
  assert.equal(preview.memory.length, 0);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v037 exposes a canvas-first crease encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v037/index.html');
  const sketch = await read('studies/p5-brush/v037/sketch.js');
  const style = await read('studies/p5-brush/v037/style.css');
  const readme = await read('studies/p5-brush/v037/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v037/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v037/critiques.json'));

  assert.match(html, /p5\.js\/1\.11\.3/);
  assert.match(html, /data-gesture="crease"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /previewStroke/);
  assert.match(sketch, /applyStroke/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523737');
  assert.equal(metrics.grammar, 'crease-sheet');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 7);
});

test('brush v037 is registered once for the 2026-10-24 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-24');
  const canonical = await readFile(new URL('works/brush-2026-10-24/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-24');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v037/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-24');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-23');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /crease|dry|stroke/i);
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-24"/);
});
