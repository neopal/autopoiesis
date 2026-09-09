import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const {
  AGENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyIndex,
  buildFrame,
  buildTimeline,
  deleteIndex,
  distance
} = await import('../studies/webgpu/v005/engine.mjs');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v005 makes an archived encounter re-index the later crowd', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteIndex(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.ok(frame.memory.length >= 4);
  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.ok(frame.agents.some((agent) => agent.indexDebt > 0.04));
  assert.ok(frame.aggregate.reindexedAgents > 0);
  assert.ok(frame.aggregate.indexShear > 0.8, `expected a readable index shear, got ${frame.aggregate.indexShear}`);
  assert.ok(fieldDelta > 1.1, `expected the later crowd to change, got ${fieldDelta}`);
  assert.ok(frame.memory.at(-1).affectedAgents > 0);
});

test('WebGPU v005 visitor index is bounded, deterministic, and capped', () => {
  const frame = buildTimeline()[4];
  const next = applyIndex(frame, { x: 1.4, y: -0.2 });
  const replay = applyIndex(frame, { x: 1.4, y: -0.2 });

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-index');
  assert.ok(next.memory.at(-1).affectedAgents > 0);
  assert.ok(next.agents.some((agent) => agent.indexDebt > 0.04));
  assert.deepEqual(replay, next);
});

test('WebGPU v005 lifting the latest index restores the exact prior field', () => {
  const frame = buildTimeline()[3];
  const withIndex = applyIndex(frame, { x: 0.71, y: 0.38 });
  const restored = deleteIndex(withIndex);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
  assert.equal(restored.memory.length, frame.memory.length);
});

test('WebGPU v005 exposes a tableau-first reversible interaction contract', async () => {
  const index = await read('studies/webgpu/v005/index.html');
  const sketch = await read('studies/webgpu/v005/sketch.js');
  const style = await read('studies/webgpu/v005/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="index"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /tabindex="0"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteIndex/);
  assert.match(sketch, /blindMode/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /const staticPreview = params\.get\('static'\) === '1';/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v005 layers the re-indexed crowd and draws rank changes as routes', async () => {
  const sketch = await read('studies/webgpu/v005/sketch.js');
  assert.match(sketch, /globalCompositeOperation = ['"]screen['"]/);
  assert.match(sketch, /shadowBlur/);
  assert.match(sketch, /drawReindexRibbons\(frame\)/);
  assert.match(sketch, /drawRankThreads\(frame\)/);
  assert.match(sketch, /blindMode/);
});

test('WebGPU v005 records a daily candidate and canonical shell', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'webgpu-2026-09-09');

  assert.ok(work, 'the WebGPU daily work must be recorded');
  assert.equal(work.currentId, 'webgpu');
  assert.equal(work.date, '2026-09-09');
  assert.equal(work.title, 'The crowd miscounts itself.');
  assert.equal(work.rawPath, '/studies/webgpu/v005/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-webgpu-2026-09-09');

  const canonical = await read('works/webgpu-2026-09-09/index.html');
  assert.match(canonical, /data-catalog-work-detail="webgpu-2026-09-09"/);
});
