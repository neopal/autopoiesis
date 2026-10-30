import test from 'node:test';
import assert from 'node:assert/strict';

const {
  GRID_SIZE,
  MEMORY_LIMIT,
  buildBoard,
  geometrySignature,
  offerWitness,
  developNegative,
  liftLatest,
  releaseNegative,
  buildTimeline
} = await import('../studies/self-portrait/v037/engine.mjs');

test('portrait v037 keeps a selected witness geometry-neutral until development', () => {
  const quiet = buildBoard();
  const offered = offerWitness(quiet, { row: 2, col: 8, pressure: 0.84 });

  assert.equal(GRID_SIZE, 11);
  assert.equal(geometrySignature(offered), geometrySignature(quiet));
  assert.equal(offered.lastOffer.row, 2);
  assert.equal(offered.lastOffer.col, 8);
  assert.equal(offered.lastOffer.pressure, 0.84);
  assert.equal(offered.interaction, 'witnessed');
});

test('portrait v037 develops remote tile roles while leaving the witnessed tile exact', () => {
  const quiet = buildBoard();
  const offered = offerWitness(quiet, { row: 2, col: 8, pressure: 0.84 });
  const result = developNegative(offered);
  const event = result.board.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'negative-development');
  assert.notEqual(event.witnessIndex, event.developedIndex);
  assert.notEqual(event.witnessIndex, event.erasedIndex);
  assert.notEqual(event.witnessIndex, event.registeredIndex);
  assert.deepEqual(result.board.cells[event.witnessIndex], quiet.cells[event.witnessIndex]);
  assert.equal(result.board.cells[event.developedIndex].state, 'developed');
  assert.equal(result.board.cells[event.erasedIndex].state, 'erased');
  assert.equal(result.board.cells[event.registeredIndex].state, 'registered');
  assert.notEqual(geometrySignature(result.board), geometrySignature(quiet));
});

test('portrait v037 makes actual block geometry carry the remote decision', () => {
  const quiet = buildBoard();
  const result = developNegative(offerWitness(quiet, { row: 6, col: 1, pressure: 0.7 }));
  const event = result.board.memory.at(-1);

  assert.ok(result.board.cells[event.developedIndex].mass > quiet.cells[event.developedIndex].mass);
  assert.ok(result.board.cells[event.erasedIndex].mass < quiet.cells[event.erasedIndex].mass);
  assert.notEqual(result.board.cells[event.registeredIndex].offset, quiet.cells[event.registeredIndex].offset);
});

test('portrait v037 compounds four developments and lifts the exact preceding negative', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.interaction, 'lifted');
});

test('portrait v037 releases the latent development ledger to its deterministic seed', () => {
  const quiet = buildBoard();
  const changed = developNegative(offerWitness(quiet, { row: 1, col: 4, pressure: 0.72 })).board;
  const released = releaseNegative();

  assert.equal(geometrySignature(released), geometrySignature(quiet));
  assert.equal(released.memory.length, 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(released));
});

test('portrait v037 exposes a browser-native contact print and equivalent interaction paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v037/index.html');
  const sketch = await read('studies/self-portrait/v037/sketch.js');
  const style = await read('studies/self-portrait/v037/style.css');

  assert.match(html, /data-negative-board/);
  assert.match(html, /data-witness-grid/);
  assert.match(html, /data-action="develop"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /click/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutinePortraitV037/);
  assert.match(style, /prefers-reduced-motion/);
});

test('portrait v037 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-10-30');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-30/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-10-30');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-30');
  assert.equal(record.rawPath, '/studies/self-portrait/v037/');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.decision.lineage, 'portrait-2026-10-28');
  assert.match(record.metrics.changedRule, /witness|negative|develop/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-30"/);
  assert.equal(publicMatches.length, 1);
});

test('portrait v037 keeps the raw tableau independent of remote font imports', async () => {
  const { readFile } = await import('node:fs/promises');
  const style = await readFile(new URL('../studies/self-portrait/v037/style.css', import.meta.url), 'utf8');

  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});
