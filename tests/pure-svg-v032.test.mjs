import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const engineUrl = '../studies/pure-svg/v032/engine.mjs';

test('Pure SVG v032 starts as a deterministic constellation of independent cut facets', async () => {
  const { buildFrame, FACET_COUNT, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'enclosed-facets');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.facets.length, FACET_COUNT);
  assert.equal(frame.facets.every((facet) => facet.pathSignature.startsWith('M')), true);
  assert.equal(frame.facets.every((facet) => facet.role === 'facet'), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Pure SVG v032 refuses an open or too-small loop without changing geometry', async () => {
  const { applyLoop, buildFrame, geometrySignature } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const short = applyLoop(baseline, [{ x: 0.4, y: 0.4 }, { x: 0.45, y: 0.42 }]);
  const open = applyLoop(baseline, [
    { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 0.65, y: 0.6 }, { x: 0.3, y: 0.6 }
  ]);

  assert.equal(short.interaction, 'loop-refused-short');
  assert.equal(open.interaction, 'loop-refused-open');
  assert.equal(short.memory.length, 0);
  assert.equal(open.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(baseline));
  assert.equal(geometrySignature(open), geometrySignature(baseline));
});

test('Pure SVG v032 turns a closed winding into a collective facet reorientation', async () => {
  const { applyLoop, buildFrame, geometrySignature } = await import(engineUrl);
  const baseline = buildFrame(0, []);
  const loop = [
    { x: 0.28, y: 0.28 }, { x: 0.68, y: 0.3 }, { x: 0.72, y: 0.66 },
    { x: 0.32, y: 0.7 }, { x: 0.28, y: 0.28 }
  ];
  const result = applyLoop(baseline, loop);

  assert.equal(result.interaction, 'loop-enclosed');
  assert.equal(result.memory.length, 1);
  assert.equal(result.event.committed, true);
  assert.match(result.event.winding, /clockwise|counterclockwise/);
  assert.equal(result.event.affected.length, 4);
  assert.notEqual(result.event.pivot, result.event.silent);
  assert.notEqual(geometrySignature(result), geometrySignature(baseline));
  for (const id of result.event.affected) {
    assert.notEqual(result.facets[id].pathSignature, baseline.facets[id].pathSignature);
  }
  assert.notEqual(result.facets[result.event.silent].pathSignature, baseline.facets[result.event.silent].pathSignature);
});

test('Pure SVG v032 keeps a bounded loop memory and lifts the exact prior constellation', async () => {
  const { applyLoop, buildFrame, buildTimeline, geometrySignature, liftLatestLoop, releaseConstellation, MEMORY_WINDOW } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const loops = [
    [{ x: 0.25, y: 0.25 }, { x: 0.7, y: 0.27 }, { x: 0.7, y: 0.68 }, { x: 0.25, y: 0.68 }, { x: 0.25, y: 0.25 }],
    [{ x: 0.72, y: 0.22 }, { x: 0.82, y: 0.44 }, { x: 0.64, y: 0.62 }, { x: 0.56, y: 0.38 }, { x: 0.72, y: 0.22 }],
    [{ x: 0.18, y: 0.5 }, { x: 0.38, y: 0.26 }, { x: 0.54, y: 0.54 }, { x: 0.32, y: 0.76 }, { x: 0.18, y: 0.5 }]
  ];
  frame = applyLoop(frame, loops[0]);
  const first = frame;
  frame = applyLoop(frame, loops[1]);
  const second = frame;
  frame = applyLoop(frame, loops[2]);
  const third = frame;
  const lifted = liftLatestLoop(third);
  const released = releaseConstellation();
  const settled = buildTimeline().at(-1);

  assert.equal(first.memory.length, 1);
  assert.equal(second.memory.length, 2);
  assert.equal(third.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(lifted), geometrySignature(second));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame(0, [])));
  assert.equal(settled.memory.length, MEMORY_WINDOW);
});

test('Pure SVG v032 exposes pointer, keyboard, reduced-motion, and preview paths', async () => {
  const tableau = await read('studies/pure-svg/v032/index.html');
  const sketch = await read('studies/pure-svg/v032/sketch.js');
  const style = await read('studies/pure-svg/v032/style.css');
  const readme = await read('studies/pure-svg/v032/README.md');
  const metrics = JSON.parse(await read('studies/pure-svg/v032/metrics.json'));
  const critiques = JSON.parse(await read('studies/pure-svg/v032/critiques.json'));

  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="loop"/);
  assert.match(tableau, /data-gesture="lift"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /Escape|toLowerCase\(\) === 'r'/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width:680px\)/);
  assert.match(readme, /falsifier/i);
  assert.equal(metrics.seed, '0x53564732');
  assert.equal(metrics.grammar, 'enclosed-facets');
  assert.equal(critiques.length, 6);
});

test('Pure SVG v032 is registered exactly once for the 2026-10-20 daily slot', async () => {
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-20');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-20');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v032/');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-20');

  const canonical = await read('works/svg-2026-10-20/index.html');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-20"/);
});
