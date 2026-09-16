import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v011/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v011 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const agentDelta = (a, b, distance) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v011 makes remembered absences hold a cohort, release it downstream, and preserve a deferred arrival', async () => {
  const {
    AGENT_COUNT,
    MEMORY_LIMIT,
    STAGES,
    buildTimeline,
    deleteDelay,
    distance
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteDelay(frame);
  const latest = frame.memory.at(-1);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents, distance);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.heldAgents > 0);
  assert.ok(frame.aggregate.releasedAgents > 0);
  assert.ok(frame.aggregate.deferredAgents > 0);
  assert.ok(frame.aggregate.delayStrength > 0.04, `expected a visible deferred arrival, got ${frame.aggregate.delayStrength}`);
  assert.ok(fieldDelta > 1, `expected latest delay to change downstream geometry, got ${fieldDelta}`);
  assert.ok(latest.holdLoad > 0);
  assert.ok(latest.releaseLoad > 0);
  assert.ok(latest.route.release.x > latest.route.hold.x);
  assert.ok(latest.route.echo.x > latest.route.release.x);
  assert.ok(latest.route.echo.y !== latest.route.entry.y);
});

test('WebGPU v011 visitor delay is bounded, replayable, and structurally reversible', async () => {
  const {
    MEMORY_LIMIT,
    applyDelay,
    buildFrame,
    buildTimeline,
    deleteDelay
  } = await loadEngine();
  const frame = buildTimeline()[5];
  const next = applyDelay(frame, { x: 1.4, y: -0.2 });
  const replay = applyDelay(frame, { x: 1.4, y: -0.2 });
  const restored = deleteDelay(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-delay');
  assert.ok(next.memory.at(-1).route.hold.x < next.memory.at(-1).route.release.x);
  assert.ok(next.memory.at(-1).holdLoad > 0, 'a bounded visitor absence must hold a real cohort');
  assert.ok(next.memory.at(-1).releaseLoad > 0, 'a bounded visitor absence must release a real cohort');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v011 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v011/index.html');
  const sketch = await read('studies/webgpu/v011/sketch.js');
  const style = await read('studies/webgpu/v011/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="delay"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyDelay/);
  assert.match(sketch, /deleteDelay/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v011 is recorded exactly once as the 2026-09-16 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-16');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-16');
  assert.equal(record.rawPath, '/studies/webgpu/v011/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-16');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /hold|release|defer|delay/i);
  assert.equal(await read('works/webgpu-2026-09-16/index.html').then(Boolean), true);
});
