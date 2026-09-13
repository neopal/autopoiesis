import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');


test('brush v011 turns a remembered removal into a capillary siphon-release route', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v011/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);
  const siphoned = buildFrame(frame.stage, frame.memory);

  assert.equal(frame.memory.length, 9);
  assert.ok(frame.strokes.some((stroke) => stroke.siphonMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.releaseMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.routeShift !== plain.strokes[stroke.index].routeShift));
  assert.ok(frame.deltas.every((delta) => delta.rule === 'siphon-release'));
  assert.ok(siphoned.strokes.some((stroke) => stroke.throatConvergence < 0.08));
});


test('brush v011 lifting the latest siphon reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v011/engine.mjs');
  const frame = buildTimeline()[7];
  const changed = applyRemoval(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.deepEqual(lifted, { ...frame, interaction: 'siphon-release-lifted' });
});


test('brush v011 visitor siphon is bounded, deterministic, and structural', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v011/engine.mjs');
  const frame = buildFrame(8, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });
  const repeat = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.memory[0].point.x, 0.94);
  assert.equal(changed.memory[0].point.y, 0.08);
  assert.equal(changed.memory[0].source, 'visitor-siphon');
  assert.equal(changed.memory[0].rule, 'siphon-release');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.siphonMass > 0 && stroke.releaseMass > 0));
});


test('brush v011 raw tableau exposes the siphon-release action before explanation', async () => {
  const html = await read('studies/p5-brush/v011/index.html');
  const sketch = await read('studies/p5-brush/v011/sketch.js');
  const style = await read('studies/p5-brush/v011/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-siphon"/);
  assert.match(html, /id="lift-siphon"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-13"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});


test('brush v011 records its art gate and canonical daily work', async () => {
  const readme = await read('studies/p5-brush/v011/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v011/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v011/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-13/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525531');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('siphon'), true);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-13');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-13');
  assert.equal(work.rawPath, '/studies/p5-brush/v011/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-13');
  assert.equal(work.decision.lineage, 'brush-2026-09-12');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-13"/);
});
