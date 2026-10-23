import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/p5-brush/v036/engine.mjs';

function route(engine, frame, faultIndex = 0, ventIndex = 2) {
  let next = frame;
  next = engine.applyPress(next, next.faults[faultIndex], 'test-press');
  next = engine.applyMove(next, next.vents[ventIndex], 'test-cross');
  return engine.applyRelease(next, { x: 0.96, y: 0.92 }, 'test-exit');
}

async function loadEngine() {
  return import(engineUrl);
}

test('brush v036 begins as a deterministic 3D eclipse slab', async () => {
  const engine = await loadEngine();
  const frame = engine.buildFrame(0, []);
  const replay = engine.buildFrame(0, []);

  assert.equal(frame.grammar, 'eclipse-slab');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.ribs.length, engine.RIB_COUNT);
  assert.equal(frame.apertures.length, engine.APERTURE_COUNT);
  assert.equal(engine.geometrySignature(frame), engine.geometrySignature(replay));
  assert.ok(frame.ribs.every((rib) => rib.front.length >= 6 && rib.back.length >= 6));
});

test('brush v036 arms a fault route without changing slab geometry', async () => {
  const engine = await loadEngine();
  let frame = engine.buildFrame(0, []);
  const baseline = engine.geometrySignature(frame);

  frame = engine.applyPress(frame, frame.faults[1], 'test-press');
  assert.equal(frame.interaction, 'fault-armed');
  assert.equal(frame.pending.phase, 'fault');
  assert.equal(engine.geometrySignature(frame), baseline);

  frame = engine.applyMove(frame, frame.vents[3], 'test-cross');
  assert.equal(frame.interaction, 'vent-crossed');
  assert.equal(frame.pending.phase, 'vent');
  assert.equal(engine.geometrySignature(frame), baseline);
});

test('brush v036 commits only after a vent crossing and an exit', async () => {
  const engine = await loadEngine();
  let frame = engine.buildFrame(0, []);
  const baseline = engine.geometrySignature(frame);

  const premature = engine.applyRelease(frame, { x: 0.96, y: 0.92 }, 'test-exit');
  assert.equal(premature.interaction, 'release-refused');
  assert.equal(engine.geometrySignature(premature), baseline);

  frame = route(engine, frame, 0, 2);
  assert.equal(frame.interaction, 'eclipse-committed');
  assert.equal(frame.memory.length, 1);
  assert.ok(frame.event.affected.every((index) => index !== frame.event.faultIndex));
  assert.ok(frame.event.affected.every((index) => index !== frame.event.ventIndex));
  assert.ok(frame.apertures.some((aperture) => aperture.depth > 0));
  assert.ok(frame.ribs.some((rib) => rib.shed > 0));
  assert.notEqual(engine.geometrySignature(frame), baseline);
});

test('brush v036 refuses a local release and lifts the latest eclipse exactly', async () => {
  const engine = await loadEngine();
  let frame = engine.buildFrame(0, []);
  const baseline = engine.geometrySignature(frame);

  frame = engine.applyPress(frame, frame.faults[0], 'test-press');
  frame = engine.applyMove(frame, frame.vents[0], 'test-cross');
  const local = engine.applyRelease(frame, frame.vents[0], 'test-local-release');
  assert.equal(local.interaction, 'release-refused-local');
  assert.equal(local.memory.length, 0);
  assert.equal(engine.geometrySignature(local), baseline);

  const committed = route(engine, engine.buildFrame(0, []), 0, 1);
  const lifted = engine.liftLatest(committed);
  assert.equal(lifted.memory.length, 0);
  assert.equal(engine.geometrySignature(lifted), baseline);
  assert.equal(engine.releaseSlab(committed).memory.length, 0);
});

test('brush v036 bounds deterministic eclipse memory to four route events', async () => {
  const engine = await loadEngine();
  const timeline = engine.buildTimeline();
  const replay = engine.buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 13);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(engine.geometrySignature(settled), engine.geometrySignature(replay.at(-1)));
  assert.equal(engine.releaseSlab(settled).pending.phase, 'idle');
});

test('brush v036 exposes a route-based WebGL tableau and evidence contract', async () => {
  const html = await read('studies/p5-brush/v036/index.html');
  const sketch = await read('studies/p5-brush/v036/sketch.js');
  const style = await read('studies/p5-brush/v036/style.css');
  const readme = await read('studies/p5-brush/v036/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v036/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v036/critiques.json'));

  assert.match(html, /p5\.WEBGL/);
  assert.match(html, /data-gesture="eclipse"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyPress/);
  assert.match(sketch, /applyMove/);
  assert.match(sketch, /applyRelease/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523636');
  assert.equal(metrics.grammar, 'eclipse-slab');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 7);
});

test('brush v036 is registered exactly once for the 2026-10-23 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-23');
  const canonical = await read('works/brush-2026-10-23/index.html');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-23');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v036/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-23');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-22');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /fault|vent|eclipse/i);
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-23"/);
});
