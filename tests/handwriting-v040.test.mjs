import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v040/engine.mjs');

const sourceId = 2;
const hold = (api, frame, duration = api.HOLD_THRESHOLD) =>
  api.releasePressure(api.previewPressure(api.beginPressure(frame, sourceId, 0), duration), duration);

test('Handwriting v040 keeps pressure geometry-neutral until a threshold release transfers debt to remote glyph chambers', async () => {
  const {
    buildFrame,
    beginPressure,
    previewPressure,
    releasePressure,
    geometrySignature,
    HOLD_THRESHOLD
  } = await engine();
  const quiet = buildFrame();
  const armed = beginPressure(quiet, sourceId, 0);
  const held = previewPressure(armed, HOLD_THRESHOLD - 1);
  const committed = releasePressure(held, HOLD_THRESHOLD);

  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(held), geometrySignature(quiet));
  assert.equal(held.memory.length, 0);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'pressure-debt');
  assert.ok(committed.changedChamberIds.length >= 3);
  assert.ok(committed.changedChamberIds.every((id) => id !== sourceId));
  assert.notEqual(geometrySignature(committed), geometrySignature(quiet));
  assert.deepEqual(committed.field.chambers[sourceId], quiet.field.chambers[sourceId]);
});

test('Handwriting v040 refuses short pressure, makes duration structural, compounds four debts, and lifts exactly', async () => {
  const {
    buildFrame,
    beginPressure,
    releasePressure,
    geometrySignature,
    liftLatest,
    release,
    MEMORY_WINDOW,
    HOLD_THRESHOLD
  } = await engine();
  const quiet = buildFrame();
  const short = releasePressure(beginPressure(quiet, 0, 100), 100 + HOLD_THRESHOLD - 1);
  const threshold = releasePressure(beginPressure(quiet, 0, 100), 100 + HOLD_THRESHOLD);
  const long = releasePressure(beginPressure(quiet, 0, 100), 100 + HOLD_THRESHOLD + 900);

  assert.equal(short.memory.length, 0);
  assert.match(short.lastEvent, /refused/);
  assert.notEqual(geometrySignature(threshold), geometrySignature(long));

  let frame = quiet;
  const timeline = [];
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    frame = releasePressure(beginPressure(frame, index % 9, 0), HOLD_THRESHOLD + index * 120);
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(frame.history.length, MEMORY_WINDOW + 1);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
});

test('Handwriting v040 exposes a pressure-rack tableau with art-gate evidence and equivalent pointer, touch, and keyboard paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v040/index.html');
  const sketch = await read('studies/handwriting/v040/sketch.js');
  const style = await read('studies/handwriting/v040/style.css');
  const readme = await read('studies/handwriting/v040/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v040/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v040/critiques.json'));

  assert.match(index, /id="pressure-field"/);
  assert.match(index, /data-action="press"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /releasePressure/);
  assert.match(sketch, /liftLatest/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.match(metrics.renderer, /Canvas/);
  assert.match(metrics.memoryRule, /pressure|debt|remote/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v040 is recorded exactly once for the 2026-11-02 daily slot with a canonical tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const canonical = await read('works/typography-2026-11-02/index.html');
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-02');
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-02');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'typography-2026-11-02');
  assert.equal(matches[0].rawPath, '/studies/handwriting/v040/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-typography-2026-11-02');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(publicMatches.length, 1);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-11-02"/);
});
