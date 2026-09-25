import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  ATTENTION_THRESHOLD,
  MEMORY_LIMIT,
  buildFrame,
  buildTimeline,
  registerAttention,
  liftLatestAttention,
  geometrySignature
} = await import('../studies/self-portrait/v016/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function changedCellCount(a, b) {
  return a.reduce((count, cell, index) => {
    const other = b[index];
    return count + (cell.x !== other.x || cell.y !== other.y || cell.radius !== other.radius || cell.opacity !== other.opacity ? 1 : 0);
  }, 0);
}

test('portrait v016 translates situated attention into a raster witness transfer', () => {
  const baseline = buildFrame(4);
  const changed = registerAttention(baseline, { x: 0.74, y: 0.35, dwell: 0.86 });
  const restored = liftLatestAttention(changed);
  const event = changed.attentions.at(-1);

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(event.source, 'visitor-attention');
  assert.equal(event.kind, 'witness-transfer');
  assert.ok(event.dwell >= ATTENTION_THRESHOLD);
  assert.ok(event.sourceCell !== event.receiverCell);
  assert.ok(changedCellCount(changed.cells, baseline.cells) >= 12);
  assert.ok(changed.cells[event.sourceCell].opacity < baseline.cells[event.sourceCell].opacity);
  assert.ok(changed.cells[event.receiverCell].radius > baseline.cells[event.receiverCell].radius);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the latest witness must restore the exact prior raster field');
});

test('portrait v016 makes a watched patch change the future image rather than only its current tint', () => {
  const baseline = buildFrame(3);
  const first = registerAttention(baseline, { x: 0.7, y: 0.36, dwell: 0.92 });
  const second = registerAttention(first, { x: 0.7, y: 0.36, dwell: 0.92 });
  const firstEvent = first.attentions.at(-1);
  const secondEvent = second.attentions.at(-1);

  assert.ok(secondEvent.resistanceBefore > firstEvent.resistanceBefore);
  assert.ok(secondEvent.transferMass < firstEvent.transferMass, 'a remembered witness must alter the next transfer');
  assert.notEqual(firstEvent.signature, secondEvent.signature);
  assert.equal(second.memory.length, 2);
});

test('portrait v016 bounds attention memory and settles into five witness transfers', () => {
  let frame = buildFrame(2);
  for (let index = 0; index < 8; index += 1) {
    frame = registerAttention(frame, {
      x: 0.2 + index * 0.085,
      y: 0.28 + (index % 4) * 0.14,
      dwell: 0.72 + (index % 3) * 0.11
    });
  }

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.attentions.length, MEMORY_LIMIT);
  assert.equal(frame.voids.length, MEMORY_LIMIT);
  assert.equal(frame.transfers.length, MEMORY_LIMIT);
  assert.ok(frame.cells.some((cell) => cell.opacity < 0.25));
});

test('portrait v016 timeline settles into five remembered raster decisions', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, 15);
  assert.equal(settled.stage, 14);
  assert.equal(settled.memory.length, 5);
  assert.equal(settled.attentions.length, 5);
  assert.equal(settled.voids.length, 5);
  assert.equal(settled.transfers.length, 5);
});

test('portrait v016 tableau exposes a caption-free raster encounter with reversible attention', async () => {
  const html = await read('studies/self-portrait/v016/index.html');
  const sketch = await read('studies/self-portrait/v016/sketch.js');
  const style = await read('studies/self-portrait/v016/style.css');
  const readme = await read('studies/self-portrait/v016/README.md');
  const metrics = JSON.parse(await read('studies/self-portrait/v016/metrics.json'));
  const critiques = JSON.parse(await read('studies/self-portrait/v016/critiques.json'));

  assert.match(html, /data-raw-work-id="portrait-2026-09-25"/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="attend"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerAttention/);
  assert.match(sketch, /liftLatestAttention/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /witness-transfer/);
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
  assert.match(metrics.memoryRule, /witness|attention/i);
  assert.equal(critiques.length, 5);
});

test('portrait v016 is the unique 2026-09-25 daily work with a canonical page', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-09-25');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-09-25');
  assert.equal(work.rawPath, '/studies/self-portrait/v016/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-09-25');
  assert.equal(work.decision.lineage, 'portrait-2026-09-24');
  assert.equal(work.source.referenceId, 'little-critters');

  const canonical = await read('works/portrait-2026-09-25/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-09-25"/);
});

test('portrait v016 reduced-motion and blind preview render a settled raster witness field', async () => {
  const sketch = await read('studies/self-portrait/v016/sketch.js');

  assert.match(sketch, /if \(frozen\) \{\s*render\(frame, 'sequence'\);\s*return;/);
  assert.match(sketch, /staticPreview \|\| blindMode/);
});
