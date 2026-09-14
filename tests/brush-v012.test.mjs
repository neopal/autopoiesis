import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');


test('brush v012 turns a remembered removal into a lateral wake-braid', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v012/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);
  const braided = buildFrame(frame.stage, frame.memory);

  assert.equal(frame.memory.length, 8);
  assert.ok(frame.strokes.some((stroke) => stroke.bankMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.braidMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.routeShift !== plain.strokes[stroke.index].routeShift));
  assert.ok(frame.deltas.every((delta) => delta.rule === 'wake-braid'));
  assert.ok(braided.strokes.some((stroke) => stroke.splitSeparation > 0.02));
});


test('brush v012 lifting the latest wake reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v012/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyRemoval(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.deepEqual(lifted, { ...frame, interaction: 'wake-braid-lifted' });
});


test('brush v012 visitor wake is bounded, deterministic, and structural', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v012/engine.mjs');
  const frame = buildFrame(7, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });
  const repeat = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.memory[0].point.x, 0.94);
  assert.equal(changed.memory[0].point.y, 0.08);
  assert.equal(changed.memory[0].source, 'visitor-wake');
  assert.equal(changed.memory[0].rule, 'wake-braid');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.braidMass > 0 && stroke.settleMass > 0));
});


test('brush v012 raw tableau exposes the wake-braid action before explanation', async () => {
  const html = await read('studies/p5-brush/v012/index.html');
  const sketch = await read('studies/p5-brush/v012/sketch.js');
  const style = await read('studies/p5-brush/v012/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-wake"/);
  assert.match(html, /id="lift-wake"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-14"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});


test('brush v012 records its art gate and canonical daily work', async () => {
  const readme = await read('studies/p5-brush/v012/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v012/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v012/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-14/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525532');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('wake'), true);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-14');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-14');
  assert.equal(work.rawPath, '/studies/p5-brush/v012/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-14');
  assert.equal(work.decision.lineage, 'brush-2026-09-13');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-14"/);
});
