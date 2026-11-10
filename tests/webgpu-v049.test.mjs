import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/webgpu/v049/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const attentionSequence = (engine, count = engine.MEMORY_LIMIT) => {
  let frame = engine.buildFrame();
  for (let index = 0; index < count; index += 1) {
    frame = engine.commitDefaultAttention(frame);
  }
  return frame;
};

test('WebGPU v049 begins as a deterministic flat field of listening apertures', async () => {
  const engine = await loadEngine();
  const frame = engine.buildFrame();

  assert.equal(frame.grammar, 'reciprocal-absence');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.field.kind, 'attention-field');
  assert.equal(frame.field.sites.length, engine.SITE_COUNT);
  assert.ok(frame.field.sites.every((site) => 'x' in site && 'y' in site && !('z' in site)));
  assert.equal(engine.geometrySignature(frame), engine.geometrySignature(engine.buildFrame()));
});

test('WebGPU v049 keeps a watched aperture provisional until attention is withdrawn', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const armed = engine.attendAt(quiet, quiet.field.nextWitness);
  const repeated = engine.attendAt(armed, quiet.field.nextWitness);
  const wrongReply = engine.withdrawAt(armed, (quiet.field.nextWitness + 1) % engine.SITE_COUNT);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.gesture.entry, quiet.field.nextWitness);
  assert.equal(engine.geometrySignature(armed), engine.geometrySignature(quiet));
  assert.match(repeated.lastAction, /repeat|refused/i);
  assert.equal(engine.geometrySignature(repeated), engine.geometrySignature(quiet));
  assert.match(wrongReply.lastAction, /reply|refused|attention/i);
  assert.equal(engine.geometrySignature(wrongReply), engine.geometrySignature(quiet));
});

test('WebGPU v049 makes a returned attention rewrite the whole negative field', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const entry = quiet.field.nextWitness;
  const armed = engine.attendAt(quiet, entry);
  const reply = engine.expectedReplyFor(entry, 0);
  const committed = engine.withdrawAt(armed, reply);
  const changedSites = committed.field.sites.filter((site, index) => JSON.stringify(site) !== JSON.stringify(quiet.field.sites[index]));
  const event = committed.memory[0];

  assert.equal(committed.memory.length, 1);
  assert.equal(event.type, 'returned-attention');
  assert.equal(event.entry, entry);
  assert.equal(event.reply, reply);
  assert.equal(committed.field.nextWitness, reply);
  assert.equal(committed.field.absenceSite, entry);
  assert.ok(changedSites.length > quiet.field.sites.length * 0.6);
  assert.notEqual(engine.geometrySignature(committed), engine.geometrySignature(quiet));
});

test('WebGPU v049 makes the remembered reply the only valid next witness', async () => {
  const engine = await loadEngine();
  const first = engine.commitDefaultAttention(engine.buildFrame());
  const expectedEntry = first.field.nextWitness;
  const wrongEntry = (expectedEntry + 2) % engine.SITE_COUNT;
  const wrong = engine.attendAt(first, wrongEntry);
  const right = engine.attendAt(first, expectedEntry);

  assert.match(wrong.lastAction, /witness|refused/i);
  assert.equal(engine.geometrySignature(wrong), engine.geometrySignature(first));
  assert.equal(right.gesture.entry, expectedEntry);
  assert.equal(right.memory.length, 1);
});

test('WebGPU v049 compounds four returns, lifts exactly, and releases absence', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatest(settled);
  const released = engine.releaseAttention();

  assert.equal(timeline.length, engine.MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.absenceHistory.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.deepEqual(lifted.memory, timeline.at(-2).memory);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
});

test('WebGPU v049 exposes the absence tableau and complete art-gate record', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v049/index.html');
  const sketch = await read('studies/webgpu/v049/sketch.js');
  const style = await read('studies/webgpu/v049/style.css');
  const readme = await read('studies/webgpu/v049/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v049/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v049/critiques.json'));

  assert.match(index, /id="attention-field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /attendAt|withdrawAt|pointer/);
  assert.match(sketch, /absence|attention|witness/i);
  assert.match(sketch, /2d|ellipse|arc|line/i);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'reciprocal-absence');
  assert.equal(metrics.referenceId, 'little-critters');
  assert.match(metrics.memoryRule, /attention|absence|field|return/i);
  assert.ok(critiques.length >= 10);
});

test('WebGPU v049 is recorded exactly once for the 2026-11-10 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-10');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'webgpu-2026-11-10');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-10');
  assert.equal(record.rawPath, '/studies/webgpu/v049/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-10');
  assert.ok(record.critiques.length >= 10);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.translatedRule, /attention|absence|witness|field/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/webgpu-2026-11-10/index.html').then(Boolean), true);
});
