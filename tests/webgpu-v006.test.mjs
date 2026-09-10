import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyDetour,
  buildFrame,
  buildTimeline,
  deleteDetour,
  distance
} = await import('../studies/webgpu/v006/engine.mjs');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v006 turns an archived encounter into paired detours that rejoin', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteDetour(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.ok(frame.memory.length >= 3);
  assert.ok(frame.aggregate.braidedAgents > 0);
  assert.ok(frame.aggregate.routeSeparation > 0.8, `expected paired routes to separate, got ${frame.aggregate.routeSeparation}`);
  assert.ok(frame.aggregate.rejoinedAgents > 0);
  assert.ok(fieldDelta > 1, `expected latest detour to change downstream geometry, got ${fieldDelta}`);
  assert.ok(frame.memory.at(-1).pairedAgents > 0);
  assert.ok(frame.memory.at(-1).rejoinLoad > 0);
});

test('WebGPU v006 visitor detour is bounded, replayable, and carries split/rejoin coordinates', () => {
  const frame = buildTimeline()[4];
  const next = applyDetour(frame, { x: 1.4, y: -0.2 });
  const replay = applyDetour(frame, { x: 1.4, y: -0.2 });
  const restored = deleteDetour(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-detour');
  assert.ok(next.memory.at(-1).route.split.x > next.memory.at(-1).point.x);
  assert.ok(next.memory.at(-1).route.rejoin.x > next.memory.at(-1).route.split.x);
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v006 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v006/index.html');
  const sketch = await read('studies/webgpu/v006/sketch.js');
  const style = await read('studies/webgpu/v006/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="detour"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyDetour/);
  assert.match(sketch, /deleteDetour/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v006 is recorded exactly once as the 2026-09-10 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-10');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-10');
  assert.equal(record.rawPath, '/studies/webgpu/v006/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-10');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /paired|detour|rejoin/);
  assert.equal(await read('works/webgpu-2026-09-10/index.html').then(Boolean), true);
});
