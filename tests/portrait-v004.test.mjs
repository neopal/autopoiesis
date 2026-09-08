import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_LIMIT,
  STAGES,
  applyRefusal,
  buildFrame,
  buildTimeline,
  deleteLatestRefusal,
  geometrySignature
} = await import('../studies/self-portrait/v004/engine.mjs');

test('portrait v004 turns a remembered refusal into a visible split and recombination', () => {
  const baseline = buildFrame(5);
  const changed = applyRefusal(baseline, { x: 0.76, y: 0.42 });
  const restored = deleteLatestRefusal(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.ok(changed.forkedRoutes.length > baseline.forkedRoutes.length);
  assert.ok(changed.forkedRoutes.some((route) => route.left.length >= 5 && route.right.length >= 5 && route.rejoin));
  assert.ok(changed.contour.some((point, index) => point.x !== baseline.contour[index].x || point.y !== baseline.contour[index].y));
  assert.notDeepEqual(changed.forkedRoutes.at(-1).rejoin, changed.forkedRoutes.at(-1).split);
  assert.ok(Math.abs(changed.forkedRoutes.at(-1).left[5].x - changed.forkedRoutes.at(-1).right[5].x) > 0.05);
  assert.equal(geometrySignature(baseline), geometrySignature(restored));
});

test('portrait v004 keeps refusal memory bounded and pointer input deterministic', () => {
  const baseline = buildFrame(5);
  const first = applyRefusal(baseline, { x: 2, y: -1 });
  const repeated = applyRefusal(baseline, { x: 2, y: -1 });

  assert.equal(first.memory.length, 1);
  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.equal(first.memory.at(-1).source, 'visitor-refusal');
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyRefusal(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v004 tableau is first, preview-safe, and names a reversible refusal gesture', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/self-portrait/v004/index.html', import.meta.url), 'utf8');

  assert.match(html, /data-raw-work-id="portrait-2026-09-08"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="refusal"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /fork|split/i);
});

test('portrait v004 runtime binds pointer and keyboard to the forked route memory', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v004/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/self-portrait/v004/style.css', import.meta.url), 'utf8');

  assert.match(sketch, /applyRefusal/);
  assert.match(sketch, /deleteLatestRefusal/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawForkedRoutes/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v004 is recorded as the unique 2026-09-08 daily work with a canonical page', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const work = data.works.find((entry) => entry.id === 'portrait-2026-09-08');

  assert.ok(work);
  assert.equal(work.currentId, 'portrait');
  assert.equal(work.date, '2026-09-08');
  assert.equal(work.rawPath, '/studies/self-portrait/v004/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-08');
  assert.equal(work.decision.lineage, 'portrait-2026-09-04');
  assert.equal(data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-08').length, 1);

  await access(new URL('works/portrait-2026-09-08/index.html', root));
  const canonical = await readFile(new URL('works/portrait-2026-09-08/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-08"/);
});
