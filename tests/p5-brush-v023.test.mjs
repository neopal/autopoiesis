import test from 'node:test';
import assert from 'node:assert/strict';


test('brush v023 witness departure changes actual SVG station geometry and lifts exactly', async () => {
  const { buildFrame, applyWitnessDeparture, liftLatestWitness, geometrySignature } = await import('../studies/p5-brush/v023/engine.mjs');
  const baseline = buildFrame(4, []);
  const changed = applyWitnessDeparture(baseline, { station: 2, source: 'visitor-departure' });
  const lifted = liftLatestWitness(changed);

  assert.equal(baseline.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'witness-departure');
  assert.ok(changed.stations[2].notch > baseline.stations[2].notch);
  assert.ok(changed.stations[2].aversion > baseline.stations[2].aversion);
  assert.ok(changed.stations.slice(3).some((station, index) => station.x !== baseline.stations[index + 3].x || station.y !== baseline.stations[index + 3].y));
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.equal(geometrySignature(lifted), geometrySignature(baseline));
});


test('brush v023 turns away from a repeated witness and keeps bounded departure memory', async () => {
  const { buildFrame, applyWitnessDeparture } = await import('../studies/p5-brush/v023/engine.mjs');
  const baseline = buildFrame(3, []);
  const first = applyWitnessDeparture(baseline, { station: 1 });
  const repeat = applyWitnessDeparture(first, { station: 1 });
  const second = applyWitnessDeparture(first, { station: 5 });
  const replay = applyWitnessDeparture(baseline, { station: 1 });

  assert.equal(repeat.interaction, 'witness-refused');
  assert.equal(repeat.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.ok(second.memory.every((event) => event.kind === 'witness-departure'));
  assert.deepEqual(first, replay);
  assert.ok(second.memory.length <= 4);
});


test('brush v023 raw tableau exposes reciprocal witness geometry before explanation', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const html = await read('studies/p5-brush/v023/index.html');
  const sketch = await read('studies/p5-brush/v023/sketch.js');
  const style = await read('studies/p5-brush/v023/style.css');

  assert.match(html, /id="witness-field"/);
  assert.match(html, /id="watch-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /data-raw-work-id="brush-2026-10-03"/);
  assert.match(html, /classList\.add\('interactive-preview'\)/);
  assert.match(sketch, /applyWitnessDeparture/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /touch-action: none/);
});


test('brush v023 records the art gate, little-critters translation, and canonical daily work', async () => {
  const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const readme = await read('studies/p5-brush/v023/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v023/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v023/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/brush-2026-10-03/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x42525543');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /witness|aversion|notch/i);
  assert.match(metrics.interactionRule, /proximity|departure|leave/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'brush' && entry.date === '2026-10-03');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'brush-2026-10-03');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/p5-brush/v023/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /witness|attention|aversion|paint/i);
  assert.equal(work.journal.anchor, 'journal-brush-2026-10-03');
  assert.equal(work.decision.lineage, 'brush-2026-10-02');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-03"/);
});
