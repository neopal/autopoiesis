import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');


test('brush v010 turns a remembered removal into a signed hinge-curl route', async () => {
  const { buildFrame, buildTimeline } = await import('../studies/p5-brush/v010/engine.mjs');
  const frame = buildTimeline().at(-1);
  const plain = buildFrame(frame.stage, []);
  const curled = buildFrame(frame.stage, frame.memory);

  assert.equal(frame.memory.length, 8);
  assert.ok(frame.strokes.some((stroke) => stroke.hingeAmplitude > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.curlMass > 0));
  assert.ok(frame.strokes.some((stroke) => stroke.tailDrift !== plain.strokes[stroke.index].tailDrift));
  assert.ok(frame.deltas.every((delta) => delta.rule === 'hinge-curl'));
  assert.ok(curled.strokes.some((stroke) => stroke.hingeExitError < 0.1));
});


test('brush v010 raw tableau exposes a reversible hinge-curl action before its explanation', async () => {
  const html = await readFile(new URL('../studies/p5-brush/v010/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../studies/p5-brush/v010/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/p5-brush/v010/style.css', import.meta.url), 'utf8');

  assert.match(html, /<figure class="brush-work artwork-frame"/);
  assert.match(html, /id="make-hinge-curl"/);
  assert.match(html, /id="lift-hinge-curl"/);
  assert.match(html, /id="release-sequence"/);
  assert.match(html, /data-raw-work-id="brush-2026-09-12"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyRemoval/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
});


test('brush v010 records its art gate and canonical daily work', async () => {
  const readme = await read('studies/p5-brush/v010/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v010/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v010/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-09-12/index.html');

  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525530');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.interactionRule.includes('hinge'), true);
  assert.equal(critiques.length, 4);
  const work = data.works.find((entry) => entry.id === 'brush-2026-09-12');
  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-09-12');
  assert.equal(work.rawPath, '/studies/p5-brush/v010/');
  assert.equal(work.journal.anchor, 'journal-brush-2026-09-12');
  assert.equal(work.decision.lineage, 'brush-2026-09-11');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-09-12"/);
});
