import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';


test('brush v013 turns a remembered removal into a structural dry seam', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v013/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);

  assert.equal(frame.memory.length, 9);
  assert.ok(frame.strokes.some((stroke) => stroke.approachMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.bridgeMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.returnMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.routeShift !== plain.strokes[stroke.index].routeShift));
  assert.ok(frame.strokes.some((stroke) => stroke.dryGap > 0.01));
});


test('brush v013 lifting the latest dry seam reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v013/engine.mjs');
  const frame = buildTimeline()[7];
  const changed = applyRemoval(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.ok(changed.strokes.some((stroke) => stroke.reentryShift > 0.01));
  assert.deepEqual(lifted, { ...frame, interaction: 'dry-seam-lifted' });
});


test('brush v013 visitor seams are bounded, deterministic, and materially visible', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v013/engine.mjs');
  const frame = buildFrame(8, []);
  const edge = applyRemoval(frame, { x: 99, y: -20 });
  const changed = applyRemoval(frame, { x: 0.71, y: 0.44 });
  const repeat = applyRemoval(frame, { x: 0.71, y: 0.44 });

  assert.equal(edge.memory[0].point.x, 0.94);
  assert.equal(edge.memory[0].point.y, 0.08);
  assert.equal(changed.memory[0].source, 'visitor-dry-seam');
  assert.equal(changed.memory[0].rule, 'dry-seam');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.gapWidth > 0.03 && stroke.reentryShift > 0.03));
});


test('brush v013 raw tableau exposes the dry-seam action before explanation', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v013/index.html');
  const sketch = await read('studies/p5-brush/v013/sketch.js');
  const style = await read('studies/p5-brush/v013/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-seam"/);
  assert.match(html, /id="lift-seam"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-15"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.doesNotMatch(sketch, /trace\(stroke\.points/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});


test('brush v013 records its art gate and canonical daily work', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const readme = await read('studies/p5-brush/v013/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v013/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v013/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-15/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525533');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('seam'), true);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-15');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-15');
  assert.equal(work.rawPath, '/studies/p5-brush/v013/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-15');
  assert.equal(work.decision.lineage, 'brush-2026-09-14');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-15"/);
});
