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
} = await import('../studies/webgpu/v003/engine.mjs');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const agentDelta = (a, b) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

 test('WebGPU v003 turns an archived point into a visible vacancy braid', () => {
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteCapture(frame);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents);

  assert.ok(frame.memory.length >= 3);
  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.ok(frame.agents.some((agent) => agent.queueDebt > 0.04));
  assert.ok(frame.aggregate.queuedAgents > 0);
  assert.ok(frame.aggregate.orderShear > 0.8, `expected a readable order shear, got ${frame.aggregate.orderShear}`);
  assert.ok(fieldDelta > 1.1, `expected later queue geometry to change, got ${fieldDelta}`);
  assert.ok(frame.memory.at(-1).affectedAgents > 0);
});

test('WebGPU v003 visitor vacancy is bounded, deterministic, and capped', () => {
  const frame = buildTimeline()[4];
  const next = applyCapture(frame, { x: 1.4, y: -0.2 });
  const replay = applyCapture(frame, { x: 1.4, y: -0.2 });

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-vacancy');
  assert.ok(next.memory.at(-1).affectedAgents > 0);
  assert.ok(next.agents.some((agent) => agent.queueDebt > 0.04));
  assert.deepEqual(replay, next);
});

test('WebGPU v003 lifting the latest vacancy restores the exact prior queue field', () => {
  const frame = buildTimeline()[3];
  const withVacancy = applyCapture(frame, { x: 0.71, y: 0.38 });
  const restored = deleteCapture(withVacancy);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
  assert.equal(restored.memory.length, frame.memory.length);
});

test('WebGPU v003 exposes a tableau-first reversible interaction contract', async () => {
  const index = await read('studies/webgpu/v003/index.html');
  const sketch = await read('studies/webgpu/v003/sketch.js');
  const style = await read('studies/webgpu/v003/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /<div class="field-readout"[^>]+role="status"/);
  assert.match(index, /data-gesture="reserve"/);
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

test('WebGPU v003 layers queue strata and draws order as a route', async () => {
  const sketch = await read('studies/webgpu/v003/sketch.js');
  assert.match(sketch, /globalCompositeOperation = ['"]screen['"]/);
  assert.match(sketch, /shadowBlur/);
  assert.match(sketch, /drawQueueRibbons\(frame\)/);
  assert.match(sketch, /drawOrderThreads\(frame\)/);
});

test('WebGPU v003 records a daily candidate and canonical shell', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'webgpu-2026-09-07');

  assert.ok(work, 'the WebGPU daily work must be recorded');
  assert.equal(work.currentId, 'webgpu');
  assert.equal(work.date, '2026-09-07');
  assert.equal(work.rawPath, '/studies/webgpu/v003/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-webgpu-2026-09-07');

  const canonical = await read('works/webgpu-2026-09-07/index.html');
  assert.match(canonical, /data-catalog-work-detail="webgpu-2026-09-07"/);
});
