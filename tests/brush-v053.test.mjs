import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  CROSSING_LIMIT,
  NODE_COUNT,
  SEED,
  buildFrame,
  buildTimeline,
  commitPass,
  geometrySignature,
  liftLatest,
  releaseMembrane
} = await import('../studies/p5-brush/v053/engine.mjs');

test('brush v053 begins as a deterministic continuous tension membrane', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(SEED, 0x42523533);
  assert.equal(NODE_COUNT, 32);
  assert.equal(CROSSING_LIMIT, 4);
  assert.equal(first.composition, 'tension-membrane');
  assert.equal(first.renderer, 'canvas-2d');
  assert.equal(first.interaction, 'dry membrane');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.nodes.length, NODE_COUNT);
  assert.equal(first.body.seams.length, 7);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('brush v053 turns a settled edge-to-edge passage into global membrane geometry', () => {
  const quiet = buildFrame();
  const result = commitPass(quiet, { entry: 'west', exit: 'east', pressure: 0.76, settle: 0.82, arc: 0.28 });

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'pressure-crossing');
  assert.equal(result.event.entry, 'west');
  assert.equal(result.event.exit, 'east');
  assert.equal(result.field.memory.length, 1);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.body.nodes.every((node, index) => {
    const base = quiet.body.nodes[index];
    return node.x !== base.x || node.y !== base.y;
  }));
  assert.notDeepEqual(result.field.body.seams, quiet.body.seams);
});

test('brush v053 refuses a non-crossing or unsettled gesture without changing the membrane', () => {
  const quiet = buildFrame();
  const sameEdge = commitPass(quiet, { entry: 'west', exit: 'west', pressure: 0.8, settle: 0.9, arc: 0.3 });
  const unsettled = commitPass(quiet, { entry: 'north', exit: 'south', pressure: 0.8, settle: 0.12, arc: 0.2 });
  const short = commitPass(quiet, { entry: 'north', exit: 'east', pressure: 0.8, settle: 0.9, arc: 0.02 });

  assert.equal(sameEdge.accepted, false);
  assert.equal(unsettled.accepted, false);
  assert.equal(short.accepted, false);
  assert.equal(geometrySignature(sameEdge.field), geometrySignature(quiet));
  assert.equal(geometrySignature(unsettled.field), geometrySignature(quiet));
  assert.equal(geometrySignature(short.field), geometrySignature(quiet));
});

test('brush v053 makes passage order part of the drying geometry', () => {
  const forward = commitPass(commitPass(buildFrame(), { entry: 'west', exit: 'east', pressure: 0.76, settle: 0.82, arc: 0.28 }).field, { entry: 'north', exit: 'south', pressure: 0.64, settle: 0.78, arc: -0.22 }).field;
  const reverse = commitPass(commitPass(buildFrame(), { entry: 'north', exit: 'south', pressure: 0.64, settle: 0.78, arc: -0.22 }).field, { entry: 'west', exit: 'east', pressure: 0.76, settle: 0.82, arc: 0.28 }).field;

  assert.notEqual(geometrySignature(forward), geometrySignature(reverse));
  assert.deepEqual(forward.memory.map((event) => event.entry), ['west', 'north']);
  assert.deepEqual(reverse.memory.map((event) => event.entry), ['north', 'west']);
});

test('brush v053 compounds four crossings and lifts the exact preceding membrane', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, CROSSING_LIMIT + 1);
  assert.equal(latest.memory.length, CROSSING_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, CROSSING_LIMIT - 1);
  assert.equal(releaseMembrane().memory.length, 0);
  assert.equal(geometrySignature(releaseMembrane()), geometrySignature(buildFrame()));
});

test('brush v053 exposes a membrane tableau and non-hover passage paths', async () => {
  const html = await read('studies/p5-brush/v053/index.html');
  const sketch = await read('studies/p5-brush/v053/sketch.js');
  const style = await read('studies/p5-brush/v053/style.css');

  assert.match(html, /data-membrane-stage/);
  assert.match(html, /data-membrane-canvas/);
  assert.match(html, /data-gesture="pass"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitPass/);
  assert.match(sketch, /__mutineBrushV053/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('brush v053 has one canonical daily record and tableau route', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'brush-2026-11-10');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'brush');
  assert.equal(matches[0].date, '2026-11-10');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v053/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-brush-2026-11-10/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(matches[0].metrics.grammar, 'tension-membrane');
  const canonical = await read('works/brush-2026-11-10/index.html');
  assert.match(canonical, /data-work-id="brush-2026-11-10"/);
  assert.match(canonical, /catalog\.js/);
});

test('brush v053 records the art gate before the artwork is explained', async () => {
  const readme = await read('studies/p5-brush/v053/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v053/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v053/critiques.json'));

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.grammar, 'tension-membrane');
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.commitThreshold, 'edge-to-edge passage with settled pressure; same-edge, short, or unsettled paths refuse');
  assert.ok(critiques.some((critique) => critique.persona === 'Perceptual critic' && critique.status === 'unresolved'));
  assert.ok(critiques.some((critique) => critique.persona === 'Cynic' && critique.status === 'gate'));
});
