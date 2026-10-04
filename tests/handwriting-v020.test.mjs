import test from 'node:test';
import assert from 'node:assert/strict';


test('handwriting v020 begins as a deterministic typographic pressure slab', async () => {
  const { GLYPH_COUNT, buildFrame, geometrySignature } = await import('../studies/handwriting/v020/engine.mjs');
  const first = buildFrame(4, []);
  const repeat = buildFrame(4, []);

  assert.equal(first.composition, 'canvas-typographic-pressure-slab');
  assert.equal(first.memory.length, 0);
  assert.equal(first.glyphs.length, GLYPH_COUNT);
  assert.ok(first.glyphs.every((glyph) => glyph.char.length === 1));
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.ok(first.glyphs.some((glyph) => glyph.scaleX !== 1 || glyph.angle !== 0));
});


test('a traveled pressure stroke changes glyph geometry and teaches the next stroke resistance', async () => {
  const { buildFrame, applyPressureStroke } = await import('../studies/handwriting/v020/engine.mjs');
  const baseline = buildFrame(2, []);
  const tap = applyPressureStroke(baseline, { points: [{ x: 0.5, y: 0.5 }], duration: 80 });
  const first = applyPressureStroke(baseline, {
    points: [{ x: 0.18, y: 0.45 }, { x: 0.5, y: 0.52 }, { x: 0.84, y: 0.57 }],
    duration: 640
  });
  const second = applyPressureStroke(first, {
    points: [{ x: 0.22, y: 0.61 }, { x: 0.54, y: 0.55 }, { x: 0.8, y: 0.42 }],
    duration: 820
  });
  const repeat = applyPressureStroke(first, {
    points: [{ x: 0.22, y: 0.61 }, { x: 0.54, y: 0.55 }, { x: 0.8, y: 0.42 }],
    duration: 820
  });

  assert.equal(tap.interaction, 'pressure-refused');
  assert.equal(tap.memory.length, 0);
  assert.equal(first.interaction, 'pressure-committed');
  assert.equal(first.memory.length, 1);
  assert.equal(first.memory[0].kind, 'pressure-stroke');
  assert.ok(first.glyphs.some((glyph, index) => glyph.x !== baseline.glyphs[index].x || glyph.scaleX !== baseline.glyphs[index].scaleX));
  assert.equal(second.memory.length, 2);
  assert.ok(second.materialResistance > first.materialResistance);
  assert.notDeepEqual(second.glyphs, first.glyphs);
  assert.deepEqual(second, repeat);
});


test('lifting the latest pressure stroke restores the exact preceding typographic slab', async () => {
  const { buildFrame, applyPressureStroke, liftLatestStroke, geometrySignature } = await import('../studies/handwriting/v020/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = applyPressureStroke(baseline, {
    points: [{ x: 0.16, y: 0.39 }, { x: 0.48, y: 0.48 }, { x: 0.86, y: 0.54 }],
    duration: 700
  });

  assert.equal(geometrySignature(liftLatestStroke(changed)), geometrySignature(baseline));
});


test('handwriting v020 raw tableau exposes the p5 pressure encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/handwriting/v020/index.html');
  const sketch = await read('studies/handwriting/v020/sketch.js');
  const style = await read('studies/handwriting/v020/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="pressure-field"/);
  assert.match(html, /id="press-type-control"/);
  assert.match(html, /id="lift-stroke"/);
  assert.match(html, /id="release-strokes"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-03"/);
  assert.match(sketch, /applyPressureStroke/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /__mutineHandwritingV020/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('handwriting v020 records the art gate, p5.brush translation, and canonical daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/handwriting/v020/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v020/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v020/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-03/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574920');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /resistance|pressure|geometry/i);
  assert.match(metrics.interactionRule, /stroke|drag/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-03');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-03');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v020/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /pressure|resistance|geometry/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-03');
  assert.equal(work.decision.lineage, 'typography-2026-10-02');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-03"/);
});
