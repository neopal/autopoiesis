import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  applyThreshold,
  buildFrame,
  buildTimeline,
  deleteLatestThreshold,
  geometrySignature
} = await import('../studies/self-portrait/v012/engine.mjs');

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

test('portrait v012 turns a remembered decision into a reversible threshold crossing', () => {
  const baseline = buildFrame(8);
  const changed = applyThreshold(baseline, { x: 0.78, y: 0.4 });
  const restored = deleteLatestThreshold(changed);
  const route = changed.thresholdRoutes[0];

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 16);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-threshold');
  assert.equal(route.threshold.kind, 'boundary-crossing');
  assert.ok(route.approach.length >= 15);
  assert.ok(route.boundary.length >= 15);
  assert.ok(route.crossing.length >= 11);
  assert.ok(route.interior.length >= 11);
  assert.ok(route.departure.length >= 11);
  assert.ok(samePoint(route.approach[0], route.entry));
  assert.ok(samePoint(route.departure.at(-1), route.exit));
  assert.ok(route.crossing[0].x < route.threshold.x);
  assert.ok(route.crossing.at(-1).x > route.threshold.x);
  assert.ok(route.threshold.crossingDistance > 0.12);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'removing the threshold must restore the exact prior field');
});

test('portrait v012 bounds threshold memory and keeps downstream departures structural', () => {
  let frame = buildFrame(5);
  for (let index = 0; index < 7; index += 1) {
    frame = applyThreshold(frame, { x: 0.18 + index * 0.11, y: 0.24 + (index % 3) * 0.21 });
  }
  const route = frame.thresholdRoutes.at(-1);

  assert.equal(frame.memory.length, 4);
  assert.equal(frame.thresholdRoutes.length, 4);
  assert.equal(route.threshold.kind, 'boundary-crossing');
  assert.ok(route.interior.some((point) => point.x > 0.42 && point.x < 0.58));
  assert.ok(route.departure.some((point, index) => index > 0 && point.y > route.interior.at(-1).y));
});

test('portrait v012 timeline carries four threshold crossings into its settled state', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 18);
  assert.equal(settled.stage, 17);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.thresholdRoutes.length, 4);
  assert.ok(settled.thresholdRoutes.every((route) => route.threshold.kind === 'boundary-crossing'));
});

test('portrait v012 tableau exposes the threshold as an isolated reversible encounter', async () => {
  const html = await read('studies/self-portrait/v012/index.html');
  const sketch = await read('studies/self-portrait/v012/sketch.js');
  const style = await read('studies/self-portrait/v012/style.css');
  const readme = await read('studies/self-portrait/v012/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v012/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v012/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-17"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="threshold"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /applyThreshold/);
  assert.match(sketch, /deleteLatestThreshold/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /boundary-crossing/);
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
  assert.equal(metrics.memoryRule.includes('cross'), true);
  assert.equal(critiques.length, 4);
});

test('portrait v012 is the unique 2026-09-17 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-17');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-17');
  assert.equal(work.rawPath, '/studies/self-portrait/v012/');
  assert.equal(work.status, 'candidate / held');
  assert.match(work.browserEvidence.status, /^local headless browser matrix(?: and production route readback)? passed/);
  assert.equal(work.browserEvidence.observedRoute, 'http://127.0.0.1:4173/works/portrait-2026-09-17/');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-17');
  assert.equal(work.decision.lineage, 'portrait-2026-09-16');

  const canonical = await read('works/portrait-2026-09-17/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-17"/);
});

test('portrait v012 reduced-motion and static preview render a settled tableau instead of racing the timeline', async () => {
  const sketch = await read('studies/self-portrait/v012/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
