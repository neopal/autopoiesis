import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v020 drying pulse fractures a helical band and deflects later material', async () => {
  const { buildFrame, dryPulse } = await import('../studies/p5-brush/v020/engine.mjs');
  const baseline = buildFrame(0, []);
  const changed = dryPulse(baseline, { direction: 1 });

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.dryBands.length, 1);
  assert.ok(changed.dryBands[0].fragmentCount >= 5);
  const driedBand = changed.bands.find((band) => band.bandIndex === changed.dryBands[0].bandIndex);
  assert.ok(driedBand.coherence < 0.5);
  assert.ok(changed.bands.some((band) => band.deflection > 0.02));
  assert.notEqual(changed.bands.map((band) => band.phase).join(','), baseline.bands.map((band) => band.phase).join(','));
  assert.equal(changed.memory[0].rule, 'dry-seam-field');
});


test('brush v020 drying pulses are bounded, deterministic, and directionally distinct', async () => {
  const { buildFrame, dryPulse } = await import('../studies/p5-brush/v020/engine.mjs');
  const baseline = buildFrame(4, []);
  const next = dryPulse(baseline, { direction: 1 });
  const repeat = dryPulse(baseline, { direction: 1 });
  const previous = dryPulse(baseline, { direction: -1 });
  const edge = dryPulse(baseline, { direction: 999 });

  assert.deepEqual(next, repeat);
  assert.equal(next.memory[0].source, 'visitor-dry-pulse');
  assert.notEqual(next.memory[0].bandIndex, previous.memory[0].bandIndex);
  assert.ok(edge.memory[0].bandIndex >= 0 && edge.memory[0].bandIndex < baseline.bands.length);
  assert.ok(next.dryBands[0].anchorAngle > 0);
  assert.ok(next.dryBands[0].fragmentSpread > 0.04);
});


test('brush v020 lifting the latest drying pulse restores the exact preceding coil', async () => {
  const { buildFrame, dryPulse, liftLatestPulse, geometrySignature } = await import('../studies/p5-brush/v020/engine.mjs');
  const baseline = buildFrame(7, []);
  const first = dryPulse(baseline, { direction: 1 });
  const second = dryPulse(first, { direction: -1 });
  const lifted = liftLatestPulse(second);

  assert.equal(second.memory.length, 2);
  assert.equal(lifted.interaction, 'pulse-lifted');
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.notEqual(geometrySignature(second), geometrySignature(first));
});


test('brush v020 raw tableau uses a WebGL drying coil and keyboard pulse encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v020/index.html');
  const sketch = await read('studies/p5-brush/v020/sketch.js');
  const style = await read('studies/p5-brush/v020/style.css');

  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="coil"/);
  assert.match(html, /id="dry-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-26"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /WEBGL/);
  assert.match(sketch, /dryPulse/);
  assert.match(sketch, /keyPressed|keydown/);
  assert.doesNotMatch(sketch, /pointermove|mouseWheel/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v020 records its art gate and canonical 2026-09-26 daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v020/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v020/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v020/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-26/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525540');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /dry|fracture|deflect/i);
  assert.match(metrics.interactionRule, /pulse|dry/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-09-26');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'brush-2026-09-26');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v020/');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.source.translatedRule, /dry|fracture|deflect/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-26');
  assert.equal(work.decision.lineage, 'brush-2026-09-25');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-26"/);
});
