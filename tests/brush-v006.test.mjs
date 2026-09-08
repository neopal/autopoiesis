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
    + Math.abs(stroke.returnShift - b[index].returnShift)
), 0);

test('brush v006 turns remembered removals into shared delayed return routes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v006/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 4);
  assert.equal(frame.deltas.length, frame.memory.length);
  assert.ok(frame.strokes.some((stroke) => stroke.returnCount > 0));
  assert.ok(frame.strokes.some((stroke) => Math.abs(stroke.returnShift) > 0.02));
  assert.ok(strokeDifference(frame.strokes, withoutMemory.strokes) > 0.3);
});

test('brush v006 lifting the latest seam reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v006/engine.mjs');
  const frame = buildTimeline()[3];
  const changed = applyRemoval(frame, { x: 0.64, y: 0.47 });
  const restored = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.equal(restored.interaction, 'seam-lifted');
  const { interaction: _interaction, ...restoredFrame } = restored;
  assert.deepEqual(restoredFrame, frame);
});

test('brush v006 bounds a visitor seam and changes a later route', async () => {
  const { buildFrame, applyRemoval } = await import('../studies/p5-brush/v006/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyRemoval(frame, { x: 99, y: -20 });

  assert.equal(changed.interaction, 'visitor-seam');
  assert.deepEqual(changed.memory.at(-1).point, { x: 0.93, y: 0.1 });
  assert.ok(routeDistance(changed.strokes[0].points, frame.strokes[0].points) > 0.08);
});

test('brush v006 raw tableau exposes the return-seam encounter before explanation', async () => {
  const html = await read('studies/p5-brush/v006/index.html');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="field"/);
  assert.match(html, /id="remove-pigment"/);
  assert.match(html, /id="lift-removal"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-08"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
});

test('brush v006 runtime binds input to structural return memory and reduced-motion state', async () => {
  const sketch = await read('studies/p5-brush/v006/sketch.js');
  const style = await read('studies/p5-brush/v006/style.css');

  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /removeLatestRemoval/);
  assert.match(sketch, /returnShift/);
  assert.match(sketch, /requestAnimationFrame/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /#field \{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('brush v006 preserves its art-gate record and release-facing evidence labels', async () => {
  const readme = await read('studies/p5-brush/v006/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v006/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v006/critiques.json'));

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.memoryRule, 'a remembered removal becomes a delayed return seam shared by later wet strokes');
  assert.equal(metrics.interactionRule, 'a visitor seam changes downstream route geometry; lifting it restores the exact prior field');
  assert.ok(critiques.some((item) => item.persona === 'Perceptual critic'));
});
