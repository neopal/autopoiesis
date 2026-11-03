import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v041/engine.mjs');

const silence = [1, 4, 7];

function visitSilence(api, frame, ids = silence) {
  let next = api.beginSilence(frame, ids[0]);
  for (const id of ids.slice(1)) next = api.appendSilence(next, id);
  return next;
}

test('Handwriting v041 keeps an absence sequence geometry-neutral until three distinct gaps recruit remote glyphs', async () => {
  const {
    buildFrame,
    beginSilence,
    appendSilence,
    commitSilence,
    geometrySignature,
    SILENCE_LENGTH
  } = await engine();
  const quiet = buildFrame();
  const armed = beginSilence(quiet, silence[0]);
  const pending = appendSilence(appendSilence(armed, silence[1]), silence[2]);

  assert.equal(SILENCE_LENGTH, 3);
  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(pending), geometrySignature(quiet));
  assert.equal(pending.pending.length, SILENCE_LENGTH);
  assert.equal(pending.memory.length, 0);

  const committed = commitSilence(pending);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'negative-syntax');
  assert.ok(committed.changedGlyphIds.length >= 3);
  assert.ok(committed.changedGlyphIds.every((id) => !silence.includes(id)));
  assert.deepEqual(committed.pending, []);
  assert.notEqual(geometrySignature(committed), geometrySignature(quiet));

  for (const id of silence) {
    assert.deepEqual(committed.field.glyphs[id], quiet.field.glyphs[id]);
  }
});

test('Handwriting v041 refuses incomplete or repeated absences, compounds four recruitments, and lifts exactly', async () => {
  const {
    MEMORY_WINDOW,
    buildFrame,
    beginSilence,
    appendSilence,
    commitSilence,
    geometrySignature,
    liftLatest,
    release
  } = await engine();
  const quiet = buildFrame();
  const incomplete = commitSilence(appendSilence(beginSilence(quiet, silence[0]), silence[1]));
  const repeated = commitSilence(appendSilence(beginSilence(quiet, silence[0]), silence[0]));
  assert.equal(incomplete.memory.length, 0);
  assert.equal(repeated.memory.length, 0);
  assert.match(incomplete.lastEvent, /refused/);
  assert.match(repeated.lastEvent, /refused/);

  const timeline = [];
  let frame = quiet;
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    const ids = [index % 9, (index + 3) % 9, (index + 6) % 9];
    frame = commitSilence(visitSilence({ beginSilence, appendSilence }, frame, ids));
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(frame.history.length, MEMORY_WINDOW + 1);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
});

test('Handwriting v041 exposes an SVG negative-syntax tableau with art-gate evidence and equivalent pointer, touch, and keyboard paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v041/index.html');
  const sketch = await read('studies/handwriting/v041/sketch.js');
  const style = await read('studies/handwriting/v041/style.css');
  const readme = await read('studies/handwriting/v041/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v041/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v041/critiques.json'));

  assert.match(index, /id="negative-field"/);
  assert.match(index, /data-action="read"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /<svg/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /touch/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitSilence/);
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
  assert.match(metrics.memoryRule, /silence|negative|remote/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v041 is recorded exactly once for the 2026-11-03 daily slot with a canonical tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const canonical = await read('works/typography-2026-11-03/index.html');
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-03');
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-03');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'typography-2026-11-03');
  assert.equal(matches[0].rawPath, '/studies/handwriting/v041/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-typography-2026-11-03');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].decision.lineage, 'typography-2026-11-02');
  assert.equal(publicMatches.length, 1);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-11-03"/);
});

test('Handwriting v041 keeps the keyboard reading pending until Enter commits it', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v041/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /visitGap\(keyboardCursor, false\)/);
  assert.match(sketch, /frame = commitSilence\(frame\)/);
});

test('Handwriting v041 resolves pointer and touch readings from the actual SVG gap target', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v041/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /event\.target\.closest\?\.\('\.gap'\)/);
  assert.match(sketch, /dataset\.gapId/);
});

test('Handwriting v041 keeps pointer-only SVG gaps out of the keyboard focus tree', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v041/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /focusable: 'false'/);
  assert.doesNotMatch(sketch, /tabindex: '-1'/);
});
