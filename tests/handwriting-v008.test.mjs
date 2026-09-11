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

test('handwriting v008 turns a refusal into a staggered relay across routes', async () => {
  const { buildFrame } = await import('../studies/handwriting/v008/engine.mjs');
  const baseline = buildFrame(8, []);
  const changed = buildFrame(8, [{ id: 'test-relay', stage: 5, x: 0.46, y: 0.43, force: 1, phase: 2.1 }]);
  const affected = changed.routes.filter((route) => route.relaySource === 'test-relay');
  const relayStarts = affected.map((route) => route.relayStart);

  assert.ok(affected.length >= 5, `expected relay across routes, got ${affected.length}`);
  assert.ok(new Set(relayStarts).size >= 3, 'relay must arrive at staggered points');
  assert.ok(affected.every((route) => route.relayEnd > route.relayStart));
  assert.ok(affected.every((route) => route.handoff === true));
  assert.ok(routeDistance(changed.routes[6], baseline.routes[6]) > 0.035);
  assert.ok(changed.routes.some((route) => route.afterCadence !== 0));
});

test('handwriting v008 lifting the latest relay reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyRelay, removeLatestRelay } = await import('../studies/handwriting/v008/engine.mjs');
  const frame = buildTimeline()[6];
  const changed = applyRelay(frame, { x: 0.41, y: 0.48 });
  const restored = removeLatestRelay(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v008 bounds a visitor relay and keeps the handoff structural', async () => {
  const { buildFrame, applyRelay } = await import('../studies/handwriting/v008/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyRelay(frame, { x: 99, y: -20 });
  const relay = changed.memory.at(-1);

  assert.equal(relay.x, 0.94);
  assert.equal(relay.y, 0.08);
  assert.equal(relay.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.relaySource === relay.id));
  assert.ok(changed.routes.some((route) => route.afterCadence !== 0));
  assert.ok(changed.routes.some((route) => route.handoffIndex > route.relayStart));
});

test('handwriting v008 raw tableau puts the relay field before explanation', async () => {
  const html = await read('studies/handwriting/v008/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-relay"/);
  assert.match(html, /id="lift-relay"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v008 runtime binds pointer and keyboard to relay memory', async () => {
  const sketch = await read('studies/handwriting/v008/sketch.js');
  const style = await read('studies/handwriting/v008/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyRelay/);
  assert.match(sketch, /removeLatestRelay/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV008/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v008 records the art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v008/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v008/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v008/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('relay'));
  assert.ok(metrics.interactionRule.includes('handoff'));
  assert.equal(critiques.length, 4);
});

test('handwriting v008 is the unique 2026-09-12 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-12');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-12/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-12');
  assert.equal(work.rawPath, '/studies/handwriting/v008/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-12');
  assert.match(canonical, /data-work-id="typography-2026-09-12"/);
  assert.match(routes, /"\/studies\/handwriting\/v008\/"/);
  await access(new URL('../studies/handwriting/v008/index.html', import.meta.url));
});
