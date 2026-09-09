import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function routeDistance(a, b) {
  return a.points.reduce((sum, point, index) => {
    const other = b.points[index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

test('handwriting v006 turns a refusal into a shared counterform aperture', async () => {
  const { buildFrame } = await import('../studies/handwriting/v006/engine.mjs');
  const baseline = buildFrame(9, []);
  const changed = buildFrame(9, [{ id: 'test-gap', stage: 4, x: 0.47, y: 0.36, force: 1, phase: 1.7 }]);
  const affected = changed.routes.filter((route) => route.gapSource === 'test-gap');

  assert.ok(affected.length >= 3, `expected shared aperture, got ${affected.length} routes`);
  assert.ok(affected.every((route) => route.gapStart < route.gapEnd));
  assert.ok(affected.every((route) => route.sharedGate === true));
  assert.ok(routeDistance(changed.routes[4], baseline.routes[4]) > 0.035);
  assert.ok(changed.routes.some((route) => route.rejoinStep >= 14));
});

test('handwriting v006 lifting the latest gap reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyGap, removeLatestGap } = await import('../studies/handwriting/v006/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyGap(frame, { x: 0.41, y: 0.48 });
  const restored = removeLatestGap(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v006 bounds a visitor gap and keeps the mutation structural', async () => {
  const { buildFrame, applyGap } = await import('../studies/handwriting/v006/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyGap(frame, { x: 99, y: -20 });
  const gap = changed.memory.at(-1);

  assert.equal(gap.x, 0.94);
  assert.equal(gap.y, 0.08);
  assert.equal(gap.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.gapSource === gap.id));
  assert.ok(changed.routes.some((route) => route.exitShift !== 0));
});

test('handwriting v006 raw tableau puts the counterform field before explanation', async () => {
  const html = await read('studies/handwriting/v006/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-gap"/);
  assert.match(html, /id="lift-gap"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v006 runtime binds pointer and keyboard to counterform memory', async () => {
  const sketch = await read('studies/handwriting/v006/sketch.js');
  const style = await read('studies/handwriting/v006/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyGap/);
  assert.match(sketch, /removeLatestGap/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV006/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v006 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v006/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v006/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v006/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('counterform'));
  assert.ok(metrics.interactionRule.includes('later route'));
  assert.equal(critiques.length, 4);
});

test('handwriting v006 is the unique 2026-09-10 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-10');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-10/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-10');
  assert.equal(work.rawPath, '/studies/handwriting/v006/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-10');
  assert.match(canonical, /data-work-id="typography-2026-09-10"/);
  assert.match(routes, /"\/studies\/handwriting\/v006\/"/);
  await access(new URL('../studies/handwriting/v006/index.html', import.meta.url));
});
