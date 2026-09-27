import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

test('Naive v020 press transfers pressure into a cavity, a displaced relief, and a changed register', async () => {
  const { buildFrame, pressPlate, liftLatestPress, geometrySignature } = await import('../studies/naive-art/v020/engine.mjs');
  const baseline = buildFrame(0, []);
  const pressed = pressPlate(baseline);
  const event = pressed.memory.at(-1);
  const source = pressed.scene.plates[event.sourceIndex];
  const receiver = pressed.scene.plates[event.receiverIndex];

  assert.equal(baseline.memory.length, 0);
  assert.equal(pressed.memory.length, 1);
  assert.equal(event.source, 'visitor-pressure');
  assert.notEqual(event.sourceIndex, event.receiverIndex);
  assert.ok(source.cavity > 0.02, 'the source plate must lose a real piece of its silhouette');
  assert.ok(receiver.relief > 0.02, 'a distant plate must inherit a changed relief edge');
  assert.ok(pressed.scene.register.gap > 0.01, 'the register must keep a real pressure gap');
  assert.ok(pressed.scene.register.offset > 0.01, 'the register must misalign around the pressure');
  assert.ok(pressed.scene.materialTrace.geometryChanges >= 4);
  assert.equal(pressed.scene.materialTrace.pointerOnlyChanges, 0);
  assert.notEqual(geometrySignature(pressed), geometrySignature(baseline));

  const restored = liftLatestPress(pressed);
  assert.equal(restored.interaction, 'pressure-lifted');
  assert.deepEqual(restored.scene, baseline.scene);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('Naive v020 pressure is deterministic, bounded, and directionally distinct', async () => {
  const { buildFrame, pressPlate } = await import('../studies/naive-art/v020/engine.mjs');
  const baseline = buildFrame(4, []);
  const next = pressPlate(baseline, { direction: 1 });
  const repeat = pressPlate(baseline, { direction: 1 });
  const previous = pressPlate(baseline, { direction: -1 });
  const bounded = pressPlate({ ...baseline, memory: Array(20).fill(next.memory[0]) });

  assert.deepEqual(next, repeat);
  assert.equal(next.memory[0].source, 'visitor-pressure');
  assert.notEqual(next.memory[0].sourceIndex, previous.memory[0].sourceIndex);
  assert.ok(bounded.memory.length <= 4);
  assert.ok(next.scene.register.gap > 0.01);
  assert.ok(next.scene.plates.some((plate) => plate.cavity > 0.01));
});

test('Naive v020 exposes a caption-free p5 pressure sheet and an honest daily record', async () => {
  for (const path of [
    'studies/naive-art/v020/index.html',
    'studies/naive-art/v020/engine.mjs',
    'studies/naive-art/v020/sketch.js',
    'studies/naive-art/v020/style.css',
    'studies/naive-art/v020/README.md',
    'studies/naive-art/v020/metrics.json',
    'studies/naive-art/v020/critiques.json',
    'works/naive-2026-09-27/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/naive-art/v020/index.html');
  const sketch = await read('studies/naive-art/v020/sketch.js');
  const style = await read('studies/naive-art/v020/style.css');
  const readme = await read('studies/naive-art/v020/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v020/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v020/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'naive' && work.date === '2026-09-27');
  const record = matches[0];

  assert.match(index, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(index, /The picture keeps <br><i>the wrong pressure\.<\/i>/);
  assert.match(index, /id="press-sheet"/);
  assert.match(index, /id="press-control"/);
  assert.match(index, /id="undo-control"/);
  assert.match(index, /id="release-control"/);
  assert.match(index, /data-raw-work-id="naive-2026-09-27"/);
  assert.match(sketch, /pressPlate/);
  assert.match(sketch, /liftLatestPress/);
  assert.match(sketch, /beginContour/);
  assert.match(sketch, /keyPressed|keydown/);
  assert.match(sketch, /window\.__mutineNaiveV020/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x4e413230');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /pressure|cavity|relief|register/i);
  assert.match(metrics.interactionRule, /press/i);
  assert.equal(critiques.length, 5);

  assert.equal(matches.length, 1);
  assert.equal(record.id, 'naive-2026-09-27');
  assert.equal(record.rawPath, '/studies/naive-art/v020/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-naive-2026-09-27');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.source.translatedRule, /pressure|cavity|relief|register/i);
  assert.ok(record.critiques.length >= 4);
  assert.match(record.metrics.representationRupture, /press|print|plate|mural/i);
  assert.match(record.browserEvidence.status, /^local(?: and production)? headless browser matrices passed/);
});
