import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  applyEncounter,
  removeLatestEncounter,
  geometrySignature
} = await import('../studies/p5-brush/v017/engine.mjs');

test('brush v017 turns proximity into a material transfer with a real vacancy', () => {
  const baseline = buildFrame(7, []);
  const changed = applyEncounter(baseline, { x: 0.28, y: 0.42 });
  const restored = removeLatestEncounter(changed);
  const source = changed.islands[changed.memory[0].sourceIndex];
  const receiver = changed.islands[changed.memory[0].receiverIndex];
  const vacancy = changed.islands[changed.memory[0].vacancyIndex];

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'proximity-transfer');
  assert.ok(source.mass < baseline.islands[changed.memory[0].sourceIndex].mass);
  assert.ok(receiver.mass > baseline.islands[changed.memory[0].receiverIndex].mass);
  assert.ok(vacancy.porosity > baseline.islands[changed.memory[0].vacancyIndex].porosity);
  assert.ok(changed.transferMass > baseline.transferMass);
  assert.ok(changed.vacancies >= 1);
  assert.deepEqual(restored, { ...baseline, interaction: 'encounter-lifted' });
});

test('brush v017 raw tableau exposes proximity as the primary material action', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v017/index.html');
  const sketch = await read('studies/p5-brush/v017/sketch.js');
  const style = await read('studies/p5-brush/v017/style.css');

  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="encounter"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /applyEncounter/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /visitor-proximity-transfer/);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});

test('brush v017 is recorded as the unique 2026-09-23 daily candidate with a source translation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v017/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v017/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v017/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-23/index.html');
  const matches = data.works.filter((work) => work.currentId === 'brush' && work.date === '2026-09-23');
  const work = matches[0];

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.seed, '0x42525537');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /transfer|vacancy/i);
  assert.equal(critiques.length, 5);
  assert.equal(matches.length, 1);
  assert.equal(work.id, 'brush-2026-09-23');
  assert.equal(work.rawPath, '/studies/p5-brush/v017/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-23');
  assert.equal(work.decision.lineage, 'brush-2026-09-22');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-23"/);
});
