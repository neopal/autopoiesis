import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  STAGES,
  MEMORY_WINDOW,
  applySwitch,
  buildFrame,
  buildTimeline,
  deleteLatestSwitch
} = await import('../studies/handwriting/v009/engine.mjs');

function routeDistance(a, b) {
  return a.points.reduce((sum, point, index) => {
    const other = b.points[index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

test('handwriting v009 turns a refusal into a reversible lane switch', () => {
  const baseline = buildFrame(8, []);
  const changed = applySwitch(baseline, { x: 0.52, y: 0.42 });
  const restored = deleteLatestSwitch(changed);
  const switched = changed.routes.filter((route) => route.switchSource === changed.memory.at(-1).id);

  assert.ok(switched.length >= 2, 'a switch must affect neighbouring routes');
  assert.ok(switched.every((route) => route.switchEnd > route.switchStart));
  assert.ok(switched.some((route) => route.reordered === true));
  assert.ok(switched.some((route) => route.crossingPair));
  assert.ok(routeDistance(changed.routes[0], baseline.routes[0]) >= 0);
  assert.notDeepEqual(changed.routes, baseline.routes);
  assert.deepEqual(restored.routes, baseline.routes, 'lifting the switch must restore the exact prior sentence');
  assert.deepEqual(restored.memory, baseline.memory);
});

test('handwriting v009 records an actual bounded order reversal', () => {
  const changed = buildFrame(8, [{ id: 'crossing', stage: 4, x: 0.5, y: 0.42, force: 1, phase: 1.4 }]);
  const switched = changed.routes.filter((route) => route.switchSource === 'crossing');

  assert.equal(switched.length, 2);
  assert.ok(switched.every((route) => route.crossingIndex >= route.switchStart));
  assert.ok(switched.every((route) => route.crossingIndex <= route.switchEnd));
  assert.ok(switched.every((route) => route.orderBefore * route.orderAfter < 0));
  assert.equal(new Set(switched.map((route) => route.crossingIndex)).size, 1);
});

test('handwriting v009 bounds visitor switches, keeps finite memory, and replays deterministically', () => {
  const frame = buildFrame(5, []);
  const first = applySwitch(frame, { x: 99, y: -20 });
  const repeated = applySwitch(frame, { x: 99, y: -20 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.12 });
  assert.equal(first.memory.at(-1).source, 'visitor-switch');
  assert.deepEqual(first, repeated);

  let current = frame;
  for (let index = 0; index < MEMORY_WINDOW + 2; index += 1) {
    current = applySwitch(current, { x: 0.16 + index * 0.1, y: 0.3 + (index % 3) * 0.12 });
  }
  assert.equal(current.memory.length, MEMORY_WINDOW);
});

test('handwriting v009 timeline accumulates a finite archive of switches', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.switches.length, MEMORY_WINDOW);
  assert.ok(settled.routes.filter((route) => route.reordered).length >= 2);
  assert.ok(timeline.some((frame) => frame.newSwitches.length === 1));
  assert.deepEqual(settled.switches.map((event) => event.memoryIndex), [0, 1, 2, 3, 4]);
});

test('handwriting v009 raw tableau is first, preview-safe, and exposes reversible switching', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/handwriting/v009/index.html', import.meta.url), 'utf8');

  assert.match(html, /data-raw-work-id="typography-2026-09-13"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<figure[^>]+data-frame="artwork-frame"/);
  assert.match(html, /<canvas[^>]+id="piece"/);
  assert.match(html, /data-gesture="switch"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /lane switch|exchange order|cross/i);
  assert.ok(html.indexOf('<figure') < html.indexOf('id="work-title"'));
});

test('handwriting v009 runtime binds pointer and keyboard to structural switch memory', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v009/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/handwriting/v009/style.css', import.meta.url), 'utf8');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applySwitch/);
  assert.match(sketch, /deleteLatestSwitch/);
  assert.match(sketch, /function drawCrossingWitness/);
  assert.match(sketch, /__mutineHandwritingV009/);
  assert.match(style, /preview-mode/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /min-height: 44px/);
});

test('handwriting v009 records the art gate and independent review boundary', async () => {
  const { readFile } = await import('node:fs/promises');
  const readme = await readFile(new URL('../studies/handwriting/v009/README.md', import.meta.url), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('../studies/handwriting/v009/metrics.json', import.meta.url), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('../studies/handwriting/v009/critiques.json', import.meta.url), 'utf8'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('switch'));
  assert.ok(metrics.interactionRule.includes('order'));
  assert.equal(critiques.length, 4);
});

test('handwriting v009 is the unique 2026-09-13 typography work with canonical lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-13');
  const work = matches[0];
  const canonical = await readFile(new URL('works/typography-2026-09-13/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'typography-2026-09-13');
  assert.equal(work.rawPath, '/studies/handwriting/v009/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-13');
  assert.equal(work.decision.lineage, 'typography-2026-09-12');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-13"/);
});
