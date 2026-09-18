import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  registerAttention,
  buildFrame,
  buildTimeline,
  liftLatestAttention,
  geometrySignature
} = await import('../studies/self-portrait/v013/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

test('portrait v013 turns remembered attention into a reversible inward fold', () => {
  const baseline = buildFrame(8);
  const changed = registerAttention(baseline, { x: 0.78, y: 0.4 });
  const restored = liftLatestAttention(changed);
  const route = changed.attentionRoutes[0];

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 20);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-attention');
  assert.equal(route.attention.kind, 'attention-fold');
  assert.ok(route.approach.length >= 15);
  assert.ok(route.compression.length >= 15);
  assert.ok(route.fold.length >= 13);
  assert.ok(route.release.length >= 13);
  assert.ok(route.departure.length >= 13);
  assert.ok(samePoint(route.approach[0], route.entry));
  assert.ok(samePoint(route.departure.at(-1), route.exit));
  assert.ok(route.fold.some((point) => point.x < route.attention.hingeX));
  assert.ok(route.fold.some((point) => point.x > route.attention.hingeX));
  assert.ok(route.attention.foldDistance > 0.14);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting attention must restore the exact prior field');
});

test('portrait v013 bounds remembered attention and carries a changed gaze downstream', () => {
  let frame = buildFrame(5);
  for (let index = 0; index < 7; index += 1) {
    frame = registerAttention(frame, { x: 0.18 + index * 0.11, y: 0.24 + (index % 3) * 0.21 });
  }
  const route = frame.attentionRoutes.at(-1);

  assert.equal(frame.memory.length, 4);
  assert.equal(frame.attentionRoutes.length, 4);
  assert.ok(route.attention.kind === 'attention-fold');
  assert.ok(route.compression.some((point) => point.x > 0.4 && point.x < 0.6));
  assert.ok(route.departure.some((point, index) => index > 0 && point.y > route.release.at(-1).y));
});

test('portrait v013 timeline settles into four remembered inward folds', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 18);
  assert.equal(settled.stage, 17);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.attentionRoutes.length, 4);
  assert.ok(settled.attentionRoutes.every((route) => route.attention.kind === 'attention-fold'));
});

test('portrait v013 tableau exposes attention as an isolated reversible encounter', async () => {
  const html = await read('studies/self-portrait/v013/index.html');
  const sketch = await read('studies/self-portrait/v013/sketch.js');
  const style = await read('studies/self-portrait/v013/style.css');
  const readme = await read('studies/self-portrait/v013/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v013/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v013/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-18"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="attend"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerAttention/);
  assert.match(sketch, /liftLatestAttention/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /attention-fold/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.equal(metrics.memoryRule.includes('fold'), true);
  assert.equal(critiques.length, 4);
});

test('portrait v013 is the unique 2026-09-18 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-18');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-18');
  assert.equal(work.rawPath, '/studies/self-portrait/v013/');
  assert.equal(work.status, 'candidate / held');
  assert.match(work.browserEvidence.status, /^local headless browser matrix passed/);
  assert.equal(work.browserEvidence.observedRoute, 'http://127.0.0.1:4173/works/portrait-2026-09-18/');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-18');
  assert.equal(work.decision.lineage, 'portrait-2026-09-17');

  const canonical = await read('works/portrait-2026-09-18/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-18"/);
});

test('portrait v013 reduced-motion and static preview render a settled tableau', async () => {
  const sketch = await read('studies/self-portrait/v013/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
