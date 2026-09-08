import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyCapture,
  buildFrame,
  buildTimeline,
  deleteCapture,
  distance
} = await import('../studies/webgpu/v002/engine.mjs');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v002 turns archived coordinates into a visible downstream arrival shear', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteCapture(frame);
  const downstreamDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.ok(frame.memory.length >= 3);
  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.ok(frame.agents.some((agent) => agent.latencyDebt > 0.04));
  assert.ok(frame.aggregate.delayedAgents > 0);
  assert.ok(frame.aggregate.arrivalShear > 0.8, `expected a readable arrival shear, got ${frame.aggregate.arrivalShear}`);
  assert.ok(downstreamDelta > 1.2, `expected later arrivals to change, got ${downstreamDelta}`);
  assert.ok(frame.memory.at(-1).affectedAgents > 0);
});

test('WebGPU v002 visitor debt is bounded, deterministic, and capped', () => {
  const frame = buildTimeline()[4];
  const next = applyCapture(frame, { x: 1.4, y: -0.2 });
  const replay = applyCapture(frame, { x: 1.4, y: -0.2 });

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-debt');
  assert.ok(next.memory.at(-1).affectedAgents > 0);
  assert.ok(next.agents.some((agent) => agent.latencyDebt > 0.04));
  assert.deepEqual(replay, next);
});

test('WebGPU v002 lifting the latest debt restores the exact prior arrival field', () => {
  const frame = buildTimeline()[3];
  const withDebt = applyCapture(frame, { x: 0.71, y: 0.38 });
  const restored = deleteCapture(withDebt);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
  assert.equal(restored.memory.length, frame.memory.length);
});

test('WebGPU v002 exposes a tableau-first reversible interaction contract', async () => {
  const index = await read('studies/webgpu/v002/index.html');
  const sketch = await read('studies/webgpu/v002/sketch.js');
  const style = await read('studies/webgpu/v002/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="capture"/);
  assert.match(index, /data-gesture="delete"/);
  assert.match(index, /tabindex="0"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteCapture/);
  assert.match(sketch, /blindMode/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1';/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v002 layers signal strata and draws the changed timing as a route', async () => {
  const sketch = await read('studies/webgpu/v002/sketch.js');
  assert.match(sketch, /globalCompositeOperation = ['"]screen['"]/);
  assert.match(sketch, /shadowBlur/);
  assert.match(sketch, /drawArrivalBands\(frame\)/);
  assert.match(sketch, /drawTimingThreads\(frame\)/);
});

test('WebGPU v002 records a daily candidate and canonical shell', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'webgpu-2026-09-04');

  assert.ok(work, 'the WebGPU daily work must be recorded');
  assert.equal(work.currentId, 'webgpu');
  assert.equal(work.date, '2026-09-04');
  assert.equal(work.rawPath, '/studies/webgpu/v002/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-webgpu-2026-09-04');

  const canonical = await read('works/webgpu-2026-09-04/index.html');
  assert.match(canonical, /data-catalog-work-detail="webgpu-2026-09-04"/);
});
