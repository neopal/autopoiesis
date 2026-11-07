import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/p5-brush/v050/engine.mjs');
const {
  ERASE_THRESHOLD,
  MEMORY_LIMIT,
  RIB_COUNT,
  armErase,
  applyErase,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseErase,
  releaseField,
  traceErase
} = engine;

test('brush v050 starts as a deterministic subtractive relief with fixed lift sites', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'subtractive-closure-relief');
  assert.equal(first.memory.length, 0);
  assert.equal(first.memoryLimit, MEMORY_LIMIT);
  assert.equal(first.body.ribs.length, RIB_COUNT);
  assert.equal(first.body.cutouts.length, 0);
  assert.equal(first.body.liftSites.length, 3);
  assert.equal(geometrySignature(first), geometrySignature(second));

  const armed = armErase(first, 0);
  assert.equal(armed.pending.active, true);
  assert.equal(armed.pending.site, 0);
  assert.equal(geometrySignature(armed), geometrySignature(first));
});

test('brush v050 commits only a reversed long lift into a real subtractive cutout', () => {
  const initial = buildFrame();
  const armed = armErase(initial, 0);
  const traced = traceErase(armed, ERASE_THRESHOLD + 0.1, true);
  const committed = releaseErase(traced);

  assert.equal(committed.interaction, 'erase-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'subtractive-cut');
  assert.equal(committed.event.site, 0);
  assert.equal(committed.body.cutouts.length, 1);
  assert.notDeepEqual(committed.body.ribs, initial.body.ribs);

  const short = releaseErase(traceErase(armErase(initial, 1), ERASE_THRESHOLD - 0.01, true));
  const oneWay = releaseErase(traceErase(armErase(initial, 1), ERASE_THRESHOLD + 0.1, false));
  const empty = releaseErase(initial);

  assert.equal(short.interaction, 'erase-refused-short');
  assert.equal(short.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(initial));
  assert.equal(oneWay.interaction, 'erase-refused-direction');
  assert.equal(oneWay.memory.length, 0);
  assert.equal(empty.interaction, 'erase-refused-empty');
});

test('brush v050 compounds four removals, lifts exactly, and releases to the seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.body.cutouts.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.deepEqual(buildTimeline(), timeline);
});

test('brush v050 exposes a tableau-first browser and archive contract', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/p5-brush/v050/index.html',
    'studies/p5-brush/v050/sketch.js',
    'studies/p5-brush/v050/style.css',
    'studies/p5-brush/v050/README.md',
    'studies/p5-brush/v050/metrics.json',
    'studies/p5-brush/v050/critiques.json',
    'works/brush-2026-11-07/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/p5-brush/v050/index.html');
  const sketch = await read('studies/p5-brush/v050/sketch.js');
  const style = await read('studies/p5-brush/v050/style.css');
  const readme = await read('studies/p5-brush/v050/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v050/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v050/critiques.json'));

  assert.match(html, /id="relief-field"/);
  assert.match(html, /data-gesture="erase"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-raw-work-id="brush-2026-11-07"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyErase/);
  assert.match(sketch, /releaseErase/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523430');
  assert.equal(metrics.grammar, 'subtractive-closure-relief');
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('brush v050 has exactly one dated brush record with source translation', async () => {
  const register = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-07');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-07');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v050/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].source.translatedRule, /revers|subtrac/i);
});
