import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/p5-brush/v048/engine.mjs');
const {
  BAND_COUNT,
  BLOOM_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyStroke,
  beginStroke,
  buildFrame,
  buildTimeline,
  finishStroke,
  gatePoint,
  geometrySignature,
  liftLatest,
  moveStroke,
  releaseField
} = engine;

function validStroke(frame, startGate = 0) {
  const points = [
    gatePoint(frame, startGate),
    gatePoint(frame, 1),
    gatePoint(frame, 2),
    { x: 0.94, y: 0.5 }
  ];
  let next = beginStroke(frame, points[0]);
  for (const point of points.slice(1, -1)) next = moveStroke(next, point);
  return finishStroke(next, points.at(-1));
}

test('brush v048 begins as a deterministic remote-regrowth wash', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'remote-regrowth-wash');
  assert.equal(first.renderer, 'deterministic p5.js 1.11.3 Canvas 2D remote-regrowth wash');
  assert.equal(first.memory.length, 0);
  assert.equal(first.memoryLimit, MEMORY_LIMIT);
  assert.equal(first.body.bands.length, BAND_COUNT);
  assert.equal(first.body.blooms.length, BLOOM_COUNT);
  assert.equal(first.body.gates.length, 3);
  assert.ok(first.body.bands.every((band) => band.path.length > 4 && band.weight > 0));
  assert.equal(geometrySignature(first), geometrySignature(second));

  const preview = beginStroke(first, gatePoint(first, 0));
  assert.equal(geometrySignature(preview), geometrySignature(first));
});

test('brush v048 spends only an ordered three-gate stroke and regrows an untouched remote bloom', () => {
  const initial = buildFrame();
  const committed = validStroke(initial);
  const receiver = committed.event.receiverBloom;

  assert.equal(committed.interaction, 'stroke-committed');
  assert.equal(committed.event.type, 'remote-regrowth');
  assert.equal(committed.memory.length, 1);
  assert.deepEqual(committed.body.bands, initial.body.bands);
  assert.deepEqual(committed.body.gates, initial.body.gates);
  assert.notDeepEqual(committed.body.blooms[receiver], initial.body.blooms[receiver]);
  assert.deepEqual(
    committed.body.blooms.filter((bloom) => bloom.id !== receiver),
    initial.body.blooms.filter((bloom) => bloom.id !== receiver)
  );
  assert.equal(committed.pending.active, false);
});

test('brush v048 refuses a wrong-order or incomplete stroke without changing the wash', () => {
  const initial = buildFrame();
  const started = beginStroke(initial, gatePoint(initial, 0));
  const wrongOrder = finishStroke(moveStroke(started, gatePoint(initial, 2)), { x: 0.94, y: 0.5 });
  const incomplete = finishStroke(moveStroke(started, gatePoint(initial, 1)), { x: 0.55, y: 0.45 });
  const wrongStart = beginStroke(initial, { x: 0.5, y: 0.5 });

  assert.equal(wrongOrder.interaction, 'stroke-refused-order');
  assert.equal(incomplete.interaction, 'stroke-refused-incomplete');
  assert.equal(wrongStart.interaction, 'stroke-refused-start');
  assert.equal(geometrySignature(wrongOrder), geometrySignature(initial));
  assert.equal(geometrySignature(incomplete), geometrySignature(initial));
  assert.equal(geometrySignature(wrongStart), geometrySignature(initial));
  assert.equal(wrongOrder.memory.length, 0);
});

test('brush v048 compounds four regrowths, lifts exactly, and releases to the deterministic seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.state.regrowthCount, MEMORY_LIMIT);
  assert.equal(new Set(settled.memory.map((event) => event.receiverBloom)).size, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.deepEqual(buildTimeline(), timeline);
});

test('brush v048 exposes the browser, archive, and anti-copy contract', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/p5-brush/v048/index.html',
    'studies/p5-brush/v048/sketch.js',
    'studies/p5-brush/v048/style.css',
    'studies/p5-brush/v048/README.md',
    'studies/p5-brush/v048/metrics.json',
    'studies/p5-brush/v048/critiques.json',
    'works/brush-2026-11-05/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/p5-brush/v048/index.html');
  const sketch = await read('studies/p5-brush/v048/sketch.js');
  const style = await read('studies/p5-brush/v048/style.css');
  const readme = await read('studies/p5-brush/v048/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v048/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v048/critiques.json'));
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-05');

  assert.match(html, /id="wash-field"/);
  assert.match(html, /data-gesture="press"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginStroke/);
  assert.match(sketch, /finishStroke/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523438');
  assert.equal(metrics.grammar, 'remote-regrowth-wash');
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-05');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v048/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  const canonical = await read('works/brush-2026-11-05/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-05"/);
});
