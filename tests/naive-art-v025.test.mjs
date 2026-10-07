import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const engineUrl = '../studies/naive-art/v025/engine.mjs';

test('Naive v025 turns a sustained pressure sample into a global cut, not a local mark', async () => {
  const {
    buildFrame,
    geometrySignature,
    pressAt,
    liftLatestPressure
  } = await import(engineUrl);

  const baseline = buildFrame(0, []);
  const pressed = pressAt(baseline, { x: 0.72, y: 0.36, duration: 220 });
  const event = pressed.memory.at(-1);

  assert.equal(baseline.memory.length, 0);
  assert.equal(pressed.memory.length, 1);
  assert.equal(event.source, 'global-pressure-cut');
  assert.equal(event.duration, 220);
  assert.notEqual(event.beforeAperture, event.afterAperture);
  assert.ok(pressed.scene.trace.changedPieceCount >= 5, 'pressure must change several pieces');
  assert.ok(pressed.scene.trace.globalCut > 0, 'pressure must create a global cut');
  assert.ok(pressed.scene.pieces.some((piece) => piece.points.some(([x, y], index) => {
    const base = baseline.scene.pieces.find((candidate) => candidate.id === piece.id);
    return base && (base.points[index][0] !== x || base.points[index][1] !== y);
  })), 'piece geometry must change, not just metadata');
  assert.notEqual(geometrySignature(pressed), geometrySignature(baseline));

  const restored = liftLatestPressure(pressed);
  assert.equal(restored.interaction, 'pressure-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v025 keeps pressure memory deterministic and bounded', async () => {
  const { MEMORY_WINDOW, buildFrame, buildTimeline, pressAt, releasePressure } = await import(engineUrl);
  const baseline = buildFrame(2, []);
  const next = pressAt(baseline, { x: 0.24, y: 0.68, duration: 260 });
  const repeat = pressAt(baseline, { x: 0.24, y: 0.68, duration: 260 });
  const alternate = pressAt(baseline, { x: 0.82, y: 0.18, duration: 260 });
  const bounded = pressAt({ ...baseline, memory: Array(9).fill(next.memory[0]) }, { x: 0.5, y: 0.5, duration: 300 });

  assert.deepEqual(next, repeat);
  assert.notEqual(next.memory.at(-1).afterAperture, alternate.memory.at(-1).afterAperture);
  assert.ok(next.scene.trace.changedPieceCount >= 5);
  assert.ok(bounded.memory.length <= MEMORY_WINDOW);
  assert.equal(buildTimeline().at(-1).memory.length, MEMORY_WINDOW);
  assert.ok(buildTimeline().at(-1).scene.trace.globalCut > 0);
  assert.deepEqual(releasePressure().scene, buildFrame(0, []).scene);
});

test('Naive v025 exposes the press interaction, p5 tableau, and honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v025/index.html',
    'studies/naive-art/v025/engine.mjs',
    'studies/naive-art/v025/sketch.js',
    'studies/naive-art/v025/style.css',
    'studies/naive-art/v025/README.md',
    'studies/naive-art/v025/metrics.json',
    'studies/naive-art/v025/critiques.json',
    'works/naive-2026-10-07/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v025/index.html');
  const sketch = await read('studies/naive-art/v025/sketch.js');
  const style = await read('studies/naive-art/v025/style.css');
  const readme = await read('studies/naive-art/v025/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v025/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v025/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-07');
  const record = matches[0];

  assert.match(index, /id="pressure-sheet"/);
  assert.match(index, /id="press-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-07"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /pressAt/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /window\.__mutineNaiveV025/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413235');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /pressure|cut|aperture/i);
  assert.match(metrics.interactionRule, /press|duration|keyboard/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-07');
  assert.equal(record.rawPath, '/studies/naive-art/v025/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-07');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|cut|aperture/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /body|sheet|cut|object/i);
});
