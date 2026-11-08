import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/webgpu/v047/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const gazeSequence = (engine, slots) => {
  let frame = engine.buildFrame();
  slots.forEach((slot, index) => {
    frame = engine.registerGaze(frame, { slot, time: index * 640, dwell: 520 });
  });
  return frame;
};

test('WebGPU v047 starts as a deterministic absence arch with situated witnesses', async () => {
  const engine = await loadEngine();
  const frame = engine.buildFrame();
  assert.equal(frame.grammar, 'absence-arch');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.field.agents.length, engine.AGENT_COUNT);
  assert.equal(frame.field.agents.filter((agent) => agent.present).length, engine.AGENT_COUNT);
  assert.equal(engine.geometrySignature(frame), engine.geometrySignature(engine.buildFrame()));
});

test('WebGPU v047 keeps incomplete, repeated, and short attention geometry-neutral', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const first = engine.registerGaze(quiet, { slot: 4, time: 0, dwell: 520 });
  const repeated = engine.registerGaze(first, { slot: 4, time: 640, dwell: 520 });
  const short = engine.registerGaze(first, { slot: 9, time: 640, dwell: engine.MIN_GAZE_DWELL_MS - 1 });

  assert.equal(first.memory.length, 0);
  assert.equal(engine.geometrySignature(first), engine.geometrySignature(quiet));
  assert.match(repeated.lastAction, /repeat|refused/i);
  assert.equal(engine.geometrySignature(repeated), engine.geometrySignature(quiet));
  assert.match(short.lastAction, /short|refused/i);
  assert.equal(engine.geometrySignature(short), engine.geometrySignature(quiet));
});

test('WebGPU v047 turns three distinct acts of attention into a remote absence', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const committed = gazeSequence(engine, [3, 11, 20]);
  const event = committed.memory[0];
  const changedAgents = committed.field.agents.filter((agent, index) => JSON.stringify(agent) !== JSON.stringify(quiet.field.agents[index]));

  assert.equal(committed.memory.length, 1);
  assert.equal(event.type, 'attention-defection');
  assert.deepEqual(event.witnesses, [3, 11, 20]);
  assert.ok(!event.witnesses.includes(event.absentSlot));
  assert.equal(committed.field.agents[event.absentSlot].present, false);
  assert.ok(changedAgents.length >= 5);
  assert.notEqual(engine.geometrySignature(committed), engine.geometrySignature(quiet));
  assert.notEqual(committed.field.agents[3].tilt, quiet.field.agents[3].tilt);
});

test('WebGPU v047 makes witness order part of the geometry rather than a label', async () => {
  const engine = await loadEngine();
  const early = gazeSequence(engine, [3, 11, 20]);
  const late = gazeSequence(engine, [20, 11, 3]);

  assert.notEqual(early.memory[0].absentSlot, late.memory[0].absentSlot);
  assert.notEqual(early.field.signature, late.field.signature);
});

test('WebGPU v047 compounds four absences, lifts exactly, and releases to the quiet field', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatest(settled);
  const released = engine.releaseField();

  assert.equal(timeline.length, engine.MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.absences.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.deepEqual(lifted.memory, timeline.at(-2).memory);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
});

test('WebGPU v047 exposes the absence-arch tableau and complete art-gate record', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v047/index.html');
  const sketch = await read('studies/webgpu/v047/sketch.js');
  const style = await read('studies/webgpu/v047/style.css');
  const readme = await read('studies/webgpu/v047/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v047/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v047/critiques.json'));

  assert.match(index, /id="absence-field"/);
  assert.match(index, /data-gesture="gaze"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /registerGaze|pointerdown|touch/);
  assert.match(sketch, /absence|witness|attention/i);
  assert.match(sketch, /Canvas|beginShape|vertex/i);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'absence-arch');
  assert.match(metrics.memoryRule, /absence|witness|attention/i);
  assert.ok(critiques.length >= 10);
});

test('WebGPU v047 is recorded exactly once for the 2026-11-08 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-08');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'webgpu-2026-11-08');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-08');
  assert.equal(record.rawPath, '/studies/webgpu/v047/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-08');
  assert.ok(record.critiques.length >= 10);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.translatedRule, /attention|absence|witness/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/webgpu-2026-11-08/index.html').then(Boolean), true);
});
