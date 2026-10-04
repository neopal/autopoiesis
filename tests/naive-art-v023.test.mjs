import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v023 turns a timed double-tap into a remembered wrong landing', async () => {
  const {
    buildFrame,
    buildTimeline,
    commitSlip,
    liftLatestSlip,
    geometrySignature
  } = await import('../studies/naive-art/v023/engine.mjs');

  const baseline = buildFrame(0, []);
  const slipped = commitSlip(baseline, { bandIndex: 3 });
  const event = slipped.memory.at(-1);
  const changedBand = slipped.scene.strokes[event.bandIndex];

  assert.equal(baseline.memory.length, 0);
  assert.equal(slipped.memory.length, 1);
  assert.equal(event.source, 'double-tap-slip');
  assert.notEqual(event.intendedLanding, event.wrongLanding);
  assert.equal(changedBand.toIndex, event.wrongLanding, 'the committed slip must land on the wrong anchor');
  assert.equal(slipped.scene.trace.wrongLandingCount, 1);
  assert.equal(slipped.scene.trace.intendedGapCount, 1);
  assert.equal(slipped.scene.trace.nextRule, 'reuse-wrong-landing');
  assert.equal(slipped.scene.trace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(slipped), geometrySignature(baseline));

  const restored = liftLatestSlip(slipped);
  assert.equal(restored.interaction, 'slip-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v023 keeps its material route deterministic and bounded', async () => {
  const { buildFrame, buildTimeline, commitSlip } = await import('../studies/naive-art/v023/engine.mjs');
  const baseline = buildFrame(2, []);
  const next = commitSlip(baseline, { bandIndex: 5 });
  const repeat = commitSlip(baseline, { bandIndex: 5 });
  const alternate = commitSlip(baseline, { bandIndex: 7 });
  const bounded = commitSlip({ ...baseline, memory: Array(9).fill(next.memory[0]) }, { bandIndex: 5 });

  assert.deepEqual(next, repeat);
  assert.notEqual(next.memory.at(-1).wrongLanding, alternate.memory.at(-1).wrongLanding);
  assert.ok(bounded.memory.length <= 4);
  assert.ok(next.scene.strokes.some((stroke) => stroke.fromIndex !== stroke.expectedFromIndex || stroke.toIndex !== stroke.expectedToIndex));

  const settled = buildTimeline().at(-1);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.scene.trace.wrongLandingCount, 4);
  assert.equal(settled.scene.trace.intendedGapCount, 4);
  assert.ok(settled.scene.strokes.every((stroke) => stroke.fromIndex !== stroke.toIndex), 'the remembered route must keep painting through each band');
  assert.ok(settled.scene.trace.routeLength > 0);
});

test('Naive v023 exposes a caption-free canvas tableau and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v023/index.html',
    'studies/naive-art/v023/engine.mjs',
    'studies/naive-art/v023/sketch.js',
    'studies/naive-art/v023/style.css',
    'studies/naive-art/v023/README.md',
    'studies/naive-art/v023/metrics.json',
    'studies/naive-art/v023/critiques.json',
    'works/naive-2026-10-03/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v023/index.html');
  const sketch = await read('studies/naive-art/v023/sketch.js');
  const style = await read('studies/naive-art/v023/style.css');
  const readme = await read('studies/naive-art/v023/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v023/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v023/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-10-03');
  const record = matches[0];

  assert.match(index, /id="naive-field"/);
  assert.match(index, /id="slip-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-10-03"/);
  assert.match(sketch, /commitSlip/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /window\.__mutineNaiveV023/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413233');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /wrong landing|route|double-tap/i);
  assert.match(metrics.interactionRule, /double-tap|timed|keyboard/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-10-03');
  assert.equal(record.rawPath, '/studies/naive-art/v023/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-10-03');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /material|landing|route/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /canvas|route|continuous/i);
});
