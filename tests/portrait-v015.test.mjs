import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  registerPressure,
  buildFrame,
  buildTimeline,
  liftLatestPressure,
  geometrySignature
} = await import('../studies/self-portrait/v015/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedPointCount(a, b) {
  return a.reduce((count, point, index) => {
    const other = b[index];
    return count + (point.x !== other.x || point.y !== other.y ? 1 : 0);
  }, 0);
}

test('portrait v015 turns pressure into a reversible material scar', () => {
  const baseline = buildFrame(6);
  const changed = registerPressure(baseline, { x: 0.76, y: 0.32, pressure: 0.92 });
  const restored = liftLatestPressure(changed);
  const scar = changed.scars[0];

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory.at(-1).source, 'visitor-pressure');
  assert.equal(scar.kind, 'pressure-scar');
  assert.ok(changedPointCount(changed.membrane.outline, baseline.membrane.outline) >= 10);
  assert.ok(scar.gap.length >= 4, 'the pressure must open a real gap in the membrane');
  assert.ok(scar.flap.length >= 4, 'the pressure must displace material as a detached flap');
  assert.ok(scar.yield > 0);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the latest scar must restore the exact prior membrane');
});

test('portrait v015 makes the membrane remember resistance rather than only changing the current mark', () => {
  const baseline = buildFrame(4);
  const first = registerPressure(baseline, { x: 0.7, y: 0.36, pressure: 0.9 });
  const second = registerPressure(first, { x: 0.7, y: 0.36, pressure: 0.9 });
  const firstScar = first.scars.at(-1);
  const secondScar = second.scars.at(-1);

  assert.ok(secondScar.resistanceBefore > firstScar.resistanceBefore);
  assert.ok(secondScar.yield < firstScar.yield, 'a remembered pressure must make the next event meet more resistance');
  assert.notEqual(firstScar.gapSignature, secondScar.gapSignature);
  assert.equal(second.memory.length, 2);
});

test('portrait v015 bounds material memory and settles into four scars', () => {
  let frame = buildFrame(3);
  for (let index = 0; index < 7; index += 1) {
    frame = registerPressure(frame, { x: 0.22 + index * 0.09, y: 0.28 + (index % 4) * 0.14, pressure: 0.55 + (index % 3) * 0.15 });
  }

  assert.equal(frame.memory.length, 4);
  assert.equal(frame.scars.length, 4);
  assert.equal(frame.flaps.length, 4);
  assert.ok(frame.membrane.resistance.some((value) => value > 0.7));
});

test('portrait v015 timeline settles into four remembered material decisions', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 14);
  assert.equal(settled.stage, 13);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.scars.length, 4);
  assert.equal(settled.flaps.length, 4);
});

test('portrait v015 tableau exposes pressure as an isolated reversible encounter', async () => {
  const html = await read('studies/self-portrait/v015/index.html');
  const sketch = await read('studies/self-portrait/v015/sketch.js');
  const style = await read('studies/self-portrait/v015/style.css');
  const readme = await read('studies/self-portrait/v015/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v015/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v015/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-24"/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="pressure"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerPressure/);
  assert.match(sketch, /liftLatestPressure/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pressure-scar/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.measured, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.match(metrics.memoryRule, /resistance/i);
  assert.equal(critiques.length, 5);
});

test('portrait v015 is the unique 2026-09-24 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-24');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-24');
  assert.equal(work.rawPath, '/studies/self-portrait/v015/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.browserEvidence.status, 'local headless matrix passed / held for production readback and independent caption-free perceptual review');
  assert.match(work.browserEvidence.viewportMatrix, /^10\/10 local headless runs passed/);
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-24');
  assert.equal(work.decision.lineage, 'portrait-2026-09-23');

  const canonical = await read('works/portrait-2026-09-24/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-24"/);
});

test('portrait v015 reduced-motion and blind preview render a settled membrane', async () => {
  const sketch = await read('studies/self-portrait/v015/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
