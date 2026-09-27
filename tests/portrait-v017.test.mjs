import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

function bladeDelta(a, b) {
  return Math.abs(a.angle - b.angle) + Math.abs(a.opening - b.opening) + Math.abs(a.depth - b.depth) + Math.abs(a.width - b.width);
}

test('portrait v017 translates situated attention into a remembered aperture refusal', async () => {
  const { buildFrame, registerGaze, liftLatestGaze, geometrySignature, GAZE_THRESHOLD } = await import('../studies/self-portrait/v017/engine.mjs');
  const baseline = buildFrame(3, []);
  const changed = registerGaze(baseline, { x: 0.71, y: 0.34, dwell: 0.88 });
  const restored = liftLatestGaze(changed);
  const event = changed.memory.at(-1);

  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-gaze');
  assert.equal(event.kind, 'aperture-refusal');
  assert.ok(event.dwell >= GAZE_THRESHOLD);
  assert.notEqual(event.selectedBlade, event.redirectedBlade);
  assert.ok(changed.blades.some((blade, index) => bladeDelta(blade, baseline.blades[index]) > 0.08));
  assert.ok(changed.aperture.gap > baseline.aperture.gap);
  assert.ok(changed.aperture.occlusion > baseline.aperture.occlusion);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(geometrySignature(restored), geometrySignature(baseline), 'lifting the latest gaze must restore the exact prior aperture');
});

test('portrait v017 makes proximity select an agent while commitment changes the shared order', async () => {
  const { buildFrame, armGaze, registerGaze } = await import('../studies/self-portrait/v017/engine.mjs');
  const baseline = buildFrame(2, []);
  const armed = armGaze(baseline, { x: 0.23, y: 0.61 });
  const changed = registerGaze(armed, { x: 0.23, y: 0.61, dwell: 0.91 });
  const event = changed.memory.at(-1);

  assert.equal(armed.memory.length, 0, 'proximity may arm a blade but must not commit memory');
  assert.equal(event.source, 'visitor-gaze');
  assert.ok(Number.isInteger(event.selectedBlade));
  assert.ok(Number.isInteger(event.redirectedBlade));
  assert.notDeepEqual(changed.depthOrder, baseline.depthOrder);
  assert.ok(changed.blades[event.selectedBlade].opening < baseline.blades[event.selectedBlade].opening);
  assert.ok(changed.blades[event.redirectedBlade].opening > baseline.blades[event.redirectedBlade].opening);
});

test('portrait v017 remembers refusal debt and redirects a repeated gaze', async () => {
  const { buildFrame, registerGaze } = await import('../studies/self-portrait/v017/engine.mjs');
  const baseline = buildFrame(1, []);
  const first = registerGaze(baseline, { x: 0.72, y: 0.35, dwell: 0.9 });
  const second = registerGaze(first, { x: 0.72, y: 0.35, dwell: 0.9 });

  assert.ok(second.memory.at(-1).refusalDebtBefore > first.memory.at(-1).refusalDebtBefore);
  assert.notEqual(second.memory.at(-1).redirectedBlade, first.memory.at(-1).redirectedBlade);
  assert.notEqual(second.signature, first.signature);
  assert.equal(second.memory.length, 2);
});

test('portrait v017 bounds gaze memory and settles into five remembered refusals', async () => {
  const { MEMORY_LIMIT, buildFrame, buildTimeline, registerGaze } = await import('../studies/self-portrait/v017/engine.mjs');
  let frame = buildFrame(0, []);
  for (let index = 0; index < 8; index += 1) {
    frame = registerGaze(frame, { x: 0.18 + (index % 5) * 0.16, y: 0.25 + (index % 3) * 0.22, dwell: 0.76 + (index % 3) * 0.08 });
  }
  const settled = buildTimeline().at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.refusals.length, MEMORY_LIMIT);
  assert.equal(frame.redirects.length, MEMORY_LIMIT);
  assert.equal(settled.stage, 12);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.refusals.length, MEMORY_LIMIT);
  assert.equal(settled.redirects.length, MEMORY_LIMIT);
});

test('portrait v017 exposes a caption-free aperture encounter and honest daily record', async () => {
  for (const path of [
    'studies/self-portrait/v017/index.html',
    'studies/self-portrait/v017/engine.mjs',
    'studies/self-portrait/v017/sketch.js',
    'studies/self-portrait/v017/style.css',
    'studies/self-portrait/v017/README.md',
    'studies/self-portrait/v017/metrics.json',
    'studies/self-portrait/v017/critiques.json',
    'works/portrait-2026-09-27/index.html'
  ]) assert.equal(await exists(path), true, `${path} must exist`);

  const index = await read('studies/self-portrait/v017/index.html');
  const sketch = await read('studies/self-portrait/v017/sketch.js');
  const style = await read('studies/self-portrait/v017/style.css');
  const readme = await read('studies/self-portrait/v017/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v017/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v017/critiques.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-09-27');
  const record = matches[0];

  assert.match(index, /<canvas[^>]+id="aperture"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /data-raw-work-id="portrait-2026-09-27"/);
  assert.match(sketch, /armGaze/);
  assert.match(sketch, /registerGaze/);
  assert.match(sketch, /liftLatestGaze/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV017/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.seed, '0x53504637');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D aperture');
  assert.match(metrics.memoryRule, /refusal|order|redirect/i);
  assert.match(metrics.interactionRule, /proximity|gaze|commit/i);
  assert.match(metrics.representationRupture, /aperture|shutter|order/i);
  assert.equal(critiques.length, 5);
  assert.equal(matches.length, 1);
  assert.equal(record.id, 'portrait-2026-09-27');
  assert.equal(record.rawPath, '/studies/self-portrait/v017/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-09-27');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /aperture|refusal|redirect/i);
  assert.ok(record.critiques.length >= 5);
});
