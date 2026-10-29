import test from 'node:test';
import assert from 'node:assert/strict';

const enginePath = new URL('../studies/webgpu/v038/engine.mjs', import.meta.url);
const loadEngine = async () => import(enginePath.href);

test('WebGPU v038 keeps a signal probe view-only until release, then archives a remote lattice response', async () => {
  const {
    buildFrame,
    beginSignal,
    aimSignal,
    finishSignal,
    geometrySignature,
    GRID_COLS,
    GRID_ROWS
  } = await loadEngine();
  const quiet = buildFrame();
  const source = { x: 0.18, y: 0.72 };
  const armed = beginSignal(quiet, source);
  const aimed = aimSignal(armed, { x: 0.54, y: 0.28 });

  assert.equal(geometrySignature(armed), geometrySignature(quiet), 'arming must not deform the lattice');
  assert.equal(geometrySignature(aimed), geometrySignature(quiet), 'aiming must remain view state');
  assert.equal(aimed.memory.length, 0, 'a probe must not write history before release');

  const committed = finishSignal(aimed, { x: 0.54, y: 0.28, confirmedAt: 240 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'remote-consensus');
  assert.ok(committed.field.cells.length === GRID_COLS * GRID_ROWS);
  assert.notEqual(committed.memory[0].sourceIndex, committed.memory[0].receiverIndex, 'the response must be displaced from the probe');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.cells.some((cell, index) => cell.load !== quiet.field.cells[index].load));
  assert.ok(committed.field.cells.some((cell, index) => cell.phase !== quiet.field.cells[index].phase));
});

test('WebGPU v038 rejects unconfirmed probes, bounds archive memory, and lifts the exact prior lattice', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    beginSignal,
    finishSignal,
    geometrySignature,
    liftLatestSignal,
    releaseArchive,
    defaultSignal
  } = await loadEngine();
  const quiet = buildFrame();
  const refused = finishSignal(beginSignal(quiet, { x: 0.2, y: 0.5 }), { x: 0.2, y: 0.5, confirmedAt: 40, confirmed: false });
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused/);

  let frame = quiet;
  for (let index = 0; index < MEMORY_LIMIT + 1; index += 1) {
    const signal = defaultSignal(frame);
    frame = finishSignal(beginSignal(frame, signal.source), { ...signal.target, confirmedAt: 280, confirmed: true });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestSignal(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v038 renders a discrete signal lattice with deterministic remote consensus memory', async () => {
  const { GRID_COLS, GRID_ROWS, buildFrame, buildTimeline } = await loadEngine();
  const quiet = buildFrame();
  assert.equal(quiet.field.kind, 'signal-lattice');
  assert.equal(quiet.field.cells.length, GRID_COLS * GRID_ROWS);
  assert.ok(quiet.field.cells.every((cell) => Number.isFinite(cell.load) && Number.isFinite(cell.phase)));
  assert.ok(quiet.field.cells.some((cell) => cell.gap > 0), 'the lattice must keep visible negative spaces');

  const settled = buildTimeline(5).at(-1);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.cells.some((cell) => cell.load > 0.78 || cell.load < 0.22));
  assert.ok(settled.field.cells.some((cell) => cell.gap > 0.42));
});

test('WebGPU v038 exposes a signal-lattice tableau and explicit art-gate evidence', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v038/index.html');
  const sketch = await read('studies/webgpu/v038/sketch.js');
  const style = await read('studies/webgpu/v038/style.css');
  const readme = await read('studies/webgpu/v038/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v038/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v038/critiques.json'));

  assert.match(index, /id="signal-field"/);
  assert.match(index, /data-gesture="broadcast"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.js/i);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /mousePressed|touchStarted/);
  assert.match(sketch, /finishSignal/);
  assert.match(sketch, /liftLatestSignal/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /signal-lattice/i);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'p5.js Canvas 2D signal lattice with WebGPU capability signal');
  assert.match(metrics.memoryRule, /consensus|remote|lattice|signal/i);
  assert.ok(critiques.length >= 9);
});

test('WebGPU v038 is recorded exactly once for the 2026-10-29 daily slot', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-29');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-29');
  assert.equal(record.rawPath, '/studies/webgpu/v038/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-29');
  assert.ok(record.critiques.length >= 9);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /attention|proximity|agent|visitor/i);
  assert.match(record.source.translatedRule, /consensus|lattice|signal|remote/i);
  assert.match(record.metrics.memoryRule, /consensus|remote|lattice|signal/i);
  assert.equal(await read('works/webgpu-2026-10-29/index.html').then(Boolean), true);
});

test('WebGPU v038 keeps the lattice geometry on the canvas and does not fall back to a CSS poster', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const index = await read('studies/webgpu/v038/index.html');
  const sketch = await read('studies/webgpu/v038/sketch.js');
  assert.match(index, /<canvas[^>]+id="signal-field"/);
  assert.match(sketch, /state\.frame\.field\.cells/);
  assert.match(sketch, /p\.rect|beginShape/);
  assert.doesNotMatch(sketch, /querySelector\('#signal-field'\).*innerHTML/);
});
