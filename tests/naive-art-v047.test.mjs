import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/naive-art/v047/engine.mjs');
const {
  buildFrame,
  beginCorrection,
  geometrySignature,
  PRESSURE_THRESHOLD,
  TRAVEL_THRESHOLD,
  tickCorrection,
  releaseCorrection,
  buildTimeline,
  liftLatest,
  releaseMemory
} = engine;

test('naive v047 starts as a deterministic misprint ledger and arms without spending material', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'misprint-ledger');
  assert.equal(first.surface, 'p5-canvas-proof-strip');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.slots.length, 9);
  assert.equal(first.body.misprints.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));

  const armed = beginCorrection(first, 2);
  assert.equal(armed.pending.active, true);
  assert.equal(armed.pending.sourceSlot, 2);
  assert.equal(geometrySignature(armed), geometrySignature(first));
});

test('naive v047 only releases a travelled correction into a different slot', () => {
  const initial = buildFrame();
  const armed = beginCorrection(initial, 2);
  const travelled = tickCorrection(armed, TRAVEL_THRESHOLD, PRESSURE_THRESHOLD);
  const committed = releaseCorrection(travelled);

  assert.equal(committed.interaction, 'correction-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'misprint');
  assert.equal(committed.event.sourceSlot, 2);
  assert.notEqual(committed.event.targetSlot, 2);
  assert.equal(committed.body.misprints.length, 1);
  assert.deepEqual(committed.body.slots[2], initial.body.slots[2]);
  assert.notDeepEqual(committed.body.slots[committed.event.targetSlot], initial.body.slots[committed.event.targetSlot]);

  const short = releaseCorrection(tickCorrection(beginCorrection(initial, 2), TRAVEL_THRESHOLD - 0.01, PRESSURE_THRESHOLD));
  assert.equal(short.interaction, 'correction-refused-short');
  assert.equal(short.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(initial));

  const weak = releaseCorrection(tickCorrection(beginCorrection(initial, 2), TRAVEL_THRESHOLD, PRESSURE_THRESHOLD - 0.01));
  assert.equal(weak.interaction, 'correction-refused-pressure');
  assert.equal(weak.memory.length, 0);
});

test('naive v047 compounds four wrong corrections, lifts exactly, and can forget the ledger', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseMemory(settled);

  assert.equal(timeline.length, 5);
  assert.equal(settled.memory.length, 4);
  assert.equal(settled.body.misprints.length, 4);
  assert.equal(lifted.memory.length, 3);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.deepEqual(buildTimeline(), timeline);
});

test('naive v047 exposes a tableau-first interaction and archive contract', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/naive-art/v047/index.html',
    'studies/naive-art/v047/sketch.js',
    'studies/naive-art/v047/style.css',
    'studies/naive-art/v047/README.md',
    'studies/naive-art/v047/metrics.json',
    'studies/naive-art/v047/critiques.json',
    'works/naive-2026-11-08/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/naive-art/v047/index.html');
  const sketch = await read('studies/naive-art/v047/sketch.js');
  const style = await read('studies/naive-art/v047/style.css');
  const readme = await read('studies/naive-art/v047/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v047/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v047/critiques.json'));

  assert.match(html, /id="proof-field"/);
  assert.match(html, /data-action="correct"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-raw-work-id="naive-2026-11-08"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /releaseCorrection/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x4e413437');
  assert.equal(metrics.grammar, 'misprint-ledger');
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('naive v047 is registered exactly once for the 2026-11-08 daily slot with p5.brush translation', async () => {
  const { readFile } = await import('node:fs/promises');
  const register = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-08');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-11-08');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v047/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].source.translatedRule, /correction|misprint|pressure/i);
  assert.match(matches[0].journal.note, /v047|misprint|correction/i);
});
