import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/p5-brush/v033/engine.mjs';

const sequence = (offset = 0) => [
  { x: 0.24 + offset, y: 0.26, duration: 120 },
  { x: 0.58, y: 0.48 + offset * 0.3, duration: 170 },
  { x: 0.76 - offset, y: 0.72, duration: 210 }
];

test('Brush v033 starts as a deterministic dry-seam laminate, not a painted field', async () => {
  const { buildFrame, PLATE_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'dry-seam-laminate');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.pending.length, 0);
  assert.equal(frame.plates.length, PLATE_COUNT);
  assert.equal(frame.plates.every((plate) => plate.points.length >= 5), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v033 refuses drags and weak knocks without changing the laminate', async () => {
  const { applyTap, buildFrame, geometrySignature } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const drag = applyTap(baseline, { x: 0.5, y: 0.5, dx: 0.14, dy: 0.04, duration: 130 });
  const weak = applyTap(baseline, { x: 0.5, y: 0.5, duration: 10 });

  assert.equal(drag.interaction, 'tap-refused-drag');
  assert.equal(weak.interaction, 'tap-refused-weak');
  assert.equal(drag.memory.length, 0);
  assert.equal(weak.memory.length, 0);
  assert.equal(geometrySignature(drag), geometrySignature(baseline));
  assert.equal(geometrySignature(weak), geometrySignature(baseline));
});

test('Brush v033 makes only a complete three-knock sequence move a remote seam', async () => {
  const { applyTap, buildFrame, geometrySignature } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const first = applyTap(frame, sequence()[0]);
  const second = applyTap(first, sequence()[1]);
  const committed = applyTap(second, sequence()[2]);

  assert.equal(first.interaction, 'tap-armed');
  assert.equal(second.interaction, 'tap-armed');
  assert.equal(second.pending.length, 2);
  assert.equal(geometrySignature(second), geometrySignature(frame));
  assert.equal(committed.interaction, 'triplet-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.pending.length, 0);
  assert.equal(committed.event.kind, 'dry-seam-shift');
  assert.equal(committed.event.affected.length, 3);
  assert.equal(committed.event.affected.includes(committed.event.entryIndex), false);
  assert.notEqual(geometrySignature(committed), geometrySignature(frame));
  for (const index of committed.event.affected) {
    assert.notEqual(committed.plates[index].pathSignature, frame.plates[index].pathSignature);
  }
});

test('Brush v033 bounds material memory and lifts the exact preceding laminate', async () => {
  const { applyStrike, buildFrame, geometrySignature, liftLatestStrike, releaseLaminate, MEMORY_LIMIT } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const signatures = [geometrySignature(frame)];
  for (let index = 0; index < MEMORY_LIMIT; index += 1) {
    frame = applyStrike(frame, sequence(index * 0.01));
    signatures.push(geometrySignature(frame));
  }
  const beforeLift = signatures.at(-2);
  const lifted = liftLatestStrike(frame);
  const released = releaseLaminate();

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.commits.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), beforeLift);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), signatures[0]);
});

test('Brush v033 exposes a discrete interaction, reduced motion, and evidence contract', async () => {
  const html = await read('studies/p5-brush/v033/index.html');
  const sketch = await read('studies/p5-brush/v033/sketch.js');
  const style = await read('studies/p5-brush/v033/style.css');
  const readme = await read('studies/p5-brush/v033/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v033/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v033/critiques.json'));

  assert.match(html, /<svg[^>]+id="field"/);
  assert.match(html, /data-gesture="knock"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyTap/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.seed, '0x42525533');
  assert.equal(metrics.grammar, 'dry-seam-laminate');
  assert.equal(critiques.length, 6);
});

test('Brush v033 is registered exactly once for the 2026-10-20 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-20');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-20');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v033/');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-20');

  const canonical = await read('works/brush-2026-10-20/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-20"/);
});
