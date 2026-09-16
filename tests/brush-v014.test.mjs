import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v014 turns a remembered removal into a tide mark that pools, spills, and shears later routes', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v014/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);

  assert.equal(frame.memory.length, 8);
  assert.ok(frame.strokes.some((stroke) => stroke.poolMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.spillMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.delayMass > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.downstreamShift > 0.01));
  assert.ok(frame.strokes.some((stroke) => stroke.points.some((point) => point.tide > 0.35)));
  assert.ok(frame.strokes.some((stroke) => stroke.points.some((point) => point.x > 0.7 && point.y !== plain.strokes[stroke.index].points.find((candidate) => candidate.x === point.x)?.y)));
});


test('brush v014 visitor tide marks are bounded, deterministic, and exactly reversible', async () => {
  const { buildFrame, applyTideMark, removeLatestTideMark } = await import('../studies/p5-brush/v014/engine.mjs');
  const frame = buildFrame(9, []);
  const edge = applyTideMark(frame, { x: 99, y: -20 });
  const changed = applyTideMark(frame, { x: 0.71, y: 0.44 });
  const repeat = applyTideMark(frame, { x: 0.71, y: 0.44 });
  const lifted = removeLatestTideMark(changed);

  assert.equal(edge.memory[0].point.x, 0.94);
  assert.equal(edge.memory[0].point.y, 0.08);
  assert.equal(changed.memory[0].source, 'visitor-tide-mark');
  assert.equal(changed.memory[0].rule, 'tide-mark');
  assert.deepEqual(changed, repeat);
  assert.ok(changed.strokes.some((stroke) => stroke.maxPool > 0.35 && stroke.maxSpill > 0.35 && stroke.maxDelay > 0.2));
  assert.deepEqual(lifted, { ...frame, interaction: 'tide-mark-lifted' });
});


test('brush v014 carries the tide mark as a measurable crest and downstream tail', async () => {
  const { buildFrame, applyTideMark } = await import('../studies/p5-brush/v014/engine.mjs');
  const changed = applyTideMark(buildFrame(6, []), { x: 0.34, y: 0.52 });

  assert.ok(changed.strokes.some((stroke) => stroke.poolPeak > 0.35));
  assert.ok(changed.strokes.some((stroke) => stroke.spillTail > 0.04));
  assert.ok(changed.strokes.some((stroke) => stroke.delayTail > 0.025));
});


test('brush v014 raw tableau exposes the tide-mark encounter before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v014/index.html');
  const sketch = await read('studies/p5-brush/v014/sketch.js');
  const style = await read('studies/p5-brush/v014/style.css');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-tide"/);
  assert.match(html, /id="lift-tide"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-16"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyTideMark/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /tide/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v014 records its art gate and canonical 2026-09-16 daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v014/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v014/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v014/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-16/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525534');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /tide mark/i);
  assert.match(metrics.interactionRule, /lift/i);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-16');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-16');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v014/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-16');
  assert.equal(work.decision.lineage, 'brush-2026-09-15');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-16"/);
});
