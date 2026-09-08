import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_LIMIT,
  STAGES,
  applyAbsence,
  buildFrame,
  buildTimeline,
  deleteLatestAbsence,
  geometrySignature
} = await import('../studies/self-portrait/v003/engine.mjs');

test('portrait v003 makes a remembered absence alter the negative aperture and contour', () => {
  const baseline = buildTimeline()[STAGES - 1];
  const changed = applyAbsence(baseline, { x: 0.78, y: 0.42 });
  const restored = deleteLatestAbsence(changed);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.notDeepEqual(baseline.aperture, changed.aperture);
  assert.ok(changed.contour.some((point, index) => point.x !== baseline.contour[index].x || point.y !== baseline.contour[index].y));
  assert.equal(geometrySignature(baseline), geometrySignature(restored));
});

test('portrait v003 keeps absence memory bounded and pointer input deterministic', () => {
  const baseline = buildFrame(5);
  const first = applyAbsence(baseline, { x: 2, y: -1 });
  const repeated = applyAbsence(baseline, { x: 2, y: -1 });

  assert.equal(first.memory.length, 1);
  assert.deepEqual(first.memory.at(-1).point, { x: 0.92, y: 0.16 });
  assert.equal(first.memory.at(-1).source, 'visitor-absence');
  assert.deepEqual(first, repeated);

  let current = baseline;
  for (let index = 0; index < MEMORY_LIMIT + 2; index += 1) {
    current = applyAbsence(current, { x: 0.18 + index * 0.09, y: 0.32 });
  }
  assert.equal(current.memory.length, MEMORY_LIMIT);
});

test('portrait v003 raw tableau is first, preview-safe, and names the reversible absence gesture', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../studies/self-portrait/v003/index.html', import.meta.url), 'utf8');

  assert.match(html, /data-raw-work-id="portrait-2026-09-04"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="absence"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="img"/);
});

test('portrait v003 runtime offers equivalent pointer and keyboard paths without painting memory as a witness', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v003/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/self-portrait/v003/style.css', import.meta.url), 'utf8');

  assert.match(sketch, /applyAbsence/);
  assert.match(sketch, /deleteLatestAbsence/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /Enter/);
  assert.match(sketch, /const interactivePreview = params\.has\('interaction'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1'/);
  assert.match(sketch, /function drawMemory\(frame\) \{[\s\S]*if \(staticPreview\) return/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('portrait v003 is recorded as the unique 2026-09-04 daily work with its canonical page', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const data = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const work = data.works.find((entry) => entry.id === 'portrait-2026-09-04');

  assert.ok(work);
  assert.equal(work.currentId, 'portrait');
  assert.equal(work.date, '2026-09-04');
  assert.equal(work.rawPath, '/studies/self-portrait/v003/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-04');
  assert.equal(work.decision.lineage, 'portrait-2026-09-03');
  assert.equal(data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-04').length, 1);

  await access(new URL('works/portrait-2026-09-04/index.html', root));
  const canonical = await readFile(new URL('works/portrait-2026-09-04/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-04"/);
});
