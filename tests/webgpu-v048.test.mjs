import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const enginePath = new URL('../studies/webgpu/v048/engine.mjs', import.meta.url);
const loadEngine = async () => import(`${enginePath.href}?test=${Date.now()}-${Math.random()}`);

const routeSequence = (engine, count = engine.MEMORY_LIMIT) => {
  let frame = engine.buildFrame();
  for (let index = 0; index < count; index += 1) {
    frame = engine.commitDefaultRoute(frame);
  }
  return frame;
};

test('WebGPU v048 starts as a deterministic pressure shell, not a discrete crowd', async () => {
  const engine = await loadEngine();
  const frame = engine.buildFrame();

  assert.equal(frame.grammar, 'pressure-shell');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.field.ports.length, engine.PORT_COUNT);
  assert.equal(frame.field.surface.vertices.length, engine.SURFACE_ROWS * engine.SURFACE_COLS);
  assert.ok(frame.field.surface.faces.length > 100);
  assert.equal(engine.geometrySignature(frame), engine.geometrySignature(engine.buildFrame()));
});

test('WebGPU v048 keeps an uncompleted pressure route geometrically exact', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const armed = engine.pressPort(quiet, 0);
  const repeated = engine.pressPort(armed, 0);
  const wrongExit = engine.releaseAtPort(armed, 1);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.gesture.entry, 0);
  assert.equal(engine.geometrySignature(armed), engine.geometrySignature(quiet));
  assert.match(repeated.lastAction, /repeat|refused/i);
  assert.equal(engine.geometrySignature(repeated), engine.geometrySignature(quiet));
  assert.match(wrongExit.lastAction, /route|refused/i);
  assert.equal(engine.geometrySignature(wrongExit), engine.geometrySignature(quiet));
});

test('WebGPU v048 turns a valid pressure route into a global material rewrite', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const armed = engine.pressPort(quiet, 0);
  const expectedExit = engine.expectedExitFor(0, 0);
  const committed = engine.releaseAtPort(armed, expectedExit);
  const changedVertices = committed.field.surface.vertices.filter((vertex, index) => JSON.stringify(vertex) !== JSON.stringify(quiet.field.surface.vertices[index]));
  const event = committed.memory[0];

  assert.equal(committed.memory.length, 1);
  assert.equal(event.type, 'pressure-route');
  assert.equal(event.entry, 0);
  assert.equal(event.exit, expectedExit);
  assert.equal(committed.field.nextEntry, expectedExit);
  assert.ok(committed.field.seams.length === 1);
  assert.ok(changedVertices.length > quiet.field.surface.vertices.length * 0.45);
  assert.notEqual(engine.geometrySignature(committed), engine.geometrySignature(quiet));
});

test('WebGPU v048 makes the remembered exit the only valid next source', async () => {
  const engine = await loadEngine();
  const first = engine.commitDefaultRoute(engine.buildFrame());
  const expectedEntry = first.memory[0].exit;
  const wrongOrigin = engine.pressPort(first, (expectedEntry + 1) % engine.PORT_COUNT);
  const rightOrigin = engine.pressPort(first, expectedEntry);

  assert.match(wrongOrigin.lastAction, /origin|refused/i);
  assert.equal(engine.geometrySignature(wrongOrigin), engine.geometrySignature(first));
  assert.equal(rightOrigin.gesture.entry, expectedEntry);
  assert.equal(rightOrigin.memory.length, 1);
});

test('WebGPU v048 compounds four pressure routes, lifts exactly, and releases the shell', async () => {
  const engine = await loadEngine();
  const quiet = engine.buildFrame();
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatest(settled);
  const released = engine.releaseMaterial();

  assert.equal(timeline.length, engine.MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.equal(settled.field.seams.length, engine.MEMORY_LIMIT);
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(quiet));
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.deepEqual(lifted.memory, timeline.at(-2).memory);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(quiet));
});

test('WebGPU v048 exposes the pressure-shell tableau and complete art-gate record', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v048/index.html');
  const sketch = await read('studies/webgpu/v048/sketch.js');
  const style = await read('studies/webgpu/v048/style.css');
  const readme = await read('studies/webgpu/v048/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v048/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v048/critiques.json'));

  assert.match(index, /id="pressure-field"/);
  assert.match(index, /data-gesture="route"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(sketch, /pressPort|releaseAtPort|pointer/);
  assert.match(sketch, /pressure|shell|material/i);
  assert.match(sketch, /WEBGL|beginShape|vertex/i);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.grammar, 'pressure-shell');
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.match(metrics.memoryRule, /pressure|route|shell|material/i);
  assert.ok(critiques.length >= 10);
});

test('WebGPU v048 is recorded exactly once for the 2026-11-09 daily slot', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-11-09');
  const record = matches[0];
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'webgpu-2026-11-09');

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-11-09');
  assert.equal(record.rawPath, '/studies/webgpu/v048/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-11-09');
  assert.ok(record.critiques.length >= 10);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.translatedRule, /pressure|route|surface|material/i);
  assert.equal(publicMatches.length, 1);
  assert.equal(await read('works/webgpu-2026-11-09/index.html').then(Boolean), true);
});
