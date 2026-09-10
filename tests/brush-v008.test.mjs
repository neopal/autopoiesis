import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('brush v008 turns a remembered removal into a lateral pigment exchange across neighboring strokes', async () => {
  const { buildFrame, buildTimeline, applyRemoval } = await import('../studies/p5-brush/v008/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);
  const exchanged = buildFrame(frame.stage, frame.memory);

  assert.equal(frame.memory.length, 7);
  assert.ok(frame.strokes.some((stroke) => stroke.transferCount > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.transferDelta > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.transferDelta < 0));
  assert.ok(exchanged.strokes.some((stroke, index) => stroke.routeShift !== withoutMemory.strokes[index].routeShift));
  assert.ok(exchanged.deltas.every((delta) => delta.exchange === true));
});

test('brush v008 lifting the latest membrane reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v008/engine.mjs');
  const frame = buildTimeline()[5];
  const changed = applyRemoval(frame, { x: 0.67, y: 0.48 });
  const lifted = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.deepEqual(lifted, { ...frame, interaction: 'membrane-lifted' });
});

test('brush v008 visitor membrane is bounded, deterministic, and changes a neighboring transfer pair', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v008/engine.mjs');
  const frame = buildFrame(6, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });
  const repeat = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.memory[0].point.x, 0.93);
  assert.equal(changed.memory[0].point.y, 0.1);
  assert.equal(changed.memory[0].source, 'visitor-membrane');
  assert.equal(changed.memory[0].exchange, true);
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.transferCount >= 2));
});

test('brush v008 raw tableau exposes the membrane exchange before explanation', async () => {
  const html = await read('studies/p5-brush/v008/index.html');
  const sketch = await read('studies/p5-brush/v008/sketch.js');
  const style = await read('studies/p5-brush/v008/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-membrane"/);
  assert.match(html, /id="lift-membrane"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-10"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});

test('brush v008 keeps canvas notation out of the reversible artwork state', async () => {
  const sketch = await read('studies/p5-brush/v008/sketch.js');

  assert.doesNotMatch(sketch, /state === 'sequence' \?/);
  assert.match(sketch, /MATTER \/ POROUS EXCHANGE/);
});

test('brush v008 preserves its art-gate record and registers the canonical daily work', async () => {
  const readme = await read('studies/p5-brush/v008/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v008/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v008/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-10');
  const canonical = await read('works/brush-2026-09-10/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525538');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('exchange'), true);
  assert.equal(critiques.length, 4);
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-10');
  assert.equal(work.rawPath, '/studies/p5-brush/v008/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-10');
  assert.equal(work.decision.lineage, 'brush-2026-09-09');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-10"/);
});
