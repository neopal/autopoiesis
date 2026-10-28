import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v040/engine.mjs');

const {
  FRAGMENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyLift,
  buildFrame,
  buildTimeline,
  commitLift,
  geometrySignature,
  liftLatest,
  previewLift,
  releaseField
} = engine;

const START = { x: 0.48, y: 0.42 };
const EXIT = { x: 0.44, y: 0.08 };

 test('brush v040 begins as a deterministic settling archive of irregular material fragments', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'settling-archive');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.fragments.length, FRAGMENT_COUNT);
  assert.equal(initial.renderer, 'deterministic p5.js Canvas 2D settling archive');
  assert.equal(geometrySignature(initial), geometrySignature(replay));
  assert.ok(initial.fragments.some((fragment) => fragment.mass > 0.7));
});

test('brush v040 previews a lift without changing the produced archive', () => {
  const initial = buildFrame();
  const preview = previewLift(initial, START, EXIT);

  assert.equal(preview.interaction, 'lift-preview');
  assert.equal(preview.memory.length, 0);
  assert.equal(preview.pending.fragment, 5);
  assert.deepEqual(preview.pending.start, START);
  assert.equal(geometrySignature(preview), geometrySignature(initial));
});

test('brush v040 converts an upward lift into a remembered absence and settling event', () => {
  const initial = buildFrame();
  const changed = commitLift(initial, START, EXIT, 'test-upward-lift');

  assert.equal(changed.interaction, 'absence-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.type, 'lifted-absence');
  assert.equal(changed.event.fragment, 5);
  assert.ok(changed.removed.includes(5));
  assert.equal(changed.removedCount, 1);
  assert.ok(changed.fragments.some((fragment) => fragment.id === 5 && fragment.removed));
  assert.ok(changed.fragments.some((fragment) => fragment.id !== 5 && fragment.settle > 0));
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v040 refuses a weak or downward lift exactly', () => {
  const initial = buildFrame();
  const weak = commitLift(initial, { x: 0.02, y: 0.02 }, EXIT, 'test-miss');
  const downward = commitLift(initial, START, { x: 0.46, y: 0.62 }, 'test-downward');

  assert.equal(weak.interaction, 'lift-refused-miss');
  assert.equal(downward.interaction, 'lift-refused-direction');
  assert.equal(weak.memory.length, 0);
  assert.equal(downward.memory.length, 0);
  assert.equal(geometrySignature(weak), geometrySignature(initial));
  assert.equal(geometrySignature(downward), geometrySignature(initial));
});

test('brush v040 lifts the latest settled fragment exactly and release returns to the quiet archive', () => {
  const initial = buildFrame();
  const changed = applyLift(initial, 5, 'test-lift');
  const lifted = liftLatest(changed);

  assert.equal(changed.memory.length, 1);
  assert.equal(lifted.interaction, 'lifted');
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releaseField(changed).memory.length, 0);
  assert.equal(releaseField(changed).interaction, 'released');
});

test('brush v040 bounds settling memory to four deterministic absences', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.equal(settled.removedCount, 4);
  assert.ok(settled.fragments.some((fragment) => fragment.settle > 0));
});

test('brush v040 exposes a p5 canvas lift encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v040/index.html');
  const sketch = await read('studies/p5-brush/v040/sketch.js');
  const style = await read('studies/p5-brush/v040/style.css');
  const readme = await read('studies/p5-brush/v040/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v040/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v040/critiques.json'));

  assert.match(html, /id="settling-canvas"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /commitLift/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523430');
  assert.equal(metrics.grammar, 'settling-archive');
  assert.equal(metrics.renderer, 'deterministic p5.js Canvas 2D settling archive');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v040 is registered exactly once for the 2026-10-28 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-28');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-28');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v040/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-28');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-27');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /lift|absence|settle|gravity/i);
  const canonical = await readFile(new URL('works/brush-2026-10-28/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-28"/);
});
