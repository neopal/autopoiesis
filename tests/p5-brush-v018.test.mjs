import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  registerDeparture,
  liftLatestDeparture,
  geometrySignature
} = await import('../studies/p5-brush/v018/engine.mjs');

test('brush v018 makes departure fold a continuous membrane and leaves a real aperture', () => {
  const baseline = buildFrame(6, []);
  const changed = registerDeparture(baseline, { x: 0.31, y: 0.44 });
  const restored = liftLatestDeparture(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'departure-fold');
  assert.ok(changed.aperture.depth > baseline.aperture.depth);
  assert.ok(changed.aperture.area > baseline.aperture.area);
  assert.ok(changed.backFold.load > baseline.backFold.load);
  assert.ok(changed.backFold.depth > baseline.backFold.depth);
  assert.ok(changed.surface.some((point, index) => point.y !== baseline.surface[index].y));
  assert.equal(changed.interaction, 'visitor-departure-fold');
  assert.deepEqual(restored, { ...baseline, interaction: 'departure-lifted' });
});

test('brush v018 raw tableau commits on departure rather than proximity', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v018/index.html');
  const sketch = await read('studies/p5-brush/v018/sketch.js');
  const style = await read('studies/p5-brush/v018/style.css');

  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="witness"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerDeparture/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /visitor-departure-fold/);
  assert.doesNotMatch(sketch, /pointermove[^\n]*registerDeparture/);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});

test('brush v018 is recorded as the unique 2026-09-24 daily candidate with a source inversion', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v018/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v018/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v018/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-24/index.html');
  const matches = data.works.filter((work) => work.currentId === 'brush' && work.date === '2026-09-24');
  const work = matches[0];

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.seed, '0x42525538');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /departure|fold|aperture/i);
  assert.equal(critiques.length, 5);
  assert.equal(matches.length, 1);
  assert.equal(work.id, 'brush-2026-09-24');
  assert.equal(work.rawPath, '/studies/p5-brush/v018/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /invert|departure|back/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-24');
  assert.equal(work.decision.lineage, 'brush-2026-09-23');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-24"/);
});
