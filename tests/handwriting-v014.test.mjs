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

test('handwriting v014 turns a cadence relay into a delayed counterphrase', async () => {
  const { buildFrame, constants } = await import('../studies/handwriting/v014/engine.mjs');
  const frame = buildFrame(8, []);
  const changed = buildFrame(8, [{ id: 'test-return', stage: 8, x: 0.56, y: 0.42, force: 1, phase: 2.4 }]);
  const answered = changed.routes.filter((route) => route.counterphraseHistory.length > 0);

  assert.equal(constants.routeCount, 24);
  assert.ok(answered.length >= 3, `expected a route family to answer, got ${answered.length}`);
  assert.ok(routeDistance(changed.routes[8], frame.routes[8]) > 0.02);
  assert.ok(answered.some((route) => route.counterphraseHistory.some((record) => record.replyStart > record.relayEnd)));
  assert.ok(answered.some((route) => route.counterphraseHistory.some((record) => record.counterShift > 0.004)));
});

test('handwriting v014 lifting the latest return reconstructs the exact preceding frame', async () => {
  const { buildTimeline, applyReturn, removeLatestReturn } = await import('../studies/handwriting/v014/engine.mjs');
  const frame = buildTimeline()[8];
  const changed = applyReturn(frame, { x: 0.42, y: 0.48 });
  const restored = removeLatestReturn(changed);

  assert.notDeepEqual(changed.routes, frame.routes);
  assert.deepEqual(restored.routes, frame.routes);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v014 bounds visitor return and keeps the answer structural', async () => {
  const { buildFrame, applyReturn } = await import('../studies/handwriting/v014/engine.mjs');
  const frame = buildFrame(5, []);
  const changed = applyReturn(frame, { x: 99, y: -20 });
  const event = changed.memory.at(-1);

  assert.equal(event.x, 0.93);
  assert.equal(event.y, 0.105);
  assert.equal(event.stage, frame.stage);
  assert.ok(changed.routes.some((route) => route.counterphraseHistory.length > 0));
});

test('handwriting v014 raw tableau places the answer field before its explanation', async () => {
  const html = await read('studies/handwriting/v014/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<canvas id="piece"/);
  assert.match(html, /id="place-return"/);
  assert.match(html, /id="lift-return"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v014 runtime binds pointer and keyboard to return memory', async () => {
  const sketch = await read('studies/handwriting/v014/sketch.js');
  const style = await read('studies/handwriting/v014/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyReturn/);
  assert.match(sketch, /removeLatestReturn/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV014/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v014 records its art gate and release evidence boundary', async () => {
  const readme = await read('studies/handwriting/v014/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v014/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v014/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('counterphrase'));
  assert.ok(metrics.interactionRule.includes('later route'));
  assert.equal(critiques.length, 4);
});

test('handwriting v014 is the unique 2026-09-18 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-18');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-18/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-18');
  assert.equal(work.rawPath, '/studies/handwriting/v014/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-18');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-18"/);
  assert.match(routes, /"\/studies\/handwriting\/v014\/"/);
});
