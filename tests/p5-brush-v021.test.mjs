import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v021 drag removes actual grains and makes a distant answer grow', async () => {
  const { buildFrame, rakeField } = await import('../studies/p5-brush/v021/engine.mjs');
  const baseline = buildFrame(0, []);
  const path = [{ x: 0.2, y: 0.38 }, { x: 0.43, y: 0.5 }, { x: 0.7, y: 0.36 }];
  const changed = rakeField(baseline, { path });

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.ok(changed.removedCount >= 3);
  assert.ok(changed.scars.length >= 1);
  assert.ok(changed.answers.length >= 1);
  assert.ok(changed.cells.some((cell) => cell.bypass > 0.02));
  assert.ok(changed.cells.some((cell) => cell.answerLoad > 0.02));
  assert.equal(changed.memory[0].rule, 'rake-and-answer');
});


test('brush v021 rakes are deterministic, bounded, and refuse a tap', async () => {
  const { buildFrame, rakeField } = await import('../studies/p5-brush/v021/engine.mjs');
  const baseline = buildFrame(4, []);
  const path = [{ x: 0.25, y: 0.67 }, { x: 0.52, y: 0.55 }, { x: 0.78, y: 0.7 }];
  const next = rakeField(baseline, { path });
  const repeat = rakeField(baseline, { path });
  const opposite = rakeField(baseline, { path: [...path].reverse() });
  const tap = rakeField(baseline, { path: [{ x: 0.5, y: 0.5 }] });
  const edge = rakeField(baseline, { path: [{ x: -4, y: 3 }, { x: 9, y: -2 }, { x: 0.5, y: 0.5 }] });

  assert.deepEqual(next, repeat);
  assert.notDeepEqual(next, opposite);
  assert.equal(tap.memory.length, 0);
  assert.equal(tap.interaction, 'rake-refused');
  assert.ok(edge.memory.length <= 1);
  assert.ok(edge.cells.every((cell) => cell.x >= 0 && cell.x <= 1 && cell.y >= 0 && cell.y <= 1));
});


test('brush v021 lifting the latest rake restores the exact preceding grain field', async () => {
  const { buildFrame, rakeField, liftLatestRake, geometrySignature } = await import('../studies/p5-brush/v021/engine.mjs');
  const baseline = buildFrame(7, []);
  const first = rakeField(baseline, { path: [{ x: 0.2, y: 0.3 }, { x: 0.6, y: 0.42 }, { x: 0.75, y: 0.3 }] });
  const second = rakeField(first, { path: [{ x: 0.72, y: 0.68 }, { x: 0.45, y: 0.54 }, { x: 0.2, y: 0.7 }] });
  const lifted = liftLatestRake(second);

  assert.equal(second.memory.length, 2);
  assert.equal(lifted.interaction, 'rake-lifted');
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.notEqual(geometrySignature(second), geometrySignature(first));
});


test('brush v021 raw tableau uses a grain lattice and drag encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v021/index.html');
  const sketch = await read('studies/p5-brush/v021/sketch.js');
  const style = await read('studies/p5-brush/v021/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="grain-field"/);
  assert.match(html, /id="rake-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /data-raw-work-id="brush-2026-10-01"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /rakeField/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keyPressed|keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v021 records its art gate, little-critters translation, and canonical daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v021/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v021/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v021/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-10-01/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525541');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /rake|scar|answer/i);
  assert.match(metrics.interactionRule, /drag|rake/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-10-01');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'brush-2026-10-01');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v021/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /attention|rake|answer|scar/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-10-01');
  assert.equal(work.decision.lineage, 'brush-2026-09-26');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-01"/);
});
