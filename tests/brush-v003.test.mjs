import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const routeDistance = (a, b) => a.reduce((sum, point, index) => (
  sum + Math.hypot(point.x - b[index].x, point.y - b[index].y)
), 0);

const strokeDistance = (a, b) => a.reduce((sum, stroke, index) => (
  sum + routeDistance(stroke.points, b[index].points)
), 0);

test('brush v003 turns a remembered cut into a dry channel that reroutes later strokes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v003/engine.mjs');
  const frame = buildTimeline().at(-1);
  const withoutMemory = buildFrame(frame.stage, []);

  assert.ok(frame.memory.length >= 3);
  assert.ok(frame.strokes.some((stroke) => stroke.channelCrossings > 0));
  assert.ok(strokeDistance(frame.strokes, withoutMemory.strokes) > 0.18);
  assert.ok(frame.channels.some((channel) => channel.reentry > 0));
});

test('brush v003 visitor cut is bounded, deterministic, and structurally reversible', async () => {
  const { applyCut, buildFrame, removeLatestCut } = await import('../studies/p5-brush/v003/engine.mjs');
  const base = buildFrame(4, []);
  const changed = applyCut(base, { x: 2, y: -1 });
  const restored = removeLatestCut(changed);

  assert.deepEqual(changed.memory.at(-1).point, { x: 0.94, y: 0.1 });
  assert.equal(changed.memory.at(-1).source, 'visitor-cut');
  assert.notDeepEqual(changed.strokes, base.strokes);
  assert.deepEqual(restored.strokes, base.strokes);
  assert.deepEqual(restored.memory, base.memory);
  assert.deepEqual(applyCut(base, { x: 2, y: -1 }), changed);
});

test('brush v003 exposes a tableau-first reversible interaction contract', async () => {
  const html = await read('studies/p5-brush/v003/index.html');
  const sketch = await read('studies/p5-brush/v003/sketch.js');
  const catalog = await read('studio/catalog.js');
  const generator = await read('scripts/generate-work-pages.mjs');
  const catalogStyle = await read('studio/catalog.css');
  const style = await read('studies/p5-brush/v003/style.css');

  assert.match(html, /data-raw-work-id="brush-2026-09-03"/);
  assert.match(html, /id="field"[^>]*style="background: #0c0c0b"/);
  assert.match(html, /id="open-cut"/);
  assert.match(html, /id="lift-cut"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /href="\.\/style\.css\?v=004"/);
  assert.match(html, /src="\.\/sketch\.js\?v=006"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(catalog, /withPreview\(work\.rawPath, \{ interaction: '1', cache: work\.id \}\)/);
  assert.match(catalogStyle, /body\.work-page\[data-current='brush'\] \.artwork-frame iframe \{\s*background: #0d0d0c;/);
  assert.match(generator, /catalog\.css\?v=004/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyCut/);
  assert.match(sketch, /removeLatestCut/);
  assert.match(sketch, /function drawChannel\(channel, index, active = false\) \{\s*if \(!channel\) return;/);
  assert.match(sketch, /context\.setTransform\(1, 0, 0, 1, 0, 0\);\s*context\.clearRect\(0, 0, canvas\.width, canvas\.height\);\s*context\.fillStyle = palette\.ground;\s*context\.fillRect\(0, 0, canvas\.width, canvas\.height\);\s*context\.setTransform\(pixelWidth, 0, 0, pixelHeight, 0, 0\);/);
  assert.match(sketch, /function drawGround\(stage\) \{[\s\S]*context\.fillStyle = palette\.ground;\s*context\.fillRect\(0, 0, 1, 1\);/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\) \|\| location\.hash\.startsWith\('#interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /#field \{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*background:\s*var\(--brush-ground-deep\)/s);
  assert.match(style, /\.field-wrap \{[^}]*isolation:\s*isolate;/s);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('brush v003 canonical aliases and current atmosphere point to the daily work', async () => {
  const routes = await read('vercel.json');
  const canonical = await read('works/brush-2026-09-03/index.html');
  const register = JSON.parse(await read('studio/data/works.json'));
  const work = register.works.find((entry) => entry.id === 'brush-2026-09-03');

  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-03');
  assert.equal(work.rawPath, '/studies/p5-brush/v003/');
  assert.equal(work.lifecycle, 'active');
  assert.match(routes, /"\/works\/brush-2026-09-03\/"/);
  assert.match(routes, /"\/studies\/p5-brush\/v003\/"/);
  assert.match(canonical, /data-current="brush"/);
  assert.match(canonical, /data-work-id="brush-2026-09-03"/);
});
