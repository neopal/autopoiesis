import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v042/engine.mjs');

const pair = [1, 5];

test('Handwriting v042 keeps a ligature pending until two distinct mouths commit a remote fusion', async () => {
  const {
    buildFrame,
    beginLigature,
    finishLigature,
    commitLigature,
    geometrySignature,
    LIGATURE_LENGTH
  } = await engine();
  const quiet = buildFrame();
  const armed = beginLigature(quiet, pair[0]);
  const pending = finishLigature(armed, pair[1]);

  assert.equal(LIGATURE_LENGTH, 2);
  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(pending), geometrySignature(quiet));
  assert.deepEqual(pending.pending, pair);
  assert.equal(pending.memory.length, 0);

  const committed = commitLigature(pending);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'hinge-ligature');
  assert.ok(committed.changedStrokeIds.length >= 2);
  assert.ok(committed.changedStrokeIds.every((id) => !pair.includes(id)));
  assert.notEqual(geometrySignature(committed), geometrySignature(quiet));
  assert.deepEqual(committed.pending, []);

  for (const id of pair) {
    assert.deepEqual(committed.field.strokes[id], quiet.field.strokes[id]);
  }
});

test('Handwriting v042 refuses incomplete or repeated mouths, compounds four fusions, and lifts exactly', async () => {
  const { MEMORY_WINDOW, buildFrame, beginLigature, finishLigature, commitLigature, geometrySignature, liftLatest, release } = await engine();
  const quiet = buildFrame();
  const incomplete = commitLigature(beginLigature(quiet, 1));
  const repeated = commitLigature(finishLigature(beginLigature(quiet, 1), 1));
  assert.equal(incomplete.memory.length, 0);
  assert.equal(repeated.memory.length, 0);
  assert.match(incomplete.lastEvent, /refused/);
  assert.match(repeated.lastEvent, /refused/);

  const timeline = [];
  let frame = quiet;
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    frame = commitLigature(finishLigature(beginLigature(frame, index % 8), (index + 3) % 8));
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(frame.history.length, MEMORY_WINDOW + 1);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
});

test('Handwriting v042 exposes the ligature tableau and its art-gate evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v042/index.html');
  const sketch = await read('studies/handwriting/v042/sketch.js');
  const style = await read('studies/handwriting/v042/style.css');
  const readme = await read('studies/handwriting/v042/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v042/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v042/critiques.json'));

  assert.match(index, /id="ligature-field"/);
  assert.match(index, /data-action="bind"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /<svg/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /touch/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitLigature/);
  assert.match(sketch, /liftLatest/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.match(metrics.renderer, /SVG/);
  assert.match(metrics.memoryRule, /ligature|remote|fusion/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v042 maps pointer coordinates through the responsive SVG viewport', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v042/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /getScreenCTM\(\)/);
});

test('Handwriting v042 is recorded exactly once for the 2026-11-04 daily slot with a canonical tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const canonical = await read('works/typography-2026-11-04/index.html');
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-04');
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-04');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'typography-2026-11-04');
  assert.equal(matches[0].rawPath, '/studies/handwriting/v042/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-typography-2026-11-04');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].decision.lineage, 'typography-2026-11-03');
  assert.equal(publicMatches.length, 1);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-11-04"/);
});
