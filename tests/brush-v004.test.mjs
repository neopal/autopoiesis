import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const routeDistance = (a, b) => a.reduce((sum, point, index) => (
  sum + Math.hypot(point.x - b[index].x, point.y - b[index].y)
), 0);

const strokeDifference = (a, b) => a.reduce((sum, stroke, index) => (
  sum + routeDistance(stroke.points, b[index].points) + Math.abs(stroke.weight - b[index].weight)
), 0);

test('brush v004 remembers a removal as a dry basin that drains and reconstitutes later strokes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v004/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 3);
  assert.ok(frame.basins.length >= 3);
  assert.ok(frame.strokes.some((stroke) => stroke.absorbedPigment > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.returnShift !== 0));
  assert.ok(strokeDifference(frame.strokes, withoutMemory.strokes) > 0.18);
});

test('brush v004 raw tableau is first and names a reversible dry-basin gesture', async () => {
  const html = await read('studies/p5-brush/v004/index.html');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="field"/);
  assert.match(html, /id="remove-pigment"/);
  assert.match(html, /id="lift-removal"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-04"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
});

test('brush v004 runtime binds pointer and keyboard to structural pigment memory', async () => {
  const sketch = await read('studies/p5-brush/v004/sketch.js');
  const style = await read('studies/p5-brush/v004/style.css');

  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /removeLatestRemoval/);
  assert.match(sketch, /absorbedPigment/);
  assert.match(sketch, /requestAnimationFrame/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /#field \{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('brush v004 is the unique 2026-09-04 daily record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const work = register.works.find((entry) => entry.id === 'brush-2026-09-04');
  const canonical = await read('works/brush-2026-09-04/index.html');
  const routes = await read('vercel.json');

  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-04');
  assert.equal(work.rawPath, '/studies/p5-brush/v004/');
  assert.equal(work.status, 'candidate / held');
  assert.match(canonical, /data-work-id="brush-2026-09-04"/);
  assert.match(routes, /"\/chantiers\/p5-brush\/v004\/"/);
  assert.match(routes, /"\/studies\/p5-brush\/v004\/"/);
});
