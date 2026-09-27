import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function tileDelta(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.rotation - b.rotation) + Math.abs(a.scale - b.scale);
}

test('handwriting v017 replaces route reservoirs with a pressed typographic setting', async () => {
  const { buildFrame, applyImpression, constants } = await import('../studies/handwriting/v017/engine.mjs');
  const frame = buildFrame(0, []);
  const changed = applyImpression(frame, { x: 0.34, y: 0.28 });

  assert.equal(constants.tileCount, 24);
  assert.equal(constants.columns, 6);
  assert.equal(changed.accepted, true);
  assert.equal(changed.impressions.length, 1);
  assert.ok(changed.shelves.some((shelf) => shelf.locked), 'the press should lock a typographic shelf');
  assert.ok(changed.vacancies.length >= 1, 'the press should leave a real blank slot');
  assert.ok(changed.tiles.some((tile, index) => tileDelta(tile, frame.tiles[index]) > 0.06));
  assert.ok(changed.tiles.some((tile) => tile.state === 'impressed'));
});

test('handwriting v017 is a bounded tap, not a drag gesture', async () => {
  const { buildFrame, applyImpression } = await import('../studies/handwriting/v017/engine.mjs');
  const frame = buildFrame(4, []);
  const changed = applyImpression(frame, { x: 99, y: -20 });
  const event = changed.memory.at(-1);

  assert.equal(changed.accepted, true);
  assert.equal(event.x, 0.92);
  assert.equal(event.y, 0.12);
  assert.equal(event.kind, 'tap-impression');
  assert.equal(Object.hasOwn(event, 'endX'), false);
});

test('handwriting v017 lifting the latest press reconstructs the exact preceding setting', async () => {
  const { buildTimeline, applyImpression, removeLatestImpression } = await import('../studies/handwriting/v017/engine.mjs');
  const frame = buildTimeline()[5];
  const changed = applyImpression(frame, { x: 0.71, y: 0.64 });
  const restored = removeLatestImpression(changed);

  assert.notDeepEqual(changed.tiles, frame.tiles);
  assert.deepEqual(restored.tiles, frame.tiles);
  assert.deepEqual(restored.shelves, frame.shelves);
  assert.deepEqual(restored.memory, frame.memory);
});

test('handwriting v017 raw tableau leads with actual text tiles before explanation', async () => {
  const html = await read('studies/handwriting/v017/index.html');

  assert.match(html, /<figure id="work" class="work artwork-frame"/);
  assert.match(html, /id="piece" class="typefield"/);
  assert.match(html, /id="press-type"/);
  assert.match(html, /id="lift-impression"/);
  assert.match(html, /data-frame="artwork-frame"/);
  assert.match(html, /raw-bridge\.js/);
  assert.match(html, /changed rule/i);
  assert.match(html, /falsifier/i);
  assert.match(html, /deletion|delete/i);
  assert.doesNotMatch(html, /<svg\b/i);
  assert.ok(html.indexOf('<figure id="work"') < html.indexOf('id="work-title"'));
});

test('handwriting v017 runtime binds a meaningful tap and keyboard to impression memory', async () => {
  const sketch = await read('studies/handwriting/v017/sketch.js');
  const style = await read('studies/handwriting/v017/style.css');

  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyImpression/);
  assert.match(sketch, /removeLatestImpression/);
  assert.match(sketch, /prefers-reduced-motion/);
  assert.match(sketch, /__mutineHandwritingV017/);
  assert.doesNotMatch(sketch, /pointermove/);
  assert.match(style, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(style, /preview-mode/);
});

test('handwriting v017 records its new medium, art gate, and cultural translation', async () => {
  const readme = await read('studies/handwriting/v017/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v017/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v017/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic HTML text DOM');
  assert.ok(metrics.memoryRule.includes('impression'));
  assert.ok(metrics.interactionRule.includes('tap'));
  assert.ok(metrics.representationRupture.includes('DOM'));
  assert.equal(critiques.length, 5);
});

test('handwriting v017 is the unique 2026-09-27 typography record with a canonical work page', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matching = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-27');
  const work = matching[0];
  const canonical = await read('works/typography-2026-09-27/index.html');
  const routes = await read('vercel.json');

  assert.equal(matching.length, 1);
  assert.equal(work.id, 'typography-2026-09-27');
  assert.equal(work.rawPath, '/studies/handwriting/v017/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-27');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-27"/);
  assert.match(routes, /"\/studies\/handwriting\/v017\/"/);
});
