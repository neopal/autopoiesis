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
    + Math.abs(stroke.pigmentDelta - b[index].pigmentDelta)
), 0);

test('brush v005 turns a remembered removal into a split delta that exchanges material across later strokes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v005/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 3);
  assert.equal(frame.deltas.length, frame.memory.length);
  assert.ok(frame.strokes.some((stroke) => stroke.splitCount > 0));
  assert.ok(frame.strokes.some((stroke) => Math.abs(stroke.pigmentDelta) > 0.02));
  assert.ok(strokeDifference(frame.strokes, withoutMemory.strokes) > 0.25);
});

test('brush v005 lifting the latest delta rebuilds the exact preceding frame', async () => {
  const { buildTimeline, applyRemoval, removeLatestRemoval } = await import('../studies/p5-brush/v005/engine.mjs');
  const frame = buildTimeline()[2];
  const changed = applyRemoval(frame, { x: 0.64, y: 0.47 });
  const restored = removeLatestRemoval(changed);

  assert.equal(changed.memory.length, frame.memory.length + 1);
  assert.equal(restored.interaction, 'removal-lifted');
  const { interaction: _interaction, ...restoredFrame } = restored;
  assert.deepEqual(restoredFrame, frame);
});

test('brush v005 raw tableau exposes the split-delta encounter before explanation', async () => {
  const html = await read('studies/p5-brush/v005/index.html');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="field"/);
  assert.match(html, /id="remove-pigment"/);
  assert.match(html, /id="lift-removal"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-07"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
});

test('brush v005 runtime binds input to structural delta memory and reduced-motion state', async () => {
  const sketch = await read('studies/p5-brush/v005/sketch.js');
  const style = await read('studies/p5-brush/v005/style.css');

  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /removeLatestRemoval/);
  assert.match(sketch, /pigmentDelta/);
  assert.match(sketch, /requestAnimationFrame/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /#field \{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});
