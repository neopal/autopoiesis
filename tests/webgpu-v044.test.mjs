import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/webgpu/v044/engine.mjs');
const { buildFrame, geometrySignature, PORTAL_COUNT } = engine;

test('webgpu v044 begins as a deterministic reciprocal-orbit field', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'reciprocal-orbit');
  assert.equal(initial.renderer, 'deterministic p5.js 1.11.3 WEBGL reciprocal orbit field');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.field.portals.length, PORTAL_COUNT);
  assert.ok(initial.field.portals.every((portal) => portal.radius > 0 && portal.opening > 0));
  assert.equal(geometrySignature(initial), geometrySignature(replay));
});

test('webgpu v044 keeps an approach inert until a distinct handoff opens a remote aperture', () => {
  const initial = buildFrame();
  const armed = engine.beginApproach(initial, { index: 1, time: 12 });
  const pending = engine.updateApproach(armed, { index: 3, time: 24 });
  const committed = engine.finishApproach(pending, { observerIndex: 3, confirmed: true });
  const sourceBefore = initial.field.portals[1];
  const observerBefore = initial.field.portals[3];

  assert.equal(pending.memory.length, 0);
  assert.equal(geometrySignature(pending), geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'reciprocal-handoff');
  assert.equal(committed.event.sourceIndex, 1);
  assert.equal(committed.event.observerIndex, 3);
  assert.notEqual(committed.event.receiverIndex, 1);
  assert.notEqual(committed.event.receiverIndex, 3);
  assert.deepEqual(committed.field.portals[1], sourceBefore);
  assert.deepEqual(committed.field.portals[3], observerBefore);
  assert.notDeepEqual(committed.field.portals[committed.event.receiverIndex], initial.field.portals[committed.event.receiverIndex]);
});

test('webgpu v044 exposes the browser handoff contract', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/webgpu/v044/index.html',
    'studies/webgpu/v044/sketch.js',
    'studies/webgpu/v044/style.css',
    'studies/webgpu/v044/README.md',
    'studies/webgpu/v044/metrics.json',
    'studies/webgpu/v044/critiques.json'
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
  }
  const html = await read('studies/webgpu/v044/index.html');
  const sketch = await read('studies/webgpu/v044/sketch.js');
  const style = await read('studies/webgpu/v044/style.css');
  const readme = await read('studies/webgpu/v044/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v044/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v044/critiques.json'));

  assert.match(html, /id="relay-field"/);
  assert.match(html, /data-gesture="relay"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /createCanvas\([^)]*WEBGL/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x57473044');
  assert.equal(metrics.grammar, 'reciprocal-orbit');
  assert.equal(metrics.renderer, 'deterministic p5.js 1.11.3 WEBGL reciprocal orbit field');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('webgpu v044 compounds four reciprocal apertures, lifts exactly, and releases to the seed', () => {
  const initial = buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatestHandoff(settled);
  const released = engine.releaseArchive();

  assert.equal(timeline.length, engine.STAGES);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.transfers.length, engine.MEMORY_LIMIT);
  assert.deepEqual(engine.buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, engine.MEMORY_LIMIT - 1);
  assert.equal(lifted.event.type, 'handoff-lifted');
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});
