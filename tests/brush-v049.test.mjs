import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const engine = await import('../studies/p5-brush/v049/engine.mjs');
const {
  FOLD_COUNT,
  HOLD_THRESHOLD,
  MEMORY_LIMIT,
  STAGES,
  armChord,
  applyChord,
  buildFrame,
  geometrySignature,
  holdChord,
  liftLatest,
  pressureSite,
  releaseChord,
  releaseField,
  buildTimeline
} = engine;

test('brush v049 starts as a deterministic fold-sheet with stable pressure sites', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'held-chord-fold-sheet');
  assert.equal(first.memory.length, 0);
  assert.equal(first.memoryLimit, MEMORY_LIMIT);
  assert.equal(first.body.folds.length, FOLD_COUNT);
  assert.equal(first.body.pressureSites.length, 2);
  assert.deepEqual(first.body.pressureSites, [pressureSite(first, 'left'), pressureSite(first, 'right')]);
  assert.equal(geometrySignature(first), geometrySignature(second));

  const armed = armChord(first, 'left');
  assert.equal(armed.pending.active, true);
  assert.deepEqual(armed.pending.sides, ['left']);
  assert.equal(geometrySignature(armed), geometrySignature(first));
});

test('brush v049 commits only a long alternating two-site chord into the next fold', () => {
  const initial = buildFrame();
  const left = armChord(initial, 'left');
  const chord = holdChord(armChord(left, 'right'), HOLD_THRESHOLD);
  const committed = releaseChord(chord);
  const receiver = committed.body.folds[0];

  assert.equal(committed.interaction, 'chord-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'held-chord-fold');
  assert.equal(committed.event.lead, 'left');
  assert.notDeepEqual(receiver, initial.body.folds[0]);
  assert.deepEqual(committed.body.pressureSites, initial.body.pressureSites);

  const short = releaseChord(holdChord(armChord(armChord(initial, 'left'), 'right'), HOLD_THRESHOLD - 1));
  const repeated = releaseChord(holdChord(armChord(armChord(initial, 'left'), 'right'), HOLD_THRESHOLD), 'repeat');
  const wrongLead = applyChord(committed, 'left', HOLD_THRESHOLD + 120, 'wrong-lead');

  assert.equal(short.interaction, 'chord-refused-short');
  assert.equal(short.memory.length, 0);
  assert.equal(geometrySignature(short), geometrySignature(initial));
  assert.equal(repeated.memory.length, 1);
  assert.equal(wrongLead.interaction, 'chord-refused-alternation');
  assert.equal(wrongLead.memory.length, 1);
});

test('brush v049 compounds four fold states, lifts exactly, and releases to the seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const lifted = liftLatest(settled);
  const released = releaseField(settled);

  assert.equal(timeline.length, STAGES);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(new Set(settled.memory.map((event) => event.layer)).size, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.deepEqual(buildTimeline(), timeline);
});

test('brush v049 exposes its tableau-first browser and archive contract', async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/p5-brush/v049/index.html',
    'studies/p5-brush/v049/sketch.js',
    'studies/p5-brush/v049/style.css',
    'studies/p5-brush/v049/README.md',
    'studies/p5-brush/v049/metrics.json',
    'studies/p5-brush/v049/critiques.json',
    'works/brush-2026-11-06/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/p5-brush/v049/index.html');
  const sketch = await read('studies/p5-brush/v049/sketch.js');
  const style = await read('studies/p5-brush/v049/style.css');
  const readme = await read('studies/p5-brush/v049/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v049/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v049/critiques.json'));
  const register = JSON.parse(await read('studio/data/works.json'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-11-06');

  assert.match(html, /id="fold-field"/);
  assert.doesNotMatch(html, /window\.p5 = window\.p5/);
  assert.match(html, /data-gesture="chord"/);
  assert.match(html, /data-gesture="latest"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-raw-work-id="brush-2026-11-06"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /applyChord/);
  assert.match(sketch, /releaseChord/);
  assert.match(sketch, /ember:/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523439');
  assert.equal(metrics.grammar, 'held-chord-fold-sheet');
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-11-06');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v049/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  const canonical = await read('works/brush-2026-11-06/index.html');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-11-06"/);
});
