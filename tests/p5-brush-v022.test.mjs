import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v022 pressure coagulation changes the continuous pigment field and lifts exactly', async () => {
  const { buildFrame, applyPressureDwell, liftLatestDwell, geometrySignature } = await import('../studies/p5-brush/v022/engine.mjs');
  const baseline = buildFrame(5, []);
  const changed = applyPressureDwell(baseline, { point: { x: 0.31, y: 0.58 }, duration: 840 });
  const lifted = liftLatestDwell(changed);

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'pressure-dwell');
  assert.ok(changed.coagulatedMass > baseline.coagulatedMass);
  assert.ok(changed.pigment.some((sample, index) => sample.density !== baseline.pigment[index].density));
  assert.ok(changed.pigment.some((sample) => sample.cusp > 0.12));
  assert.equal(geometrySignature(lifted), geometrySignature(baseline));
});


test('brush v022 refuses a tap and lets pressure accumulate as a bounded causal memory', async () => {
  const { buildFrame, applyPressureDwell } = await import('../studies/p5-brush/v022/engine.mjs');
  const baseline = buildFrame(3, []);
  const tap = applyPressureDwell(baseline, { point: { x: 0.5, y: 0.5 }, duration: 120 });
  const first = applyPressureDwell(baseline, { point: { x: 0.5, y: 0.5 }, duration: 650 });
  const second = applyPressureDwell(first, { point: { x: 0.76, y: 0.28 }, duration: 900 });
  const repeat = applyPressureDwell(first, { point: { x: 0.76, y: 0.28 }, duration: 900 });

  assert.equal(tap.interaction, 'pressure-refused');
  assert.equal(tap.memory.length, 0);
  assert.equal(second.memory.length, 2);
  assert.ok(second.memory.every((event) => event.kind === 'pressure-dwell'));
  assert.notDeepEqual(second.pigment, first.pigment);
  assert.deepEqual(second, repeat);
  assert.ok(second.memory.length <= 4);
});


test('brush v022 raw tableau exposes the pressure encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v022/index.html');
  const sketch = await read('studies/p5-brush/v022/sketch.js');
  const style = await read('studies/p5-brush/v022/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="pigment-field"/);
  assert.match(html, /id="coagulate-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /data-raw-work-id="brush-2026-10-02"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyPressureDwell/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v022 records the art gate, p5.brush translation, and canonical daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v022/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v022/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v022/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-10-02/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525542');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /coagulat|cusp|binder/i);
  assert.match(metrics.interactionRule, /hold|dwell/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-10-02');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'brush-2026-10-02');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v022/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /pressure|coagulat|binder/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-10-02');
  assert.equal(work.decision.lineage, 'brush-2026-10-01');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-02"/);
});
