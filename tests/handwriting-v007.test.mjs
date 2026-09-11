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

test('handwriting v007 turns a refusal into a shared stutter in nearby routes', async () => {
  const { buildFrame } = await import('../studies/handwriting/v007/engine.mjs');
  const baseline = buildFrame(9, []);
  const changed = buildFrame(9, [{ id: 'test-stutter', stage: 4, x: 0.43, y: 0.34, force: 1, phase: 1.7 }]);
  const affected = changed.routes.filter((route) => route.stutterSource === 'test-stutter');

  assert.ok(affected.length >= 4, `expected shared stutter, got ${affected.length} routes`);
  assert.ok(affected.every((route) => route.stutterStart < route.stutterEnd));
  assert.ok(affected.every((route) => route.repeatPeak > route.stutterStart && route.repeatPeak < route.stutterEnd));
  assert.ok(affected.every((route) => route.sharedStutter === true));
  assert.ok(routeDistance(changed.routes[4], baseline.routes[4]) > 0.035);
  assert.ok(changed.routes.some((route) => route.phaseSlip !== 0));
});

test('handwriting v007 lifting the latest stutter reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyStutter, removeLatestStutter } = await import('../studies/handwriting/v007/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyStutter(frame, { x: 0.41, y: 0.48 });
  const restored = removeLatestStutter(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v007 bounds a visitor stutter and keeps the mutation structural', async () => {
  const { buildFrame, applyStutter } = await import('../studies/handwriting/v007/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyStutter(frame, { x: 99, y: -20 });
  const stutter = changed.memory.at(-1);

  assert.equal(stutter.x, 0.94);
  assert.equal(stutter.y, 0.08);
  assert.equal(stutter.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.stutterSource === stutter.id));
  assert.ok(changed.routes.some((route) => route.phaseSlip !== 0));
  assert.ok(changed.routes.some((route) => route.repeatPeak > route.stutterStart));
});

test('handwriting v007 raw tableau puts the stutter field before explanation', async () => {
  const html = await read('studies/handwriting/v007/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-stutter"/);
  assert.match(html, /id="lift-stutter"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v007 runtime binds pointer and keyboard to shared stutter memory', async () => {
  const sketch = await read('studies/handwriting/v007/sketch.js');
  const style = await read('studies/handwriting/v007/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyStutter/);
  assert.match(sketch, /removeLatestStutter/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV007/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v007 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v007/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v007/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v007/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('stutter'));
  assert.ok(metrics.interactionRule.includes('later route'));
  assert.equal(critiques.length, 4);
});

test('handwriting v007 is the unique 2026-09-11 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-11');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-11/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-11');
  assert.equal(work.rawPath, '/studies/handwriting/v007/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-11');
  assert.match(canonical, /data-work-id="typography-2026-09-11"/);
  assert.match(routes, /"\/studies\/handwriting\/v007\/"/);
  await access(new URL('../studies/handwriting/v007/index.html', import.meta.url));
});
