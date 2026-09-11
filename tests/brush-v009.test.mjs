import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('brush v009 turns a remembered removal into a split-and-settle braid', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v009/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);
  const settled = buildFrame(frame.stage, frame.memory);

  assert.equal(frame.memory.length, 8);
  assert.ok(frame.strokes.some((stroke) => stroke.splitAmplitude > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.settleMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.routeShift !== withoutMemory.strokes[stroke.index ?? 0]?.routeShift));
  assert.ok(frame.deltas.every((delta) => delta.rule === 'split-settle'));
  assert.ok(settled.strokes.some((stroke) => stroke.rejoinError < 0.08));
});

test('brush v009 lifting the latest braid gate reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v009/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyRemoval(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.deepEqual(lifted, { ...frame, interaction: 'braid-gate-lifted' });
});

test('brush v009 visitor gate is bounded, deterministic, and structural', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v009/engine.mjs');
  const frame = buildFrame(7, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });
  const repeat = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.memory[0].point.x, 0.94);
  assert.equal(changed.memory[0].point.y, 0.09);
  assert.equal(changed.memory[0].source, 'visitor-braid-gate');
  assert.equal(changed.memory[0].rule, 'split-settle');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.splitAmplitude > 0 && stroke.settleMass > 0));
});

test('brush v009 raw tableau exposes the split-settle field before explanation', async () => {
  const html = await read('studies/p5-brush/v009/index.html');
  const sketch = await read('studies/p5-brush/v009/sketch.js');
  const style = await read('studies/p5-brush/v009/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-braid-gate"/);
  assert.match(html, /id="lift-braid-gate"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-11"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});

test('brush v009 keeps witness notation out of the reversible artwork state', async () => {
  const sketch = await read('studies/p5-brush/v009/sketch.js');

  assert.doesNotMatch(sketch, /state === 'sequence' \?/);
  assert.match(sketch, /MATTER \/ SPLIT-SETTLE BRAID/);
});

test('brush v009 preserves its art-gate record and registers the canonical daily work', async () => {
  const readme = await read('studies/p5-brush/v009/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v009/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v009/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-11');
  const canonical = await read('works/brush-2026-09-11/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525539');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('split'), true);
  assert.equal(critiques.length, 4);
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-11');
  assert.equal(work.rawPath, '/studies/p5-brush/v009/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-11');
  assert.equal(work.decision.lineage, 'brush-2026-09-10');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-11"/);
});
