import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function routeDistance(a, b) {
  return a.points.reduce((sum, point, index) => {
    const other = b.points[index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

test('handwriting v005 turns a remembered refusal into a shared borrowed-baseline migration', async () => {
  const { buildFrame } = await import('../studies/handwriting/v005/engine.mjs');
  const frame = buildFrame(8, []);
  const refusal = { id: 'test-refusal', stage: 4, route: 4, x: 0.35, y: 0.36, force: 1 };
  const changed = buildFrame(8, [refusal]);

  const affected = changed.routes.filter((route) => route.borrowed).length;
  assert.ok(affected >= 2, `expected a shared migration, got ${affected} affected routes`);
  assert.ok(routeDistance(changed.routes[4], frame.routes[4]) > 0.08);
  assert.ok(routeDistance(changed.routes[5], frame.routes[5]) > 0.04);
  assert.ok(changed.routes.some((route) => route.rejoinStep >= 7));
});

test('handwriting v005 lifting the latest refusal reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRefusal, removeLatestRefusal } = await import('../studies/handwriting/v005/engine.mjs');
  const frame = buildTimeline()[5];
  const changed = applyRefusal(frame, { x: 0.42, y: 0.48 });
  const restored = removeLatestRefusal(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v005 bounds a visitor refusal and keeps the field structural', async () => {
  const { buildFrame, applyRefusal } = await import('../studies/handwriting/v005/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyRefusal(frame, { x: 99, y: -20 });
  const refusal = changed.memory.at(-1);

  assert.equal(refusal.x, 0.94);
  assert.equal(refusal.y, 0.08);
  assert.equal(refusal.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.borrowed));
});

test('handwriting v005 raw tableau puts the route field before explanation', async () => {
  const html = await read('studies/handwriting/v005/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-refusal"/);
  assert.match(html, /id="lift-memory"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v005 runtime binds pointer and keyboard to borrowed-baseline memory', async () => {
  const sketch = await read('studies/handwriting/v005/sketch.js');
  const style = await read('studies/handwriting/v005/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRefusal/);
  assert.match(sketch, /removeLatestRefusal/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV005/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v005 records its art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v005/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v005/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v005/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('borrowed baseline'));
  assert.ok(metrics.interactionRule.includes('later route'));
  assert.equal(critiques.length, 4);
});

test('handwriting v005 is the unique 2026-09-09 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-09');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-09/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-09');
  assert.equal(work.rawPath, '/studies/handwriting/v005/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-09');
  assert.match(canonical, /data-work-id="typography-2026-09-09"/);
  assert.match(routes, /"\/studies\/handwriting\/v005\/"/);
});
