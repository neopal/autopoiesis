import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/naive-art/v048/engine.mjs');
const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  ATTENTION_THRESHOLD,
  buildFrame,
  noticeAgent,
  commitLookBack,
  geometrySignature,
  buildTimeline,
  liftLatest,
  releaseMemory
} = engine;

test('naive v048 starts as a deterministic reciprocal field without spending attention', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'backcast-ecology');
  assert.equal(first.surface, 'p5-canvas-reciprocal-field');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.agents.length, AGENT_COUNT);
  assert.equal(first.body.seams.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));

  const noticed = noticeAgent(first, 2, -0.4);
  assert.equal(noticed.pending.active, true);
  assert.deepEqual(noticed.pending.visited, [2]);
  assert.equal(geometrySignature(noticed), geometrySignature(first));
});

test('naive v048 requires three distinct reciprocal notices before a stale look-back can commit', () => {
  let state = buildFrame();
  state = noticeAgent(state, 2, -0.4);
  state = noticeAgent(state, 2, 0.7);
  assert.deepEqual(state.pending.visited, [2]);
  assert.equal(commitLookBack(state).interaction, 'look-back-refused-incomplete');

  state = noticeAgent(state, 6, 0.1);
  state = noticeAgent(state, 11, 2.2);
  assert.deepEqual(state.pending.visited, [2, 6, 11]);
  const committed = commitLookBack(state);

  assert.equal(committed.interaction, 'look-back-committed');
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.event.type, 'backcast');
  assert.deepEqual(committed.event.visited, [2, 6, 11]);
  assert.equal(committed.body.seams.length, 1);
  assert.notEqual(geometrySignature(committed), geometrySignature(buildFrame()));
  assert.ok(committed.body.agents.every((agent) => agent.backcastDepth > 0));

  const short = noticeAgent(noticeAgent(buildFrame(), 1, 0.2), 4, 0.4);
  assert.equal(commitLookBack(short).interaction, 'look-back-refused-incomplete');
  assert.equal(short.memory.length, 0);
});

test('naive v048 makes notice order materially legible, compounds four backcasts, and lifts exactly', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const reversed = commitLookBack(
    noticeAgent(
      noticeAgent(
        noticeAgent(buildFrame(), 11, 2.2),
        6,
        0.1
      ),
      2,
      -0.4
    )
  );
  const forward = timeline[1];
  const lifted = liftLatest(settled);
  const released = releaseMemory(settled);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(settled.body.seams.length, MEMORY_LIMIT);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
  assert.notEqual(geometrySignature(forward), geometrySignature(reversed));
  assert.deepEqual(buildTimeline(), timeline);
  assert.equal(ATTENTION_THRESHOLD, 3);
});

test('naive v048 exposes a tableau-first archive contract', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  for (const path of [
    'studies/naive-art/v048/index.html',
    'studies/naive-art/v048/sketch.js',
    'studies/naive-art/v048/style.css',
    'studies/naive-art/v048/README.md',
    'studies/naive-art/v048/metrics.json',
    'studies/naive-art/v048/critiques.json',
    'works/naive-2026-11-09/index.html'
  ]) await access(new URL(`../${path}`, import.meta.url));

  const html = await read('studies/naive-art/v048/index.html');
  const sketch = await read('studies/naive-art/v048/sketch.js');
  const style = await read('studies/naive-art/v048/style.css');
  const readme = await read('studies/naive-art/v048/README.md');
  const metrics = JSON.parse(await read('studies/naive-art/v048/metrics.json'));
  const critiques = JSON.parse(await read('studies/naive-art/v048/critiques.json'));

  assert.match(html, /id="attention-field"/);
  assert.match(html, /data-action="look-back"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-raw-work-id="naive-2026-11-09"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitLookBack/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition', 'anti-copy']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x4e413438');
  assert.equal(metrics.grammar, 'backcast-ecology');
  assert.equal(metrics.referenceId, 'little-critters');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 10);
});

test('naive v048 is registered exactly once for the 2026-11-09 daily slot with little-critters translation', async () => {
  const { readFile } = await import('node:fs/promises');
  const register = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'naive' && work.date === '2026-11-09');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-11-09');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v048/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.match(matches[0].source.translatedRule, /attention|gaze|look-back|backcast/i);
  assert.match(matches[0].journal.note, /v048|gaze|attention|backcast/i);
});
