import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/handwriting/v045/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const attendSequence = (engine, ids, frame = engine.buildFrame()) => {
  let next = frame;
  for (const id of ids) next = engine.attendLetter(next, { id });
  return engine.commitAttention(next);
};

test('v045 keeps a pending look geometrically neutral and refuses repeated letters', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const pending = engine.attendLetter(quiet, { id: 4 });
  const repeated = engine.attendLetter(pending, { id: 4 });

  assert.equal(engine.geometrySignature(pending), engine.geometrySignature(quiet));
  assert.deepEqual(pending.pending, [4]);
  assert.equal(pending.memory.length, 0);
  assert.equal(repeated.pending.length, 1);
  assert.match(repeated.lastEvent, /refused|repeat|already/i);
});

test('v045 turns three situated looks into a collective reading-axis reflow', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const cast = attendSequence(engine, [2, 7, 13]);
  const changed = cast.field.letters.filter((letter, index) => JSON.stringify(letter) !== JSON.stringify(quiet.field.letters[index]));

  assert.equal(cast.memory.length, 1);
  assert.equal(cast.memory[0].type, 'attention-assembly');
  assert.deepEqual(cast.memory[0].witnesses, [2, 7, 13]);
  assert.equal(cast.pending.length, 0);
  assert.ok(changed.length >= engine.LETTER_COUNT - 2);
  assert.notEqual(engine.geometrySignature(cast), engine.geometrySignature(quiet));
  assert.notDeepEqual(cast.field.readingPath, quiet.field.readingPath);
  assert.match(cast.memory[0].axis, /ascending|descending|hinged/);
});

test('v045 makes witness order structural, not a status label', async () => {
  const engine = await loadEngine();
  const rising = attendSequence(engine, [0, 6, 15]);
  const reversed = attendSequence(engine, [15, 6, 0]);

  assert.notEqual(rising.memory[0].axis, reversed.memory[0].axis);
  assert.notEqual(rising.field.readingPath.join(','), reversed.field.readingPath.join(','));
  assert.notEqual(engine.geometrySignature(rising), engine.geometrySignature(reversed));
});

test('v045 compounds four assemblies, lifts the latest, and releases to the quiet phrase', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatest(settled);
  const released = engine.releaseArchive();

  assert.equal(timeline.length, engine.STAGES);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(lifted.memory.length, engine.MEMORY_LIMIT - 1);
  assert.notEqual(engine.geometrySignature(lifted), engine.geometrySignature(settled));
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(engine.buildTimeline().at(-1)), engine.geometrySignature(settled));
});

test('v045 exposes an attendance tableau and a complete art-gate record', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v045/index.html');
  const sketch = await read('studies/handwriting/v045/sketch.js');
  const style = await read('studies/handwriting/v045/style.css');
  const readme = await read('studies/handwriting/v045/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v045/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v045/critiques.json'));

  assert.match(index, /id="attendance-field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="assemble"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /attendLetter|pointerdown|touch/i);
  assert.match(sketch, /commitAttention|readingPath|attendance/i);
  assert.match(sketch, /canvas|getContext/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'collective-reading-axis');
  assert.match(metrics.memoryRule, /attention|witness|reading|axis/i);
  assert.ok(critiques.length >= 10);
});

test('v045 is recorded exactly once for the 2026-11-09 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-09');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-09');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'typography-2026-11-09');
  assert.equal(record.rawPath, '/studies/handwriting/v045/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-typography-2026-11-09');
  assert.ok(record.critiques.length >= 10);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.translatedRule, /attention|witness|reading|axis/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/typography-2026-11-09/index.html').then(Boolean), true);
});
