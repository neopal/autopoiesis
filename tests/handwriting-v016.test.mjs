import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function geometryDelta(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.scale - b.scale) + Math.abs(a.mouth - b.mouth);
}

test('handwriting v016 translates pressure into a material reroute, not a cosmetic mark', async () => {
  const { buildFrame, applyPressure, constants } = await import('../studies/handwriting/v016/engine.mjs');
  const frame = buildFrame(0, []);
  const changed = applyPressure(frame, { startX: 0.22, startY: 0.52, endX: 0.67, endY: 0.37 });

  assert.equal(constants.reservoirCount, 12);
  assert.equal(changed.accepted, true);
  assert.ok(changed.breaks.length >= 1, 'pressure should open a real break in the chain');
  assert.ok(changed.redirects.length >= 1, 'pressure should install a downstream reroute');
  assert.ok(changed.reservoirs.some((reservoir, index) => geometryDelta(reservoir, frame.reservoirs[index]) > 0.045));
  assert.ok(changed.bridges.some((bridge) => bridge.kind === 'overflow'));
});

test('handwriting v016 rejects a short press and bounds a long pressure path', async () => {
  const { buildFrame, applyPressure } = await import('../studies/handwriting/v016/engine.mjs');
  const frame = buildFrame(4, []);
  const rejected = applyPressure(frame, { startX: 0.4, startY: 0.4, endX: 0.401, endY: 0.401 });
  const bounded = applyPressure(frame, { startX: -3, startY: 9, endX: 8, endY: -4 });

  assert.equal(rejected.accepted, false);
  assert.deepEqual(rejected.reservoirs, frame.reservoirs);
  assert.equal(bounded.accepted, true);
  assert.equal(bounded.memory.at(-1).startX, 0.08);
  assert.equal(bounded.memory.at(-1).startY, 0.88);
  assert.equal(bounded.memory.at(-1).endX, 0.92);
  assert.equal(bounded.memory.at(-1).endY, 0.12);
});

test('handwriting v016 lifting the latest pressure reconstructs the exact preceding material sentence', async () => {
  const { buildTimeline, applyPressure, removeLatestPressure } = await import('../studies/handwriting/v016/engine.mjs');
  const frame = buildTimeline()[5];
  const changed = applyPressure(frame, { startX: 0.31, startY: 0.48, endX: 0.73, endY: 0.64 });
  const restored = removeLatestPressure(changed);

  assert.notDeepEqual(changed.reservoirs, frame.reservoirs);
  assert.deepEqual(restored.reservoirs, frame.reservoirs);
  assert.deepEqual(restored.bridges, frame.bridges);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v016 raw tableau leads with an SVG material route before explanation', async () => {
  const html = await read('studies/handwriting/v016/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /<svg id="piece"/);
  assert.match(html, /id="press-mark"/);
  assert.match(html, /id="lift-pressure"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v016 runtime binds a meaningful drag and keyboard to pressure memory', async () => {
  const sketch = await read('studies/handwriting/v016/sketch.js');
  const style = await read('studies/handwriting/v016/style.css');

  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /removeLatestPressure/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV016/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v016 records its material art gate and cultural translation', async () => {
  const readme = await read('studies/handwriting/v016/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v016/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v016/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic SVG DOM');
  assert.ok(metrics.memoryRule.includes('pressure'));
  assert.ok(metrics.interactionRule.includes('drag'));
  assert.equal(critiques.length, 5);
});

test('handwriting v016 is the unique 2026-09-26 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-26');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-26/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-26');
  assert.equal(work.rawPath, '/studies/handwriting/v016/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-26');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-26"/);
  assert.match(routes, /"\/studies\/handwriting\/v016\/"/);
});
