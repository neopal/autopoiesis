import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v046/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const tapSequence = (engine, times, anchorIndex = 9) => {
  let frame = engine.buildFrame();
  times.forEach((time) => {
    frame = engine.recordBeat(frame, { time, index: anchorIndex });
  });
  return frame;
};

test('WebGPU v046 refuses a single beat and a regular three-beat chorus without changing the ledger', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const single = engine.recordBeat(quiet, { time: 0, index: 9 });
  const regular = tapSequence(engine, [0, 420, 840]);

  assert.equal(engine.geometrySignature(single), engine.geometrySignature(quiet));
  assert.equal(single.memory.length, 0);
  assert.match(single.lastAction, /beat|building/i);
  assert.equal(engine.geometrySignature(regular), engine.geometrySignature(quiet));
  assert.equal(regular.memory.length, 0);
  assert.match(regular.lastAction, /regular|refused/i);
});

test('WebGPU v046 turns an uneven release cadence into a global crease instead of a local response', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const committed = tapSequence(engine, [0, 220, 760], 9);
  const changedVoices = committed.field.voices.filter((voice, index) => JSON.stringify(voice) !== JSON.stringify(quiet.field.voices[index]));

  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].type, 'cadence-crease');
  assert.deepEqual(committed.memory[0].beats, [0, 220, 760]);
  assert.ok(changedVoices.length >= engine.VOICE_COUNT - 2);
  assert.notEqual(engine.geometrySignature(committed), engine.geometrySignature(quiet));
  assert.notEqual(committed.field.voices[0].fold, quiet.field.voices[0].fold);
  assert.notEqual(committed.field.voices[engine.VOICE_COUNT - 1].fold, quiet.field.voices[engine.VOICE_COUNT - 1].fold);
});

test('WebGPU v046 makes cadence shape part of the archive, not a cosmetic label', async () => {
  const engine = await loadEngine();
  const broken = tapSequence(engine, [0, 160, 760], 4);
  const frontLoaded = tapSequence(engine, [0, 520, 700], 4);

  assert.equal(broken.memory[0].cadenceShape, 'late-break');
  assert.equal(frontLoaded.memory[0].cadenceShape, 'early-break');
  assert.notEqual(broken.field.signature, frontLoaded.field.signature);
});

test('WebGPU v046 compounds four creases, lifts exactly, and releases to the quiet seed', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatestCadence(settled);
  const released = engine.releaseArchive();

  assert.equal(timeline.length, engine.STAGES);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.creases.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(lifted.memory.length, engine.MEMORY_LIMIT - 1);
  assert.equal(lifted.field.creases.length, engine.MEMORY_LIMIT - 1);
  assert.notEqual(engine.geometrySignature(lifted), engine.geometrySignature(settled));
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(engine.buildTimeline().at(-1)), engine.geometrySignature(settled));
});

test('WebGPU v046 exposes a folded chorus tableau and a complete art-gate record', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v046/index.html');
  const sketch = await read('studies/webgpu/v046/sketch.js');
  const style = await read('studies/webgpu/v046/style.css');
  const readme = await read('studies/webgpu/v046/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v046/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v046/critiques.json'));

  assert.match(index, /id="chorus-field"/);
  assert.match(index, /data-gesture="cadence"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /recordBeat|pointerdown|touch/);
  assert.match(sketch, /cadence|fold|crease/i);
  assert.match(sketch, /WEBGL|beginShape|TRIANGLES/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'folded-chorus');
  assert.match(metrics.memoryRule, /crease|cadence|fold/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v046 is recorded exactly once for the 2026-11-07 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-07');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'webgpu-2026-11-07');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-07');
  assert.equal(record.rawPath, '/studies/webgpu/v046/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-07');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.translatedRule, /cadence|crease|invert/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/webgpu-2026-11-07/index.html').then(Boolean), true);
});
