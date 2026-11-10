import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/handwriting/v046/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

test('v046 keeps a valid range selection geometrically neutral until the pressure cut is committed', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const selected = engine.selectRange(quiet, { start: 2, end: 5 });

  assert.equal(engine.geometrySignature(selected), engine.geometrySignature(quiet));
  assert.deepEqual(selected.pending, { start: 2, end: 5 });
  assert.equal(selected.memory.length, 0);
});

test('v046 turns one committed span into a global counterform reflow', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const pending = engine.selectRange(quiet, { start: 2, end: 5 });
  const cut = engine.commitSelection(pending);
  const changed = cut.field.tokens.filter((token, index) => JSON.stringify(token) !== JSON.stringify(quiet.field.tokens[index]));

  assert.equal(cut.memory.length, 1);
  assert.equal(cut.memory[0].type, 'counterform-cut');
  assert.deepEqual(cut.memory[0].range, { start: 2, end: 5 });
  assert.equal(cut.pending, null);
  assert.equal(cut.field.layout, 'counterform-reflow');
  assert.equal(changed.length, engine.TOKEN_COUNT);
  assert.notEqual(engine.geometrySignature(cut), engine.geometrySignature(quiet));
  assert.ok(cut.field.tokens.some((token) => token.writingMode === 'vertical-rl'));
  assert.equal(cut.field.voids.length, 1);
  assert.ok(cut.field.voids[0].width > 0);
});

test('v046 refuses short or occupied ranges and keeps the field exact', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const short = engine.selectRange(quiet, { start: 2, end: 3 });
  assert.equal(short.pending, null);
  assert.match(short.lastEvent, /refused/i);

  const first = engine.commitSelection(engine.selectRange(quiet, { start: 2, end: 5 }));
  const occupied = engine.selectRange(first, { start: 4, end: 7 });
  assert.equal(occupied.pending, null);
  assert.equal(engine.geometrySignature(occupied), engine.geometrySignature(first));
  assert.equal(occupied.memory.length, 1);
});

test('v046 compounds four counterforms, lifts exactly, and releases to the inventory', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatest(settled);
  const released = engine.releaseArchive();

  assert.equal(timeline.length, engine.STAGES);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.counterforms.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.voids.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(lifted.memory.length, engine.MEMORY_LIMIT - 1);
  assert.equal(lifted.field.counterforms.length, engine.MEMORY_LIMIT - 1);
  assert.notEqual(engine.geometrySignature(lifted), engine.geometrySignature(settled));
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(engine.buildTimeline().at(-1)), engine.geometrySignature(settled));
});

test('v046 exposes the counterform tableau and complete art-gate evidence', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v046/index.html');
  const sketch = await read('studies/handwriting/v046/sketch.js');
  const style = await read('studies/handwriting/v046/style.css');
  const readme = await read('studies/handwriting/v046/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v046/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v046/critiques.json'));

  assert.match(index, /id="counterform-field"/);
  assert.match(index, /data-gesture="cut"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="select"/);
  assert.match(sketch, /selectRange|pointerdown|touch/i);
  assert.match(sketch, /commitSelection|counterform|void/i);
  assert.match(sketch, /writingMode|DOM/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'counterform-reflow');
  assert.match(metrics.memoryRule, /counterform|void|reflow/i);
  assert.ok(critiques.length >= 10);
});

test('v046 is recorded exactly once for the 2026-11-10 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-10');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-10');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'typography-2026-11-10');
  assert.equal(record.rawPath, '/studies/handwriting/v046/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-typography-2026-11-10');
  assert.ok(record.critiques.length >= 10);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /counterform|void|re-?produced/i);
  assert.equal(record.browserEvidence.localViewportRuns, 20);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/typography-2026-11-10/index.html').then(Boolean), true);
});
