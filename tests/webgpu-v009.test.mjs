import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyCountercurrent,
  buildFrame,
  buildTimeline,
  deleteCountercurrent,
  distance
} = await import('../studies/webgpu/v009/engine.mjs');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v009 makes remembered absences reverse a packet before downstream rejoining', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteCountercurrent(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);
  const latest = frame.memory.at(-1);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.counterflowAgents > 0);
  assert.ok(frame.aggregate.reverseAgents > 0);
  assert.ok(frame.aggregate.rejoinedAgents > 0);
  assert.ok(frame.aggregate.countercurrentStrength > 0.04, `expected visible countercurrent, got ${frame.aggregate.countercurrentStrength}`);
  assert.ok(fieldDelta > 1, `expected latest countercurrent to change downstream geometry, got ${fieldDelta}`);
  assert.ok(latest.returnLoad > 0);
  assert.ok(latest.route.turn.x < latest.route.entry.x, 'the remembered route must actually turn backward');
  assert.ok(latest.route.exit.x > latest.route.entry.x, 'the remembered route must rejoin downstream');
});

test('WebGPU v009 visitor countercurrent is bounded, replayable, and structurally reversible', () => {
  const frame = buildTimeline()[5];
  const next = applyCountercurrent(frame, { x: 1.4, y: -0.2 });
  const replay = applyCountercurrent(frame, { x: 1.4, y: -0.2 });
  const restored = deleteCountercurrent(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-countercurrent');
  assert.ok(next.memory.at(-1).route.turn.x < next.memory.at(-1).route.entry.x);
  assert.ok(next.memory.at(-1).returnLoad > 0, 'a bounded visitor absence must reverse a downstream packet');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v009 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v009/index.html');
  const sketch = await read('studies/webgpu/v009/sketch.js');
  const style = await read('studies/webgpu/v009/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="countercurrent"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyCountercurrent/);
  assert.match(sketch, /deleteCountercurrent/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v009 is recorded exactly once as the 2026-09-13 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-13');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-13');
  assert.equal(record.rawPath, '/studies/webgpu/v009/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-13');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /countercurrent|reverse|rejoin/i);
  assert.equal(await read('works/webgpu-2026-09-13/index.html').then(Boolean), true);
});
