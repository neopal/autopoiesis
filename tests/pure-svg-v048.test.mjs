import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  DRAG_THRESHOLD,
  GATE_COUNT,
  buildFrame,
  buildTimeline,
  commitDrag,
  completeDrag,
  geometrySignature,
  gateAtPoint,
  gatePoint,
  liftLatest,
  moveDrag,
  releaseSeal,
  beginDrag
} = await import('../studies/pure-svg/v048/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SVG v048 starts as one deterministic compound winding seal with three gates', () => {
  const frame = buildFrame();
  assert.equal(frame.grammar, 'winding-seal');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.apertures.length, 3);
  assert.equal(frame.apertures.filter((aperture) => aperture.winding === -1).length, 3);
  assert.match(frame.compoundPath, /Z/);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame()));
  assert.equal(gateAtPoint(frame, gatePoint(1)), 1);
});

test('SVG v048 refuses a short or wrong-direction draw before geometry changes', () => {
  const frame = beginDrag(buildFrame(), 0);
  const moved = moveDrag(frame, { x: 300, y: 540 });
  const short = commitDrag(moved, 1);
  assert.equal(short.memory.length, 0);
  assert.equal(short.interaction, 'draw-refused-short');
  assert.equal(geometrySignature(short), geometrySignature(buildFrame()));

  const complete = completeDrag(buildFrame(), 0, 2, DRAG_THRESHOLD + 1);
  assert.equal(complete.memory.length, 0);
  assert.equal(complete.interaction, 'draw-refused-order');
});

test('SVG v048 turns a valid cross-seal draw into actual winding topology', () => {
  const quiet = buildFrame();
  const changed = completeDrag(quiet, 0, 1, DRAG_THRESHOLD + 40);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].type, 'winding-inversion');
  assert.notEqual(changed.apertures[0].winding, quiet.apertures[0].winding);
  assert.notEqual(changed.compoundPath, quiet.compoundPath);
  assert.equal(changed.state.inversionCount, 1);
  assert.equal(changed.state.lastRoute, '0→1');
});

test('SVG v048 compounds four inversions and lifts the exact previous topology', () => {
  const timeline = buildTimeline();
  const final = timeline.at(-1);
  assert.equal(final.memory.length, 4);
  assert.equal(final.state.inversionCount, 4);
  assert.equal(new Set(final.memory.map((event) => event.aperture)).size, 3);
  const restored = liftLatest(final);
  assert.equal(geometrySignature(restored), geometrySignature(timeline.at(-2)));
  assert.deepEqual(restored.memory, timeline.at(-2).memory);
  assert.deepEqual(restored.state, timeline.at(-2).state);
  assert.deepEqual(releaseSeal(), buildFrame());
});

test('SVG v048 exposes tableau-first responsive interaction contracts', async () => {
  const [index, sketch, style, canonical, readme] = await Promise.all([
    read('studies/pure-svg/v048/index.html'),
    read('studies/pure-svg/v048/sketch.js'),
    read('studies/pure-svg/v048/style.css'),
    read('works/svg-2026-11-08/index.html'),
    read('studies/pure-svg/v048/README.md')
  ]);
  assert.match(index, /<svg[^>]+id="seal"/);
  assert.match(index, /data-gesture="draw"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /params\.get\('blind'\) === '1'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /completeDrag/);
  assert.match(sketch, /title\.textContent/);
  assert.match(sketch, /liftLatest/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.seal-controls \{ position: static;/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-08"/);
  assert.match(readme, /Deletion condition/);
});

test('SVG v048 work record is the one current/date entry and uses p5.brush translation', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'svg-2026-11-08');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'svg');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v048/');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /winding/i);
  assert.equal(matches[0].status, 'candidate / held');
});
