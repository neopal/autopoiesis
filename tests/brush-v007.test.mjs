import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const routeDistance = (a, b) => a.reduce((sum, point, index) => (
  sum + Math.hypot(point.x - b[index].x, point.y - b[index].y)
), 0);

const strokeDifference = (a, b) => a.reduce((sum, stroke, index) => (
  sum + routeDistance(stroke.points, b[index].points)
    + Math.abs(stroke.weight - b[index].weight)
    + Math.abs(stroke.absorptionDelta - b[index].absorptionDelta)
    + Math.abs(stroke.wakeShift - b[index].wakeShift)
), 0);

test('brush v007 turns remembered removals into shared capillary draw and release wakes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v007/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 4);
  assert.equal(frame.deltas.length, frame.memory.length);
  assert.ok(frame.strokes.some((stroke) => stroke.absorptionCount > 0));
  assert.ok(frame.strokes.some((stroke) => Math.abs(stroke.absorptionDelta) > 0.02));
  assert.ok(frame.strokes.some((stroke) => Math.abs(stroke.wakeShift) > 0.02));
  assert.ok(strokeDifference(frame.strokes, withoutMemory.strokes) > 0.35);
});

test('brush v007 lifting the latest seam reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v007/engine.mjs');
  const frame = buildTimeline()[4];
  const changed = applyRemoval(frame, { x: 0.64, y: 0.47 });
  const restored = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.equal(restored.interaction, 'capillary-lifted');
  const { interaction: _interaction, ...restoredFrame } = restored;
  assert.deepEqual(restoredFrame, frame);
});

test('brush v007 bounds a visitor seam and changes a downstream wake', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v007/engine.mjs');
  const frame = buildFrame(6, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.interaction, 'visitor-capillary');
  assert.deepEqual(changed.memory.at(-1).point, { x: 0.93, y: 0.1 });
  assert.ok(routeDistance(changed.strokes[0].points, frame.strokes[0].points) > 0.08);
  assert.ok(changed.strokes.some((stroke, index) => Math.abs(stroke.absorptionDelta - frame.strokes[index].absorptionDelta) > 0.01));
});

test('brush v007 raw tableau exposes capillary release before explanation', async () => {
  const html = await read('studies/p5-brush/v007/index.html');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="field"/);
  assert.match(html, /id="make-capillary"/);
  assert.match(html, /id="lift-capillary"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-09"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
});

test('brush v007 runtime binds input to structural capillary memory and reduced-motion state', async () => {
  const sketch = await read('studies/p5-brush/v007/sketch.js');
  const style = await read('studies/p5-brush/v007/style.css');

  assert.match(sketch, /getContext\('2d',\s*\{\s*willReadFrequently:\s*true\s*\}\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /removeLatestRemoval/);
  assert.match(sketch, /absorptionDelta/);
  assert.match(sketch, /requestAnimationFrame/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /#field \{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('brush v007 preserves its art-gate record and release-facing evidence labels', async () => {
  const readme = await read('studies/p5-brush/v007/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v007/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v007/critiques.json'));

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.memoryRule, 'a remembered removal becomes capillary draw and a shared released wake');
  assert.equal(metrics.interactionRule, 'a visitor seam changes downstream route and pigment geometry; lifting it restores the exact prior field');
  assert.ok(critiques.some((item) => item.persona === 'Perceptual critic'));
});

test('brush v007 is registered as the 2026-09-09 daily work with a canonical tableau route', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-09');
  const canonical = await read('works/brush-2026-09-09/index.html');

  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-09');
  assert.equal(work.rawPath, '/studies/p5-brush/v007/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-09');
  assert.equal(work.decision.lineage, 'brush-2026-09-08');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-09"/);
});
