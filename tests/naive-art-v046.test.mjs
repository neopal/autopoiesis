import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/naive-art/v046/engine.mjs');
const {
  ECHO_THRESHOLD_MS,
  MEMORY_LIMIT,
  THROAT_COUNT,
  beginStillness,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseStillness,
  releaseMemory,
  tickStillness
} = engine;

test('naive v046 starts as a deterministic suspended echo vessel', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'stillness-echo-vessel');
  assert.equal(first.surface, 'p5-webgl-suspended-vessel');
  assert.equal(first.memory.length, 0);
  assert.equal(first.memoryLimit, MEMORY_LIMIT);
  assert.equal(first.body.throats.length, THROAT_COUNT);
  assert.equal(first.body.echoes.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));

  const armed = beginStillness(first, 0);
  assert.equal(armed.pending.active, true);
  assert.equal(armed.pending.throat, 0);
  assert.equal(geometrySignature(armed), geometrySignature(first));
});

test('naive v046 only commits a still held attention and keeps the attended throat exact', () => {
  const initial = buildFrame();
  const armed = beginStillness(initial, 1);
  const held = tickStillness(armed, ECHO_THRESHOLD_MS, 0);
  const committed = releaseStillness(held);

  assert.equal(committed.interaction, 'stillness-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'misheard-echo');
  assert.equal(committed.event.sourceThroat, 1);
  assert.notEqual(committed.event.targetThroat, 1);
  assert.equal(committed.body.echoes.length, 1);
  assert.deepEqual(committed.body.throats[1], initial.body.throats[1]);
  assert.notDeepEqual(committed.body.throats[committed.event.targetThroat], initial.body.throats[committed.event.targetThroat]);

  const moved = releaseStillness(tickStillness(beginStillness(initial, 1), ECHO_THRESHOLD_MS - 1, 0.14));
  assert.equal(moved.interaction, 'stillness-refused-motion');
  assert.equal(moved.memory.length, 0);
  assert.equal(geometrySignature(moved), geometrySignature(initial));

  const short = releaseStillness(tickStillness(beginStillness(initial, 2), ECHO_THRESHOLD_MS - 1, 0));
  assert.equal(short.interaction, 'stillness-refused-short');
  assert.equal(short.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(initial));
});

test('naive v046 compounds four misheard echoes, lifts exactly, and releases to the seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseMemory(settled);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.body.echoes.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.deepEqual(buildTimeline(), timeline);
});

test('naive v046 exposes a tableau-first browser and archive contract', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/naive-art/v046/index.html',
    'studies/naive-art/v046/sketch.js',
    'studies/naive-art/v046/style.css',
    'studies/naive-art/v046/README.md',
    'studies/naive-art/v046/metrics.json',
    'studies/naive-art/v046/critiques.json',
    'works/naive-2026-11-07/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/naive-art/v046/index.html');
  const sketch = await read('studies/naive-art/v046/sketch.js');
  const style = await read('studies/naive-art/v046/style.css');
  const readme = await read('studies/naive-art/v046/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v046/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v046/critiques.json'));

  assert.match(html, /id="echo-field"/);
  assert.match(html, /data-action="listen"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-raw-work-id="naive-2026-11-07"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /releaseStillness/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x4e413436');
  assert.equal(metrics.grammar, 'stillness-echo-vessel');
  assert.equal(metrics.referenceId, 'little-critters');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('naive v046 has exactly one dated naive record with source translation', async () => {
  const register = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-07');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-11-07');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v046/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].source.translatedRule, /stillness|echo|attention/i);
});
