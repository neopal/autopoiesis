import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const {
  MEMORY_LIMIT,
  STAGES,
  applyDecision,
  buildFrame,
  buildTimeline,
  deleteLatestDecision,
  geometrySignature
} = await import('../studies/self-portrait/v005/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portrait v005 turns a remembered decision into an off-register plate, not a marker', () => {
  const baseline = buildFrame(6);
  const changed = applyDecision(baseline, { x: 0.78, y: 0.39 });
  const restored = deleteLatestDecision(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.notEqual(changed.registration.angle, baseline.registration.angle);
  assert.ok(changed.registeredContour.some((point, index) => {
    const original = baseline.contour[index];
    return point.x !== original.x || point.y !== original.y;
  }));
  assert.ok(changed.contacts.length >= 4);
  assert.ok(changed.contacts.some((route) => route[0].x !== route.at(-1).x || route[0].y !== route.at(-1).y));
  assert.equal(changed.memory.at(-1).source, 'visitor-decision');
  assert.equal(geometrySignature(baseline), geometrySignature(restored));
});

test('portrait v005 bounds decisions, keeps memory finite, and reproduces pointer state', () => {
  const baseline = buildFrame(4);
  const first = applyDecision(baseline, { x: 2, y: -1 });
  const repeated = applyDecision(baseline, { x: 2, y: -1 });

  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyDecision(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v005 timeline accumulates four structural registrations by its final state', () => {
  const timeline = buildTimeline(STAGES);
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.registeredContour.length === settled.contour.length);
  assert.ok(settled.contacts.length >= 4);
  assert.ok(timeline.some((frame) => frame.decided));
});

test('portrait v005 tableau is first, preview-safe, and names a reversible registration gesture', async () => {
  const html = await read('studies/self-portrait/v005/index.html');

  assert.match(html, /data-raw-work-id="portrait-2026-09-09"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="decision"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
  assert.match(html, /registration|plate|misregister/i);
});

test('portrait v005 runtime binds pointer and keyboard to structural decision memory', async () => {
  const sketch = await read('studies/self-portrait/v005/sketch.js');
  const style = await read('studies/self-portrait/v005/style.css');

  assert.match(sketch, /applyDecision/);
  assert.match(sketch, /deleteLatestDecision/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /function drawRegistration/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v005 is recorded as the unique 2026-09-09 daily work with a canonical page', async () => {
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const work = data.works.find((entry) => entry.id === 'portrait-2026-09-09');

  assert.ok(work);
  assert.equal(work.currentId, 'portrait');
  assert.equal(work.date, '2026-09-09');
  assert.equal(work.rawPath, '/studies/self-portrait/v005/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-09');
  assert.equal(work.decision.lineage, 'portrait-2026-09-08');
  assert.equal(data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-09').length, 1);

  await access(new URL('works/portrait-2026-09-09/index.html', root));
  const canonical = await readFile(new URL('works/portrait-2026-09-09/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-09"/);
});
