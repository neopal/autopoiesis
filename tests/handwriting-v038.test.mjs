import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v038/engine.mjs');

test('Handwriting v038 keeps a typed offer geometry-neutral until a complete token is ratified elsewhere', async () => {
  const {
    buildFrame,
    beginToken,
    appendToken,
    commitToken,
    geometrySignature,
    MIN_TOKEN_LENGTH
  } = await engine();
  const quiet = buildFrame();
  const armed = beginToken(quiet, 'K');
  const preview = appendToken(armed, 'E');

  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(preview), geometrySignature(quiet));
  assert.equal(preview.memory.length, 0);
  assert.equal(preview.pending.length, MIN_TOKEN_LENGTH - 1);

  const committed = commitToken(appendToken(preview, 'Y'), 'KEY');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'remote-ratification');
  assert.ok(committed.changedSlotIds.length >= 3);
  assert.ok(!committed.changedSlotIds.includes(committed.memory[0].sourceId));
  assert.notEqual(committed.field.signature, quiet.field.signature);
});

test('Handwriting v038 refuses incomplete or overlong tokens, compounds four ratifications, and lifts exactly', async () => {
  const {
    MEMORY_WINDOW,
    MAX_TOKEN_LENGTH,
    MIN_TOKEN_LENGTH,
    buildFrame,
    beginToken,
    appendToken,
    commitToken,
    geometrySignature,
    liftLatest,
    release
  } = await engine();
  const quiet = buildFrame();
  const short = commitToken(appendToken(beginToken(quiet, 'A'), 'B'), 'AB');
  const overlong = commitToken(beginToken(quiet, 'A'), 'ABCDE');
  assert.equal(short.memory.length, 0);
  assert.equal(overlong.memory.length, 0);
  assert.match(short.lastEvent, /refused/);
  assert.match(overlong.lastEvent, /refused/);

  const timeline = [];
  let frame = quiet;
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    const token = `${String.fromCharCode(65 + index)}${String.fromCharCode(75 + index)}${String.fromCharCode(83 + index)}`;
    frame = commitToken(beginToken(frame, token[0]), token);
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
  assert.equal(MIN_TOKEN_LENGTH, 3);
  assert.equal(MAX_TOKEN_LENGTH, 3);
});

test('Handwriting v038 exposes a browser-native lexicon tableau with art-gate evidence and equivalent paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v038/index.html');
  const sketch = await read('studies/handwriting/v038/sketch.js');
  const style = await read('studies/handwriting/v038/style.css');
  const readme = await read('studies/handwriting/v038/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v038/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v038/critiques.json'));

  assert.match(index, /id="lexicon-field"/);
  assert.match(index, /data-action="ratify"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /contenteditable|role="application"/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitToken/);
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
  assert.equal(metrics.renderer, 'browser-native DOM lexicon with produced typographic slots');
  assert.match(metrics.memoryRule, /remote|token|ratif/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v038 is recorded once for the 2026-10-30 daily slot and has a canonical catalogue route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-30');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-10-30');
  const canonical = await read('works/typography-2026-10-30/index.html');

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'typography-2026-10-30');
  assert.equal(record.rawPath, '/studies/handwriting/v038/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'typography-2026-10-29');
  assert.match(record.metrics.changedRule, /token|remote|ratif/i);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-30"/);
  assert.equal(publicMatches.length, 1);
});
