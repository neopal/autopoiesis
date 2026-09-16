import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  applyBraid,
  buildFrame,
  geometrySignature
} = await import('../studies/self-portrait/v011/engine.mjs');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('portrait v011 turns a remembered fork into a reversible braid that exchanges lanes', () => {
  const baseline = buildFrame(8);
  const changed = applyBraid(baseline, { x: 0.78, y: 0.4 });
  const restored = changed.restoreMemory ? buildFrame(changed.stage, changed.restoreMemory) : changed;
  const route = changed.braidRoutes[0];
  const mid = Math.floor(route.lanes[0].length / 2);
  const quarter = Math.floor(route.lanes[0].length / 4);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(route.trunk.length, 13);
  assert.equal(route.lanes.length, 2);
  assert.ok(route.lanes.every((lane) => lane.length === 25));
  assert.ok(changedPointCount(changed.contour, changed.counterContour) >= 16);
  assert.notDeepEqual(changed.counterAperture, changed.aperture);
  assert.equal(changed.memory.at(-1).source, 'visitor-braid');
  assert.ok(route.lanes[0][quarter].x < route.lanes[1][quarter].x);
  assert.ok(route.lanes[0][mid].x > route.lanes[1][mid].x);
  assert.ok(route.lanes.every((lane) => samePoint(lane[0], route.split)));
  assert.ok(route.lanes.every((lane) => samePoint(lane.at(-1), route.merge)));
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'removing the braid must restore the exact prior field');
});

test('portrait v011 bounds visitor braid memory and records the crossed lane order', () => {
  let frame = buildFrame(5);
  for (let index = 0; index < 7; index += 1) {
    frame = applyBraid(frame, { x: 0.18 + index * 0.11, y: 0.24 + (index % 3) * 0.21 });
  }
  const route = frame.braidRoutes.at(-1);

  assert.equal(frame.memory.length, 4);
  assert.equal(route.crossing.kind, 'lane-exchange');
  assert.deepEqual(route.crossing.orderBefore, ['left', 'right']);
  assert.deepEqual(route.crossing.orderAfter, ['right', 'left']);
  assert.ok(route.crossing.index > 0 && route.crossing.index < route.lanes[0].length - 1);
});

test('portrait v011 tableau exposes the braid as an isolated reversible encounter', async () => {
  const html = await read('studies/self-portrait/v011/index.html');
  const sketch = await read('studies/self-portrait/v011/sketch.js');
  const style = await read('studies/self-portrait/v011/style.css');
  const readme = await read('studies/self-portrait/v011/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v011/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v011/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-16"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="braid"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /applyBraid/);
  assert.match(sketch, /deleteLatestBraid/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /lane-exchange/);
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
  assert.equal(metrics.memoryRule.includes('exchange'), true);
  assert.equal(critiques.length, 4);
});

test('portrait v011 is the unique 2026-09-16 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-16');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-16');
  assert.equal(work.rawPath, '/studies/self-portrait/v011/');
  assert.equal(work.status, 'candidate / held');
  assert.match(work.browserEvidence.status, /^local headless browser matrix passed/);
  assert.equal(work.browserEvidence.observedRoute, 'http://127.0.0.1:4173/works/portrait-2026-09-16/');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-16');
  assert.equal(work.decision.lineage, 'portrait-2026-09-15');

  const canonical = await read('works/portrait-2026-09-16/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-16"/);
});

test('portrait v011 reduced-motion and static preview render a settled tableau instead of racing the timeline', async () => {
  const sketch = await read('studies/self-portrait/v011/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
