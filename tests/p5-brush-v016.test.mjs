import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildFrame,
  registerCut,
  liftLatestCut,
  geometrySignature
} = await import('../studies/p5-brush/v016/engine.mjs');

test('brush v016 turns a pressure cut into a reversible material displacement', () => {
  const baseline = buildFrame(8);
  const changed = registerCut(baseline, {
    path: [
      { x: 0.18, y: 0.32 },
      { x: 0.42, y: 0.46 },
      { x: 0.78, y: 0.58 }
    ],
    pressure: 0.72
  });
  const restored = liftLatestCut(changed);
  const displaced = changed.cells.filter((cell, index) => {
    const before = baseline.cells[index];
    return cell.lift !== before.lift || cell.grain !== before.grain || cell.angle !== before.angle;
  });

  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.cut.kind, 'material-cut');
  assert.ok(changed.cut.path.length >= 3);
  assert.ok(changed.cut.width > 0.04);
  assert.ok(changed.scar.points.length >= 8);
  assert.ok(changed.displacedRidge.points.length >= 8);
  assert.ok(displaced.length >= 12);
  assert.ok(changed.materialLoad > baseline.materialLoad);
  assert.equal(geometrySignature(baseline), geometrySignature(restored), 'lifting the cut must restore the exact prior plate');
});

test('brush v016 publishes a drag-driven tableau with a blind preview boundary', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v016/index.html');
  const sketch = await read('studies/p5-brush/v016/sketch.js');
  const style = await read('studies/p5-brush/v016/style.css');
  const readme = await read('studies/p5-brush/v016/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v016/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v016/critiques.json'));

  assert.match(html, /data-raw-work-id="brush-2026-09-22"/);
  assert.match(html, /preview-mode/);
  assert.match(html, /<canvas[^>]+id="field"/);
  assert.match(html, /data-gesture="cut"/);
  assert.match(html, /data-gesture="undo"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /registerCut/);
  assert.match(sketch, /liftLatestCut/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /visitor-pressure-cut/);
  assert.match(style, /min-height: 44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D');
  assert.match(metrics.memoryRule, /cut|ridge|plate/i);
  assert.equal(critiques.length, 4);
});

test('brush v016 is the unique 2026-09-22 daily work with a canonical page', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'brush' && work.date === '2026-09-22');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'brush-2026-09-22');
  assert.equal(work.rawPath, '/studies/p5-brush/v016/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.source.referenceId, 'p5-brush');
  assert.match(work.browserEvidence.status, /^local and production headless browser matrices passed/);
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-22');
  assert.equal(work.decision.lineage, 'brush-2026-09-21');

  const canonical = await read('works/brush-2026-09-22/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-22"/);
});
