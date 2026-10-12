import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/pure-svg/v029/engine.mjs';

test('Pure SVG v029 begins as a deterministic fused-seam field, not an array of panels', async () => {
  const { buildFrame, CELL_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'fused-seam');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.cells.length, CELL_COUNT);
  assert.equal(frame.cells.every((cell) => cell.pathSignature.startsWith('M') && cell.pathSignature.includes('Z')), true);
  assert.equal(frame.centralVoid > 0, true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v029 needs a second non-local place before the seam fuses', async () => {
  const { armCell, applyFusion, buildFrame } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const armed = armCell(baseline, { x: 0.18, y: 0.34 });
  const refused = applyFusion(armed, { x: 0.18, y: 0.34 });
  const fused = applyFusion(armed, { x: 0.82, y: 0.68 });

  assert.equal(armed.interaction, 'first-place-armed');
  assert.equal(armed.memory.length, 0);
  assert.equal(refused.interaction, 'fusion-refused-same-place');
  assert.equal(refused.memory.length, 0);
  assert.equal(fused.interaction, 'seam-fused');
  assert.equal(fused.memory.length, 1);
  assert.equal(fused.event.committed, true);
  assert.notEqual(fused.event.source, fused.event.target);
  assert.notEqual(fused.cells[fused.event.source].pathSignature, baseline.cells[fused.event.source].pathSignature);
  assert.notEqual(fused.cells[fused.event.target].pathSignature, baseline.cells[fused.event.target].pathSignature);
  assert.notEqual(fused.cells[fused.event.relay].pathSignature, baseline.cells[fused.event.relay].pathSignature);
  assert.notEqual(fused.signature, baseline.signature);
});

test('Pure SVG v029 carries non-local seam memory, lifts exactly, and releases to the seed', async () => {
  const { applyFusion, armCell, buildFrame, geometrySignature, liftLatestFusion, releaseField } = await import(engineUrl);
  let frame = buildFrame(3, []);
  frame = applyFusion(armCell(frame, { x: 0.18, y: 0.34 }), { x: 0.82, y: 0.68 });
  const first = frame;
  frame = applyFusion(armCell(frame, { x: 0.72, y: 0.3 }), { x: 0.22, y: 0.74 });
  const second = frame;
  const lifted = liftLatestFusion(second);
  const released = releaseField();

  assert.equal(second.memory.length, 2);
  assert.notEqual(second.event.relay, undefined);
  assert.notEqual(geometrySignature(second), geometrySignature(first));
  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v029 retains four fusions and refuses a fifth', async () => {
  const { applyFusion, armCell, buildTimeline } = await import(engineUrl);
  const settled = buildTimeline().at(-1);
  const refused = applyFusion(armCell(settled, { x: 0.18, y: 0.34 }), { x: 0.82, y: 0.68 });

  assert.equal(settled.memory.length, 4);
  assert.equal(refused.interaction, 'fusion-memory-full');
  assert.equal(refused.event.committed, false);
});

test('Pure SVG v029 publishes a self-contained tableau with equivalent pointer and keyboard paths', async () => {
  const tableau = await read('studies/pure-svg/v029/index.html');
  const sketch = await read('studies/pure-svg/v029/sketch.js');
  const style = await read('studies/pure-svg/v029/style.css');

  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="offer"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
});
