import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v037/engine.mjs');

test('Handwriting v037 keeps pressure geometry-neutral until release cuts the sentence at a material hinge', async () => {
  const {
    buildFrame,
    beginPressure,
    movePressure,
    finishPressure,
    geometrySignature,
    MIN_SWEEP
  } = await engine();
  const quiet = buildFrame();
  const armed = beginPressure(quiet, { x: 0.2, y: 0.72, at: 0 });
  const preview = movePressure(armed, { x: 0.2 + MIN_SWEEP * 0.6, y: 0.72, at: 180 });

  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(preview), geometrySignature(quiet));
  assert.equal(preview.memory.length, 0);

  const committed = finishPressure(preview, { x: 0.2 + MIN_SWEEP, y: 0.72, at: 520 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'pressure-cut');
  assert.ok(committed.changedGlyphIds.length >= 3);
  assert.notEqual(committed.field.signature, quiet.field.signature);
});

test('Handwriting v037 refuses short or overlong pressure, keeps four cuts liftable, and releases to the quiet sentence', async () => {
  const {
    MEMORY_WINDOW,
    MIN_SWEEP,
    MAX_SWEEP,
    buildFrame,
    beginPressure,
    finishPressure,
    geometrySignature,
    liftLatest,
    release
  } = await engine();
  const quiet = buildFrame();
  const short = finishPressure(beginPressure(quiet, { x: 0, y: 0, at: 0 }), { x: MIN_SWEEP * 0.4, y: 0, at: 100 });
  const long = finishPressure(beginPressure(quiet, { x: 0, y: 0, at: 0 }), { x: MAX_SWEEP * 1.2, y: 0, at: 100 });
  assert.equal(short.memory.length, 0);
  assert.equal(long.memory.length, 0);
  assert.match(short.lastEvent, /refused/);
  assert.match(long.lastEvent, /refused/);

  const timeline = [];
  let frame = quiet;
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    frame = finishPressure(beginPressure(frame, { x: -0.8 + index * 0.22, y: 0.5, at: 0 }), { x: -0.8 + index * 0.22 + 0.34, y: 0.58, at: 500 });
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
});

test('Handwriting v037 exposes a sentence-seam tableau with art-gate evidence and equivalent paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v037/index.html');
  const sketch = await read('studies/handwriting/v037/sketch.js');
  const style = await read('studies/handwriting/v037/style.css');
  const readme = await read('studies/handwriting/v037/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v037/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v037/critiques.json'));

  assert.match(index, /id="seam-field"/);
  assert.match(index, /data-action="press"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /<svg/i);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /finishPressure/);
  assert.match(sketch, /liftLatest/);
  assert.match(sketch, /release/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'inline SVG sentence seam with produced glyph geometry');
  assert.match(metrics.memoryRule, /cut|pressure|hinge/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v037 is recorded once for the 2026-10-29 daily slot and has a canonical catalogue route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-29');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-10-29');
  const canonical = await read('works/typography-2026-10-29/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'typography-2026-10-29');
  assert.equal(record.rawPath, '/studies/handwriting/v037/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.decision.lineage, 'typography-2026-10-28');
  assert.match(record.metrics.changedRule, /pressure|hinge|cut/i);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-29"/);
  assert.equal(publicMatches.length, 1);
});
