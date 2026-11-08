import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/handwriting/v044/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const loadSequence = (engine, bins, frame = engine.buildFrame()) => {
  let next = frame;
  for (const bin of bins) next = engine.loadMaterial(next, { bin });
  return engine.castMaterial(next);
};

test('v044 stores a pending material load without moving the typographic carrier', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const pending = engine.loadMaterial(quiet, { bin: 1 });

  assert.equal(engine.geometrySignature(pending), engine.geometrySignature(quiet));
  assert.deepEqual(pending.pending, [1]);
  assert.equal(pending.memory.length, 0);
  assert.match(pending.lastEvent, /load|pending/i);
});

test('v044 casts three distinct material loads into one global carrier deformation', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const cast = loadSequence(engine, [0, 2, 4]);
  const changed = cast.field.tokens.filter((token, index) => JSON.stringify(token) !== JSON.stringify(quiet.field.tokens[index]));

  assert.equal(cast.memory.length, 1);
  assert.equal(cast.memory[0].type, 'material-cast');
  assert.deepEqual(cast.memory[0].bins, [0, 2, 4]);
  assert.equal(cast.pending.length, 0);
  assert.ok(changed.length >= engine.TOKEN_COUNT - 1);
  assert.notEqual(engine.geometrySignature(cast), engine.geometrySignature(quiet));
  assert.notEqual(cast.field.carrier.signature, quiet.field.carrier.signature);
  assert.match(cast.memory[0].loadShape, /rising|falling|centered/);
});

test('v044 makes load shape structural rather than a label', async () => {
  const engine = await loadEngine();
  const rising = loadSequence(engine, [0, 1, 4]);
  const falling = loadSequence(engine, [4, 1, 0]);

  assert.notEqual(rising.memory[0].loadShape, falling.memory[0].loadShape);
  assert.notEqual(rising.field.carrier.signature, falling.field.carrier.signature);
  assert.notEqual(engine.geometrySignature(rising), engine.geometrySignature(falling));
});

test('v044 compounds four casts, lifts the latest, and releases to the seed', async () => {
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

test('v044 exposes a carrier tableau and a complete art-gate record', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v044/index.html');
  const sketch = await read('studies/handwriting/v044/sketch.js');
  const style = await read('studies/handwriting/v044/style.css');
  const readme = await read('studies/handwriting/v044/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v044/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v044/critiques.json'));

  assert.match(index, /id="carrier-field"/);
  assert.match(index, /data-gesture="load"/);
  assert.match(index, /data-gesture="cast"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /loadMaterial|pointerdown|touch/);
  assert.match(sketch, /castMaterial|carrier|material/i);
  assert.match(sketch, /canvas|getContext/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'material-carrier');
  assert.match(metrics.memoryRule, /load|cast|carrier/i);
  assert.ok(critiques.length >= 9);
});

test('v044 is recorded exactly once for the 2026-11-08 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-08');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-08');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'typography-2026-11-08');
  assert.equal(record.rawPath, '/studies/handwriting/v044/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-typography-2026-11-08');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.translatedRule, /load|cast|carrier|material/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/typography-2026-11-08/index.html').then(Boolean), true);
});
