import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engine = await import('../studies/pure-svg/v049/engine.mjs');

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('SVG v049 starts as a deterministic field of paired marks and empty corridors', () => {
  const first = engine.buildFrame();
  const second = engine.buildFrame();

  assert.equal(first.grammar, 'paired-gaps');
  assert.equal(first.marks.length, 8);
  assert.equal(first.pairs.length, engine.PAIR_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.cuts.length, 0);
  assert.equal(engine.geometrySignature(first), engine.geometrySignature(second));
  assert.deepEqual(engine.corridorPoint(0, -1), { x: 274, y: 326 });
});

test('SVG v049 keeps a proximity pass inert until it crosses a corridor without touching a mark', () => {
  const initial = engine.buildFrame();
  const started = engine.beginPass(initial, 0, -1);
  const waiting = engine.movePass(started, engine.corridorPoint(0, -1));
  assert.equal(waiting.interaction, 'pass-entered');
  assert.equal(engine.geometrySignature(waiting), engine.geometrySignature(initial));

  const crossed = engine.movePass(waiting, engine.corridorPoint(0, 1));
  const committed = engine.commitPass(crossed);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.cuts.length, 1);
  assert.equal(committed.interaction, 'pass-committed');
  assert.equal(committed.memory[0].type, 'gap-spent');
  assert.notEqual(engine.geometrySignature(committed), engine.geometrySignature(initial));
  assert.notEqual(committed.marks[0].signature, initial.marks[0].signature);
  assert.notEqual(committed.marks[1].signature, initial.marks[1].signature);
});

test('SVG v049 refuses a same-side pass and a mark collision without spending geometry', () => {
  const initial = engine.buildFrame();
  const sameSide = engine.completePass(initial, 0, -1, -1);
  assert.equal(sameSide.memory.length, 0);
  assert.equal(sameSide.interaction, 'pass-refused-same-side');
  assert.equal(engine.geometrySignature(sameSide), engine.geometrySignature(initial));

  const started = engine.beginPass(initial, 0, -1);
  const collision = engine.movePass(started, engine.markPoint(0));
  assert.equal(collision.memory.length, 0);
  assert.equal(collision.interaction, 'pass-refused-mark');
  assert.equal(engine.geometrySignature(collision), engine.geometrySignature(initial));
});

test('SVG v049 compounds four paired cuts and lifts the exact preceding field', () => {
  const timeline = engine.buildTimeline();
  const final = timeline.at(-1);
  const lifted = engine.liftLatest(final);

  assert.equal(timeline.length, engine.MEMORY_WINDOW + 1);
  assert.equal(final.memory.length, engine.MEMORY_WINDOW);
  assert.equal(final.cuts.length, engine.MEMORY_WINDOW);
  assert.equal(new Set(final.memory.map((event) => event.pair)).size, engine.PAIR_COUNT);
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.deepEqual(lifted.memory, timeline.at(-2).memory);
  assert.equal(engine.releaseField().memory.length, 0);
  assert.equal(engine.geometrySignature(engine.releaseField()), engine.geometrySignature(engine.buildFrame()));
});

test('SVG v049 publishes a tableau-first corridor work with a blind preview contract', async () => {
  const [index, sketch, style, readme, metrics, canonical, register] = await Promise.all([
    read('studies/pure-svg/v049/index.html'),
    read('studies/pure-svg/v049/sketch.js'),
    read('studies/pure-svg/v049/style.css'),
    read('studies/pure-svg/v049/README.md'),
    read('studies/pure-svg/v049/metrics.json'),
    read('works/svg-2026-11-11/index.html'),
    read('studio/data/works.json')
  ]);

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="pass"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /params\.get\('blind'\) === '1'/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /beginPass/);
  assert.match(sketch, /commitPass/);
  assert.match(sketch, /<mask|createElementNS/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /Hypothesis/);
  assert.match(readme, /Changed rule/);
  assert.match(readme, /Visible consequence/);
  assert.match(readme, /Falsifier/);
  assert.match(readme, /Deletion condition/);
  assert.equal(JSON.parse(metrics).replay, true);
  assert.equal(JSON.parse(metrics).grammar, 'paired-gaps');
  const works = JSON.parse(register).works.filter((work) => work.id === 'svg-2026-11-11');
  assert.equal(works.length, 1);
  assert.equal(works[0].rawPath, '/studies/pure-svg/v049/');
  assert.equal(works[0].status, 'candidate / held');
  assert.equal(works[0].source.referenceId, 'little-critters');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-11"/);
});
