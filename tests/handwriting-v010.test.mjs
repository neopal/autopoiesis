import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  applyHinge,
  buildFrame,
  deleteLatestHinge
} = await import('../studies/handwriting/v010/engine.mjs');

test('handwriting v010 turns a refusal into a reversible finite hinge', () => {
  const baseline = buildFrame(8, []);
  const changed = applyHinge(baseline, { x: 0.54, y: 0.43 });
  const restored = deleteLatestHinge(changed);
  const event = changed.memory.at(-1);
  const hinged = changed.routes.filter((route) => route.hingeSource === event.id);

  assert.ok(hinged.length >= 3, 'a hinge must affect a local family of routes');
  assert.ok(hinged.every((route) => route.hingeEnd > route.hingeStart));
  assert.ok(hinged.every((route) => route.hingeIndex >= route.hingeStart && route.hingeIndex <= route.hingeEnd));
  assert.ok(hinged.some((route) => route.foldAngle > 0.1), 'the fold must have measurable angular change');
  assert.notDeepEqual(changed.routes, baseline.routes);
  assert.deepEqual(restored.routes, baseline.routes, 'lifting the hinge must restore the exact prior sentence');
  assert.deepEqual(restored.memory, baseline.memory);
});

test('handwriting v010 raw tableau is first, preview-safe, and exposes hinge memory', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/handwriting/v010/index.html', import.meta.url), 'utf8');

  assert.match(html, /data-raw-work-id="typography-2026-09-14"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<figure[^>]+data-frame="artwork-frame"/);
  assert.match(html, /<canvas[^>]+id="piece"/);
  assert.match(html, /data-gesture="hinge"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /hinge|fold|pivot/i);
  assert.ok(html.indexOf('<figure') < html.indexOf('id="work-title"'));
});

test('handwriting v010 makes one shared pivot seam and carries the changed exit', () => {
  const frame = buildFrame(8, [{ id: 'shared', stage: 8, x: 0.54, y: 0.43, force: 1, phase: 2.2 }]);
  const hinged = frame.routes.filter((route) => route.hingeSource === 'shared');
  const pivotIndices = new Set(hinged.map((route) => route.hingeIndex));

  assert.ok(hinged.length >= 3);
  assert.equal(pivotIndices.size, 1, 'the affected family must share one pivot index');
  assert.ok(hinged.every((route) => Math.abs(route.carriedOffset) > 0.002), 'the exit must carry a changed offset');
  assert.ok(hinged.every((route) => route.hingeHistory.at(-1).id === 'shared'));
});

test('handwriting v010 records its art gate and independent review boundary', async () => {
  const { readFile } = await import('node:fs/promises');
  const readme = await readFile(new URL('../studies/handwriting/v010/README.md', import.meta.url), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('../studies/handwriting/v010/metrics.json', import.meta.url), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('../studies/handwriting/v010/critiques.json', import.meta.url), 'utf8'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.ok(metrics.memoryRule.includes('hinge'));
  assert.ok(metrics.interactionRule.includes('offset'));
  assert.equal(critiques.length, 4);
});

test('handwriting v010 is the unique 2026-09-14 typography work with canonical lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-09-14');
  const work = matches[0];
  const canonical = await readFile(new URL('works/typography-2026-09-14/index.html', root), 'utf8');

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'typography-2026-09-14');
  assert.equal(work.rawPath, '/studies/handwriting/v010/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.journal.anchor, 'journal-typography-2026-09-14');
  assert.equal(work.decision.lineage, 'typography-2026-09-13');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-09-14"/);
});

test('handwriting v010 lift restores the remaining hinge as the active witness', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/handwriting/v010/sketch.js', import.meta.url), 'utf8');

  const liftBody = sketch.slice(sketch.indexOf('function liftLatest'), sketch.indexOf('function releaseSequence'));
  assert.match(liftBody, /frameState = deleteLatestHinge\(frameState\);/);
  assert.match(liftBody, /latestVisitorId = frameState\.memory\.at\(-1\)\?\.id \?\? null;/);
  assert.match(liftBody, /selectedHingeId = latestVisitorId;/);
});
