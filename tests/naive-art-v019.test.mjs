import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v019 wheel step changes a continuous panorama and lifting restores the exact prior mural', async () => {
  const { buildFrame, stepWeather, liftLatestStep, geometrySignature } = await import('../studies/naive-art/v019/engine.mjs');
  const baseline = buildFrame(0, []);
  const changed = stepWeather(baseline, { direction: 1 });
  const event = changed.memory.at(-1);
  const source = changed.scene.forms[event.sourceIndex];
  const receiver = changed.scene.forms[event.receiverIndex];
  const horizon = changed.scene.horizon;

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-wheel-step');
  assert.notEqual(event.sourceIndex, event.receiverIndex);
  assert.ok(source.opening > 0.02, 'the source form must lose a real contour segment');
  assert.ok(receiver.borrowedContour > 0.02, 'a distant form must inherit a real contour');
  assert.ok(horizon.wrongSlope > 0.01, 'the horizon must be rebuilt, not merely recoloured');
  assert.ok(changed.scene.materialTrace.stepChanges >= 3);
  assert.equal(changed.scene.materialTrace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));

  const restored = liftLatestStep(changed);
  assert.equal(restored.interaction, 'step-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v019 steps are deterministic, bounded, and directionally distinct', async () => {
  const { buildFrame, stepWeather } = await import('../studies/naive-art/v019/engine.mjs');
  const baseline = buildFrame(4, []);
  const next = stepWeather(baseline, { direction: 1 });
  const repeat = stepWeather(baseline, { direction: 1 });
  const previous = stepWeather(baseline, { direction: -1 });
  const edge = stepWeather(baseline, { direction: 999 });

  assert.deepEqual(next, repeat);
  assert.equal(next.memory[0].source, 'visitor-wheel-step');
  assert.notEqual(next.memory[0].sourceIndex, previous.memory[0].sourceIndex);
  assert.ok(edge.memory[0].receiverIndex >= 0 && edge.memory[0].receiverIndex < baseline.scene.forms.length);
  assert.ok(next.scene.horizon.wrongSlope > 0.01);
  assert.ok(next.scene.sky.notchedSun > 0);
});

test('Naive v019 exposes a caption-free p5 panorama and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v019/index.html',
    'studies/naive-art/v019/engine.mjs',
    'studies/naive-art/v019/sketch.js',
    'studies/naive-art/v019/style.css',
    'studies/naive-art/v019/README.md',
    'studies/naive-art/v019/metrics.json',
    'studies/naive-art/v019/critiques.json',
    'works/naive-2026-09-26/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v019/index.html');
  const sketch = await read('studies/naive-art/v019/sketch.js');
  const style = await read('studies/naive-art/v019/style.css');
  const readme = await read('studies/naive-art/v019/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v019/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v019/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-26');
  const record = matches[0];

  assert.match(index, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(index, /The picture remembers <br><i>a second horizon\.<\/i>/);
  assert.match(index, /id="panorama"/);
  assert.match(index, /id="step-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-09-26"/);
  assert.match(sketch, /mouseWheel|wheel/);
  assert.match(sketch, /stepWeather/);
  assert.match(sketch, /liftLatestStep/);
  assert.match(sketch, /keyPressed|keydown/);
  assert.match(sketch, /window\.__mutineNaiveV019/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413139');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /wheel|contour|horizon/i);
  assert.match(metrics.interactionRule, /wheel|step/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-26');
  assert.equal(record.rawPath, '/studies/naive-art/v019/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-26');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /wheel|horizon|contour/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /panorama|mural|hinge|pile/i);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matrices passed/);
});
