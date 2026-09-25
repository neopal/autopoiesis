import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v019 turns an ordinal wheel into a load-bearing gap and a counterweight', async () => {
  const { buildFrame, registerTurn } = await import('../studies/p5-brush/v019/engine.mjs');
  const baseline = buildFrame(0, []);
  const changed = registerTurn(baseline, { direction: 1 });

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.rungs.length, baseline.rungs.length - 1);
  assert.equal(changed.counterweights.length, 1);
  assert.equal(changed.missingRungs.length, 1);
  assert.ok(changed.gapLoad > 0.25);
  assert.ok(changed.counterweights[0].mass > 0.2);
  assert.notEqual(changed.rungs.map((rung) => rung.y).join(','), baseline.rungs.map((rung) => rung.y).join(','));
});


test('brush v019 wheel turns are bounded, deterministic, and directionally distinct', async () => {
  const { buildFrame, registerTurn } = await import('../studies/p5-brush/v019/engine.mjs');
  const baseline = buildFrame(4, []);
  const next = registerTurn(baseline, { direction: 1 });
  const repeat = registerTurn(baseline, { direction: 1 });
  const previous = registerTurn(baseline, { direction: -1 });
  const edge = registerTurn(baseline, { direction: 999 });

  assert.deepEqual(next, repeat);
  assert.equal(previous.memory[0].source, 'visitor-wheel');
  assert.equal(next.memory[0].rule, 'ordinal-gap-counterweight');
  assert.notEqual(next.memory[0].rungIndex, previous.memory[0].rungIndex);
  assert.ok(edge.memory[0].rungIndex >= 0 && edge.memory[0].rungIndex < baseline.rungs.length);
  assert.ok(next.counterweights[0].anchorX > 0.75);
  assert.ok(next.missingRungs[0].anchorY > 0.1 && next.missingRungs[0].anchorY < 0.9);
});


test('brush v019 lifting the latest turn restores the exact preceding register', async () => {
  const { buildFrame, registerTurn, liftLatestTurn, geometrySignature } = await import('../studies/p5-brush/v019/engine.mjs');
  const baseline = buildFrame(7, []);
  const first = registerTurn(baseline, { direction: 1 });
  const second = registerTurn(first, { direction: -1 });
  const lifted = liftLatestTurn(second);

  assert.equal(second.memory.length, 2);
  assert.equal(lifted.interaction, 'turn-lifted');
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.notEqual(geometrySignature(second), geometrySignature(first));
});


test('brush v019 raw tableau uses a p5.js rack and wheel/keyboard encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v019/index.html');
  const sketch = await read('studies/p5-brush/v019/sketch.js');
  const style = await read('studies/p5-brush/v019/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="rack"/);
  assert.match(html, /id="turn-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-25"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /registerTurn/);
  assert.match(sketch, /wheel/);
  assert.match(sketch, /keyPressed|keydown/);
  assert.doesNotMatch(sketch, /pointerleave|pointermove/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v019 records its art gate and canonical 2026-09-25 daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v019/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v019/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v019/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-25/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525539');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /gap|counterweight/i);
  assert.match(metrics.interactionRule, /wheel|turn/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-09-25');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'brush-2026-09-25');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v019/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /wheel|gap|counterweight/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-25');
  assert.equal(work.decision.lineage, 'brush-2026-09-24');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-25"/);
});
