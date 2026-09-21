import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v015 turns a remembered removal into a basin that enters, settles, and climbs out', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v015/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);

  assert.equal(frame.memory.length, 8);
  assert.ok(frame.strokes.some((stroke) => stroke.basinMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.floorMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.lipMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.aftershockMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.downstreamShift > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.points.some((point) => point.basin > 0.35 && point.floor > 0.12)));
  assert.ok(frame.strokes.some((stroke) => stroke.points.some((point) => point.x > 0.7 && point.y !== plain.strokes[stroke.index].points.find((candidate) => candidate.x === point.x)?.y)));
});


test('brush v015 visitor basins are bounded, deterministic, and exactly reversible', async () => {
  const { buildFrame, applyBasinMark, removeLatestBasinMark } = await import('../studies/p5-brush/v015/engine.mjs');
  const frame = buildFrame(9, []);
  const edge = applyBasinMark(frame, { x: 99, y: -20 });
  const changed = applyBasinMark(frame, { x: 0.71, y: 0.44 });
  const repeat = applyBasinMark(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestBasinMark(changed);

  assert.equal(edge.memory[0].point.x, 0.94);
  assert.equal(edge.memory[0].point.y, 0.08);
  assert.equal(changed.memory[0].source, 'visitor-basin-mark');
  assert.equal(changed.memory[0].rule, 'basin-mark');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.maxBasin > 0.35 && stroke.maxFloor > 0.2 && stroke.maxLip > 0.2));
  assert.deepEqual(lifted, { ...frame, interaction: 'basin-mark-lifted' });
});


test('brush v015 carries a basin as a measurable floor and changed exit', async () => {
  const { buildFrame, applyBasinMark } = await import('../studies/p5-brush/v015/engine.mjs');
  const changed = applyBasinMark(buildFrame(6, []), { x: 0.34, y: 0.52 });

  assert.ok(changed.strokes.some((stroke) => stroke.floorPlateau > 0.04));
  assert.ok(changed.strokes.some((stroke) => stroke.lipTail > 0.025));
  assert.ok(changed.strokes.some((stroke) => stroke.aftershockTail > 0.025));
});


test('brush v015 raw tableau exposes the basin encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v015/index.html');
  const sketch = await read('studies/p5-brush/v015/sketch.js');
  const style = await read('studies/p5-brush/v015/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-basin"/);
  assert.match(html, /id="lift-basin"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-21"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyBasinMark/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /basin/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v015 records its art gate and canonical 2026-09-21 daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v015/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v015/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v015/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-21/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525535');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /basin/i);
  assert.match(metrics.interactionRule, /lift/i);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-21');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-21');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v015/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-21');
  assert.equal(work.decision.lineage, 'brush-2026-09-16');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-21"/);
});
