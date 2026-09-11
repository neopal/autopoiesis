import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyCensus,
  buildFrame,
  buildTimeline,
  deleteCensus,
  distance
} = await import('../studies/webgpu/v007/engine.mjs');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v007 turns remembered absences into split routes and a shared compressed wake', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteCensus(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.ok(frame.memory.length >= 3);
  assert.ok(frame.aggregate.braidedAgents > 0);
  assert.ok(frame.aggregate.rejoinedAgents > 0);
  assert.ok(frame.aggregate.wakeAgents > 0);
  assert.ok(frame.aggregate.wakeCompression > 1.1, `expected shared wake compression, got ${frame.aggregate.wakeCompression}`);
  assert.ok(fieldDelta > 1, `expected latest census to change downstream geometry, got ${fieldDelta}`);
  assert.ok(frame.memory.at(-1).wakeLoad > 0);
});

test('WebGPU v007 visitor census is bounded, replayable, and reaches a downstream wake', () => {
  const frame = buildTimeline()[4];
  const next = applyCensus(frame, { x: 1.4, y: -0.2 });
  const replay = applyCensus(frame, { x: 1.4, y: -0.2 });
  const restored = deleteCensus(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-census');
  assert.ok(next.memory.at(-1).route.wake.x > next.memory.at(-1).route.rejoin.x);
  assert.ok(next.memory.at(-1).wakeLoad > 0, 'a bounded visitor absence must still reach its wake');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v007 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v007/index.html');
  const sketch = await read('studies/webgpu/v007/sketch.js');
  const style = await read('studies/webgpu/v007/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="census"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyCensus/);
  assert.match(sketch, /deleteCensus/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v007 is recorded exactly once as the 2026-09-11 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-11');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-11');
  assert.equal(record.rawPath, '/studies/webgpu/v007/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-11');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /census|wake|absence/);
  assert.equal(await read('works/webgpu-2026-09-11/index.html').then(Boolean), true);
});
