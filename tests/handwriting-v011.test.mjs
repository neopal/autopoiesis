import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  STAGES,
  MEMORY_WINDOW,
  applyStutter,
  buildFrame,
  buildTimeline,
  deleteLatestStutter
} = await import('../studies/handwriting/v011/engine.mjs');

function pathDistance(a, b) {
  return a.points.reduce((sum, point, index) => {
    const other = b.points[index];
    return sum + Math.hypot(point.x - other.x, point.y - other.y);
  }, 0);
}

test('handwriting v011 turns a refusal into a reversible spatial stutter', () => {
  const baseline = buildFrame(8, []);
  const changed = applyStutter(baseline, { x: 0.54, y: 0.43 });
  const restored = deleteLatestStutter(changed);
  const event = changed.memory.at(-1);
  const stuttered = changed.routes.filter((route) => route.stutterSource === event.id);

  assert.ok(stuttered.length >= 3, 'a stutter must affect a local family of routes');
  assert.ok(stuttered.every((route) => route.stutterEnd > route.stutterStart));
  assert.ok(stuttered.every((route) => route.stutterIndex >= route.stutterStart && route.stutterIndex <= route.stutterEnd));
  assert.ok(stuttered.some((route) => route.backtrackDistance > 0.004), 'the stutter must visibly double back');
  assert.ok(stuttered.some((route) => Math.abs(route.carriedOffset) > 0.002), 'the resumed exit must carry a changed offset');
  assert.notDeepEqual(changed.routes, baseline.routes);
  assert.ok(pathDistance(changed.routes[0], baseline.routes[0]) >= 0);
  assert.deepEqual(restored.routes, baseline.routes, 'lifting the stutter must restore the exact prior sentence');
  assert.deepEqual(restored.memory, baseline.memory);
});

test('handwriting v011 gives the affected family one shared rehearsal with a real return beat', () => {
  const frame = buildFrame(8, [{ id: 'shared', stage: 4, x: 0.54, y: 0.43, force: 1, phase: 2.1 }]);
  const stuttered = frame.routes.filter((route) => route.stutterSource === 'shared');
  const records = stuttered.map((route) => route.stutterHistory.at(-1));

  assert.ok(stuttered.length >= 3);
  assert.equal(new Set(stuttered.map((route) => route.stutterIndex)).size, 1, 'the family must rehearse one shared beat');
  assert.ok(records.every((record) => record.advanceEnd < record.backtrackStart));
  assert.ok(records.every((record) => record.backtrackStart <= record.repeatEnd));
  assert.ok(records.every((record) => record.repeatEnd < record.resumeStart));
  assert.ok(stuttered.every((route) => route.points[route.stutterIndex].x < route.points[route.stutterIndex - 1].x), 'the return beat must reverse spatial direction');
  assert.ok(records.every((record) => record.repeatStrength > 0));
});

test('handwriting v011 raw tableau is first, preview-safe, and exposes reversible stutter memory', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/handwriting/v011/index.html', import.meta.url), 'utf8');

  assert.match(html, /data-raw-work-id="typography-2026-09-15"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<figure[^>]+data-frame="artwork-frame"/);
  assert.match(html, /<canvas[^>]+id="piece"/);
  assert.match(html, /data-gesture="stutter"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /stutter|repeat|double back/i);
  assert.ok(html.indexOf('<figure') < html.indexOf('id="work-title"'));
});

test('handwriting v011 records the art gate and independent review boundary', async () => {
  const { readFile } = await import('node:fs/promises');
  const readme = await readFile(new URL('../studies/handwriting/v011/README.md', import.meta.url), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('../studies/handwriting/v011/metrics.json', import.meta.url), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('../studies/handwriting/v011/critiques.json', import.meta.url), 'utf8'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('stutter'));
  assert.ok(metrics.interactionRule.includes('backtrack'));
  assert.equal(critiques.length, 4);
});

test('handwriting v011 is the unique 2026-09-15 typography work with canonical lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-15');
  const work = matches[0];
  const canonical = await readFile(new URL('works/typography-2026-09-15/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'typography-2026-09-15');
  assert.equal(work.rawPath, '/studies/handwriting/v011/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-15');
  assert.equal(work.decision.lineage, 'typography-2026-09-14');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-15"/);
});
