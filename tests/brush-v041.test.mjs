import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v041/engine.mjs');

const {
  MEMORY_LIMIT,
  STAGES,
  SURFACE_COLS,
  SURFACE_ROWS,
  applyWitness,
  buildFrame,
  buildTimeline,
  commitWitness,
  geometrySignature,
  previewWitness,
  releaseField,
  liftLatest
} = engine;

const OFFER = { x: 0.18, y: 0.32 };
const DEPART = { x: 0.78, y: 0.64 };

 test('brush v041 begins as one deterministic backface membrane', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'backface-membrane');
  assert.equal(initial.renderer, 'deterministic p5.js WEBGL relief membrane');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.surface.length, SURFACE_COLS * SURFACE_ROWS);
  assert.equal(initial.zones.length, 7);
  assert.equal(geometrySignature(initial), geometrySignature(replay));
  assert.ok(initial.surface.some((sample) => sample.z > 0.04));
});

test('brush v041 previews reciprocal attention without changing the membrane', () => {
  const initial = buildFrame();
  const preview = previewWitness(initial, OFFER, DEPART);

  assert.equal(preview.interaction, 'attention-preview');
  assert.equal(preview.memory.length, 0);
  assert.notEqual(preview.pending.offerZone, null);
  assert.notEqual(preview.pending.departureZone, null);
  assert.notEqual(preview.pending.offerZone, preview.pending.departureZone);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v041 turns a separated visit into a remote backface event', () => {
  const initial = buildFrame();
  const changed = commitWitness(initial, OFFER, DEPART, 'test-reciprocal-visit');

  assert.equal(changed.interaction, 'backface-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'remote-backface');
  assert.notEqual(changed.event.offerZone, changed.event.departureZone);
  assert.notEqual(changed.event.answerZone, changed.event.offerZone);
  assert.notEqual(changed.event.answerZone, changed.event.departureZone);
  assert.ok(changed.zones[changed.event.answerZone].backface > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v041 refuses a miss or a near self-visit exactly', () => {
  const initial = buildFrame();
  const miss = commitWitness(initial, { x: 0.02, y: 0.02 }, DEPART, 'test-miss');
  const near = commitWitness(initial, OFFER, { x: 0.20, y: 0.35 }, 'test-near');

  assert.equal(miss.interaction, 'attention-refused-miss');
  assert.equal(near.interaction, 'attention-refused-near');
  assert.equal(miss.memory.length, 0);
  assert.equal(near.memory.length, 0);
  assert.equal(geometrySignature(miss), geometrySignature(initial));
  assert.equal(geometrySignature(near), geometrySignature(initial));
});

test('brush v041 lifts the latest remote answer exactly and release returns to quiet membrane', () => {
  const initial = buildFrame();
  const changed = applyWitness(initial, 0, 4, 'test-direct');
  const lifted = liftLatest(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(lifted.interaction, 'lifted');
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releaseField(changed).interaction, 'released');
  assert.equal(releaseField(changed).memory.length, 0);
});

test('brush v041 compounds four reciprocal backfaces deterministically', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.equal(settled.zones.filter((zone) => zone.backface > 0).length, 7);
  assert.ok(settled.surface.some((sample) => sample.backface > 0));
});

test('brush v041 exposes a WEBGL reciprocal encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v041/index.html');
  const sketch = await read('studies/p5-brush/v041/sketch.js');
  const style = await read('studies/p5-brush/v041/style.css');
  const readme = await read('studies/p5-brush/v041/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v041/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v041/critiques.json'));

  assert.match(html, /id="membrane-canvas"/);
  assert.match(html, /data-gesture="witness"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523431');
  assert.equal(metrics.grammar, 'backface-membrane');
  assert.equal(metrics.renderer, 'deterministic p5.js WEBGL relief membrane');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v041 is registered exactly once for the 2026-10-29 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-29');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-29');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v041/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-29');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-28');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].metrics.changedRule, /backface|attention|reciprocal|membrane/i);
  const canonical = await readFile(new URL('works/brush-2026-10-29/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-29"/);
});
