import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v010/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v010 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const agentDelta = (a, b, distance) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v010 makes remembered absences cross neighboring lanes and settle in changed order', async () => {
  const {
    AGENT_COUNT,
    MEMORY_LIMIT,
    STAGES,
    buildFrame,
    buildTimeline,
    deleteSwitch,
    distance
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteSwitch(frame);
  const latest = frame.memory.at(-1);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents, distance);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.crossingAgents > 0);
  assert.ok(frame.aggregate.switchedAgents > 0);
  assert.ok(frame.aggregate.settledAgents > 0);
  assert.ok(frame.aggregate.switchStrength > 0.04, `expected a visible lane exchange, got ${frame.aggregate.switchStrength}`);
  assert.ok(fieldDelta > 1, `expected latest switch to change downstream geometry, got ${fieldDelta}`);
  assert.ok(latest.crossLoad > 0);
  assert.ok(latest.route.cross.x > latest.route.entry.x);
  assert.ok(latest.route.settle.x > latest.route.cross.x);
  assert.notEqual(latest.route.cross.y, latest.route.entry.y);
});

test('WebGPU v010 visitor switch is bounded, replayable, and structurally reversible', async () => {
  const {
    MEMORY_LIMIT,
    applySwitch,
    buildFrame,
    buildTimeline,
    deleteSwitch
  } = await loadEngine();
  const frame = buildTimeline()[5];
  const next = applySwitch(frame, { x: 1.4, y: -0.2 });
  const replay = applySwitch(frame, { x: 1.4, y: -0.2 });
  const restored = deleteSwitch(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-switch');
  assert.ok(next.memory.at(-1).route.cross.y !== next.memory.at(-1).route.entry.y);
  assert.ok(next.memory.at(-1).crossLoad > 0, 'a bounded visitor absence must exchange downstream lanes');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v010 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v010/index.html');
  const sketch = await read('studies/webgpu/v010/sketch.js');
  const style = await read('studies/webgpu/v010/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="switch"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applySwitch/);
  assert.match(sketch, /deleteSwitch/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v010 is recorded exactly once as the 2026-09-15 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-15');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-15');
  assert.equal(record.rawPath, '/studies/webgpu/v010/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-15');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /cross|switch|lane|settle/i);
  assert.equal(await read('works/webgpu-2026-09-15/index.html').then(Boolean), true);
});
