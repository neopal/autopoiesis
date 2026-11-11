import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const {
  ATTENTION_LIMIT,
  MEMORY_LIMIT,
  TOKEN_COUNT,
  attend,
  buildFrame,
  buildTimeline,
  fieldSignature,
  liftLatest,
  releaseMemory
} = await import('../studies/naive-art/v050/engine.mjs');

const attendThree = (state, indexes = [1, 4, 7]) => indexes.reduce(
  (current, index) => attend(current, index).field,
  state
);

test('Naive v050 begins as a deterministic browser-native sentence field', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(TOKEN_COUNT, 9);
  assert.equal(ATTENTION_LIMIT, 3);
  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.composition, 'misattributed-attention');
  assert.equal(first.renderer, 'dom');
  assert.equal(first.memory.length, 0);
  assert.equal(first.pending.length, 0);
  assert.equal(first.body.tokens.length, TOKEN_COUNT);
  assert.equal(fieldSignature(first), fieldSignature(second));
});

test('Naive v050 answers an attended trio from an unobserved station', () => {
  const quiet = buildFrame();
  const first = attend(quiet, 1);
  const second = attend(first.field, 4);
  const result = attend(second.field, 7);

  assert.equal(first.accepted, true);
  assert.equal(first.committed, false);
  assert.equal(second.committed, false);
  assert.equal(result.accepted, true);
  assert.equal(result.committed, true);
  assert.equal(result.event.kind, 'misattributed-consensus');
  assert.equal(result.field.memory.length, 1);
  assert.deepEqual(result.event.attended, [1, 4, 7]);
  assert.ok(result.field.body.tokens.some((token) => token.falseAnswer === true));
  assert.ok(result.field.body.tokens.every((token, index) => {
    const base = quiet.body.tokens[index];
    return token.x !== base.x || token.y !== base.y || token.rotation !== base.rotation || token.word !== base.word;
  }));
  assert.notEqual(fieldSignature(result.field), fieldSignature(quiet));
});

test('Naive v050 refuses repeated attention and direct pointer decoration', () => {
  const quiet = buildFrame();
  const first = attend(quiet, 2);
  const repeated = attend(first.field, 2);
  const invalid = attend(first.field, 99);

  assert.equal(repeated.accepted, false);
  assert.equal(repeated.reason, 'already-attended');
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, 'invalid-token');
  assert.equal(fieldSignature(repeated.field), fieldSignature(first.field));
  assert.equal(fieldSignature(invalid.field), fieldSignature(first.field));
});

test('Naive v050 makes attention order structural and lifts exact browser memory', () => {
  const forward = attendThree(buildFrame(), [1, 4, 7]);
  const reverse = attendThree(buildFrame(), [7, 4, 1]);
  const timeline = buildTimeline();

  assert.notEqual(fieldSignature(forward), fieldSignature(reverse));
  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(timeline.at(-1).memory.length, MEMORY_LIMIT);
  assert.equal(fieldSignature(liftLatest(timeline.at(-1))), fieldSignature(timeline.at(-2)));
  assert.equal(releaseMemory().memory.length, 0);
  assert.equal(fieldSignature(releaseMemory()), fieldSignature(buildFrame()));
});

test('Naive v050 exposes a DOM attention tableau and non-hover paths', async () => {
  const html = await read('studies/naive-art/v050/index.html');
  const sketch = await read('studies/naive-art/v050/sketch.js');
  const style = await read('studies/naive-art/v050/style.css');
  const readme = await read('studies/naive-art/v050/README.md');

  assert.match(html, /data-attention-field/);
  assert.match(html, /data-action="attend"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /attend/);
  assert.match(sketch, /__mutineNaiveV050/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('Naive v050 has one honest daily record and canonical route', async () => {
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'naive-2026-11-11');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].currentId, 'naive');
  assert.equal(matches[0].date, '2026-11-11');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v050/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-naive-2026-11-11/);
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].metrics.grammar, 'misattributed-attention');
  const canonical = await read('works/naive-2026-11-11/index.html');
  assert.match(canonical, /data-work-id="naive-2026-11-11"/);
  assert.match(canonical, /catalog\.js/);
});

test('Naive v050 records unresolved perceptual and deletion gates', async () => {
  const metrics = JSON.parse(await read('studies/naive-art/v050/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v050/critiques.json'));

  assert.equal(metrics.grammar, 'misattributed-attention');
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'little-critters');
  assert.ok(critiques.some((critique) => critique.persona === 'Perceptual critic' && critique.status === 'unresolved'));
  assert.ok(critiques.some((critique) => critique.persona === 'Cynic' && critique.status === 'gate'));
});
