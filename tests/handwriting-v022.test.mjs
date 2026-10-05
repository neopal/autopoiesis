import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const PRESSURE_PATH = [
  { x: 0.12, y: 0.22 },
  { x: 0.38, y: 0.34 },
  { x: 0.66, y: 0.48 },
  { x: 0.86, y: 0.68 }
];

test('handwriting v022 begins as a deterministic countertype quarry of separated word stones', async () => {
  const { GLYPH_COUNT, buildFrame, geometrySignature } = await import('../studies/handwriting/v022/engine.mjs');
  const first = buildFrame(4, []);
  const repeat = buildFrame(4, []);

  assert.equal(first.composition, 'countertype-quarry');
  assert.equal(first.memory.length, 0);
  assert.equal(first.glyphs.length, GLYPH_COUNT);
  assert.equal(GLYPH_COUNT, 18);
  assert.ok(first.glyphs.every((glyph) => glyph.char.length === 1));
  assert.ok(first.glyphs.every((glyph) => Number.isFinite(glyph.x) && Number.isFinite(glyph.y)));
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.ok(first.glyphs.some((glyph) => glyph.stone.length >= 5));
});

test('a short pressure tap is refused while a traveled path changes the crossed letters themselves', async () => {
  const { buildFrame, commitPressure } = await import('../studies/handwriting/v022/engine.mjs');
  const baseline = buildFrame(2, []);
  const refused = commitPressure(baseline, { path: [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }] });
  const committed = commitPressure(baseline, { path: PRESSURE_PATH, force: 0.8 });

  assert.equal(refused.interaction, 'pressure-refused');
  assert.equal(refused.memory.length, 0);
  assert.equal(committed.interaction, 'pressure-committed');
  assert.equal(committed.memory.length, 1);
  assert.ok(committed.memory[0].touchedIndices.length >= 2);
  assert.ok(committed.glyphs.some((glyph, index) => glyph.char !== baseline.glyphs[index].char));
  assert.ok(committed.glyphs.some((glyph, index) => index !== committed.memory[0].touchedIndices[0] && glyph.replyTo !== null && glyph.x !== baseline.glyphs[index].x));
  assert.ok(committed.resistance > baseline.resistance);
});

test('pressure debt changes the later reply partner instead of replaying one fixed answer', async () => {
  const { buildFrame, commitPressure } = await import('../studies/handwriting/v022/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = commitPressure(baseline, { path: PRESSURE_PATH, force: 0.7 });
  const second = commitPressure(first, { path: PRESSURE_PATH, force: 0.7 });

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.notEqual(first.memory[0].replyIndex, second.memory[1].replyIndex);
  assert.ok(second.resistance > first.resistance);
  assert.notDeepEqual(second.glyphs, first.glyphs);
});

test('lifting the latest pressure restores the exact preceding countertype quarry', async () => {
  const { buildFrame, commitPressure, liftLatestPressure, geometrySignature } = await import('../studies/handwriting/v022/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = commitPressure(baseline, { path: PRESSURE_PATH, force: 0.92 });

  assert.equal(geometrySignature(liftLatestPressure(changed)), geometrySignature(baseline));
});

test('handwriting v022 raw tableau exposes material typography before explanation', async () => {
  const html = await read('studies/handwriting/v022/index.html');
  const sketch = await read('studies/handwriting/v022/sketch.js');
  const style = await read('studies/handwriting/v022/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="countertype-field"/);
  assert.match(html, /id="press-type-control"/);
  assert.match(html, /id="lift-pressure"/);
  assert.match(html, /id="release-pressure"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-05"/);
  assert.match(html, /<svg[^>]+id="countertype-svg"/);
  assert.match(sketch, /commitPressure/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutineHandwritingV022/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});

test('handwriting v022 records the art gate, p5.brush translation, and canonical daily work', async () => {
  const readme = await read('studies/handwriting/v022/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v022/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v022/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-05/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574922');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /pressure|reply|countertype/i);
  assert.match(metrics.interactionRule, /traveled|pressure|tap/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-05');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-05');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v022/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /pressure|countertype|material/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-05');
  assert.equal(work.decision.lineage, 'typography-2026-10-04');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-05"/);
});
