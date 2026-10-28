import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v037/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v037 keeps a rotating mass geometrically quiet until a complete turn commits a remote shear', async () => {
  const {
    buildFrame,
    beginTurn,
    turnVolume,
    finishTurn,
    geometrySignature,
    MIN_SWEEP
  } = await loadEngine();
  const quiet = buildFrame();
  const armed = beginTurn(quiet, { x: 0.24, y: 0.52, at: 100 });
  const moved = turnVolume(armed, { x: 0.24 + MIN_SWEEP * 0.55, y: 0.52, at: 180 });

  assert.equal(geometrySignature(armed), geometrySignature(quiet), 'arming must not deform the material');
  assert.equal(geometrySignature(moved), geometrySignature(quiet), 'preview rotation must remain view state');
  assert.equal(moved.memory.length, 0, 'preview rotation must not write material history');

  const committed = finishTurn(moved, { x: 0.24 + MIN_SWEEP, y: 0.52, finishedAt: 520 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'remote-shear');
  assert.notEqual(committed.memory[0].sourceLayer, committed.memory[0].remoteLayer, 'the shear must be displaced from the touched layer');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.layers.some((layer, index) => layer.shear !== quiet.field.layers[index].shear));
  assert.ok(committed.field.layers.some((layer, index) => layer.offset !== quiet.field.layers[index].offset));
});

test('WebGPU v037 refuses incomplete turns, bounds material memory, and lifts the exact preceding block', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    beginTurn,
    finishTurn,
    geometrySignature,
    liftLatestTurn,
    releaseArchive,
    MIN_SWEEP,
    MAX_SWEEP
  } = await loadEngine();
  const quiet = buildFrame();
  const refusedShort = finishTurn(beginTurn(quiet, { x: 0.2, y: 0.5, at: 0 }), { x: 0.2 + MIN_SWEEP * 0.4, y: 0.5, finishedAt: 300 });
  assert.equal(refusedShort.memory.length, 0);
  assert.match(refusedShort.lastAction, /refused/);
  const refusedLong = finishTurn(beginTurn(quiet, { x: 0.2, y: 0.5, at: 0 }), { x: 0.2 + MAX_SWEEP * 1.4, y: 0.5, finishedAt: 300 });
  assert.equal(refusedLong.memory.length, 0);
  assert.match(refusedLong.lastAction, /refused/);

  let frame = quiet;
  for (const start of [0.12, 0.31, 0.54, 0.73, 0.88]) {
    frame = finishTurn(beginTurn(frame, { x: start, y: 0.35, at: 0 }), { x: start + 0.42, y: 0.35, finishedAt: 500 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestTurn(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v037 builds one three-dimensional sediment prism instead of a population field', async () => {
  const { LAYER_COUNT, buildFrame, buildTimeline } = await loadEngine();
  const quiet = buildFrame();
  assert.equal(quiet.field.kind, 'sediment-prism');
  assert.equal(quiet.field.layers.length, LAYER_COUNT);
  assert.ok(quiet.field.layers.every((layer) => layer.depth > 0 && layer.thickness > 0));
  assert.ok(quiet.field.layers.some((layer) => layer.cut > 0), 'the prism must have a visible internal cut');

  const settled = buildTimeline(7).at(-1);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.layers.some((layer) => layer.shear > 0.18 || layer.shear < -0.18));
  assert.ok(settled.field.layers.some((layer) => layer.offset > 0.03 || layer.offset < -0.03));
});

test('WebGPU v037 exposes a material-prism tableau and explicit art-gate evidence', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v037/index.html');
  const sketch = await read('studies/webgpu/v037/sketch.js');
  const style = await read('studies/webgpu/v037/style.css');
  const readme = await read('studies/webgpu/v037/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v037/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v037/critiques.json'));

  assert.match(index, /id="mass-field"/);
  assert.match(index, /data-gesture="turn"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.js/i);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /mouseDragged|touchMoved/);
  assert.match(sketch, /finishTurn/);
  assert.match(sketch, /liftLatestTurn/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /WEBGL/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'p5.js WEBGL sediment prism with WebGPU capability signal');
  assert.match(metrics.memoryRule, /material|remote|shear|prism/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v037 is recorded exactly once for the 2026-10-28 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-28');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-28');
  assert.equal(record.rawPath, '/studies/webgpu/v037/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-28');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.source.title, 'p5.brush');
  assert.match(record.source.observedMechanism, /material|pressure|geometry|field/i);
  assert.match(record.source.translatedRule, /material|prism|shear|remote/i);
  assert.match(record.metrics.memoryRule, /material|remote|shear|prism/i);
  assert.equal(await read('works/webgpu-2026-10-28/index.html').then(Boolean), true);
});

test('WebGPU v037 keeps its prism geometry on the canvas and does not fall back to a CSS shape', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v037/index.html');
  const sketch = await read('studies/webgpu/v037/sketch.js');
  assert.match(index, /<canvas[^>]+id="mass-field"/);
  assert.match(sketch, /state\.frame\.field\.layers/);
  assert.match(sketch, /p\.box|beginShape/);
  assert.doesNotMatch(sketch, /querySelector\('#mass-field'\).*innerHTML/);
});
