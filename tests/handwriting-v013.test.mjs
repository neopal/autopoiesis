import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function routeDistance(a, b) {
  return a.points.reduce((sum, point, index) => {
    const other = b.points[index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

test('handwriting v013 turns a chorus into a structural cadence relay', async () => {
  const { buildFrame, constants } = await import('../studies/handwriting/v013/engine.mjs');
  const frame = buildFrame(7, []);
  const changed = buildFrame(7, [{ id: 'test-cadence', stage: 7, x: 0.56, y: 0.42, force: 1, phase: 2.4 }]);
  const relayed = changed.routes.filter((route) => route.cadenceHistory.length > 0);

  assert.equal(constants.routeCount, 24);
  assert.ok(relayed.length >= 3, `expected a route family to relay cadence, got ${relayed.length}`);
  assert.ok(routeDistance(changed.routes[8], frame.routes[8]) > 0.02);
  assert.ok(relayed.some((route) => route.cadenceHistory.some((record) => record.handoffStep > record.phraseEnd && record.relayEnd > record.relayStart)));
  assert.ok(relayed.some((route) => route.cadenceHistory.some((record) => record.cadenceShift > 0.004)));
});

test('handwriting v013 lifting the latest cadence reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyCadence, removeLatestCadence } = await import('../studies/handwriting/v013/engine.mjs');
  const frame = buildTimeline()[7];
  const changed = applyCadence(frame, { x: 0.42, y: 0.48 });
  const restored = removeLatestCadence(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v013 bounds visitor cadence and keeps the effect structural', async () => {
  const { buildFrame, applyCadence } = await import('../studies/handwriting/v013/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyCadence(frame, { x: 99, y: -20 });
  const cadence = changed.memory.at(-1);

  assert.equal(cadence.x, 0.93);
  assert.equal(cadence.y, 0.105);
  assert.equal(cadence.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.cadenceHistory.length > 0));
});

test('handwriting v013 raw tableau places cadence field before its explanation', async () => {
  const html = await read('studies/handwriting/v013/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-cadence"/);
  assert.match(html, /id="lift-cadence"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v013 runtime binds pointer and keyboard to cadence memory', async () => {
  const sketch = await read('studies/handwriting/v013/sketch.js');
  const style = await read('studies/handwriting/v013/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyCadence/);
  assert.match(sketch, /removeLatestCadence/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV013/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v013 records its art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v013/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v013/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v013/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('cadence'));
  assert.ok(metrics.interactionRule.includes('later route'));
  assert.equal(critiques.length, 4);
});

test('handwriting v013 is the unique 2026-09-17 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-17');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-17/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-17');
  assert.equal(work.rawPath, '/studies/handwriting/v013/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-17');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-17"/);
  assert.match(routes, /"\/studies\/handwriting\/v013\/"/);
});
