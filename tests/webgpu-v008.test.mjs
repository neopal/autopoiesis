import test from 'node:test';
import assert from 'node:assert/strict';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyEcho,
  buildFrame,
  buildTimeline,
  deleteEcho,
  distance
} = await import('../studies/webgpu/v008/engine.mjs');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v008 turns remembered absences into delayed relay echoes in the crowd geometry', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteEcho(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.relayAgents > 0);
  assert.ok(frame.aggregate.echoAgents > 0);
  assert.ok(frame.aggregate.laggedAgents > 0);
  assert.ok(frame.aggregate.echoStrength > 0.04, `expected a visible relay echo, got ${frame.aggregate.echoStrength}`);
  assert.ok(fieldDelta > 1, `expected latest echo to change downstream geometry, got ${fieldDelta}`);
  assert.ok(frame.memory.at(-1).echoLoad > 0);
});

test('WebGPU v008 visitor echo is bounded, replayable, and structurally reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyEcho(frame, { x: 1.4, y: -0.2 });
  const replay = applyEcho(frame, { x: 1.4, y: -0.2 });
  const restored = deleteEcho(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-echo');
  assert.ok(next.memory.at(-1).route.echo.x > next.memory.at(-1).route.relay.x);
  assert.ok(next.memory.at(-1).echoLoad > 0, 'a bounded visitor absence must produce a downstream echo');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v008 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v008/index.html');
  const sketch = await read('studies/webgpu/v008/sketch.js');
  const style = await read('studies/webgpu/v008/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="echo"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyEcho/);
  assert.match(sketch, /deleteEcho/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v008 is recorded exactly once as the 2026-09-12 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-12');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-12');
  assert.equal(record.rawPath, '/studies/webgpu/v008/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-12');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /echo|relay|lag/i);
  assert.equal(await read('works/webgpu-2026-09-12/index.html').then(Boolean), true);
});
