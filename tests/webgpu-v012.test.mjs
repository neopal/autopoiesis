import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v012/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v012 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const agentDelta = (a, b, distance) => a.reduce((sum, agent, index) => sum + distance(agent, b[index]), 0);

test('WebGPU v012 makes remembered absences converge, fold, and fan into a changed downstream trace', async () => {
  const {
    AGENT_COUNT,
    MEMORY_LIMIT,
    STAGES,
    buildTimeline,
    deleteHinge,
    distance
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteHinge(frame);
  const latest = frame.memory.at(-1);
  const fieldDelta = agentDelta(frame.agents, withoutLatest.agents, distance);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.convergedAgents > 0);
  assert.ok(frame.aggregate.foldedAgents > 0);
  assert.ok(frame.aggregate.fannedAgents > 0);
  assert.ok(frame.aggregate.hingeStrength > 0.04, `expected a visible hinge, got ${frame.aggregate.hingeStrength}`);
  assert.ok(fieldDelta > 0.6, `expected latest hinge to change downstream geometry, got ${fieldDelta}`);
  assert.ok(latest.convergenceLoad > 0);
  assert.ok(latest.foldLoad > 0);
  assert.ok(latest.fanLoad > 0);
  assert.ok(latest.route.hinge.x > latest.route.entry.x);
  assert.ok(latest.route.fold.x > latest.route.hinge.x);
  assert.ok(latest.route.fan.x > latest.route.fold.x);
  assert.ok(latest.route.trace.x > latest.route.fan.x);
  assert.notEqual(latest.route.fold.y, latest.route.entry.y);
});

test('WebGPU v012 visitor hinge is bounded, replayable, and structurally reversible', async () => {
  const {
    MEMORY_LIMIT,
    applyHinge,
    buildFrame,
    buildTimeline,
    deleteHinge
  } = await loadEngine();
  const frame = buildTimeline()[6];
  const next = applyHinge(frame, { x: 1.4, y: -0.2 });
  const replay = applyHinge(frame, { x: 1.4, y: -0.2 });
  const restored = deleteHinge(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-hinge');
  assert.ok(next.memory.at(-1).route.hinge.x < next.memory.at(-1).route.fold.x);
  assert.ok(next.memory.at(-1).convergenceLoad > 0, 'a bounded visitor absence must converge a real cohort');
  assert.ok(next.memory.at(-1).foldLoad > 0, 'a bounded visitor absence must fold a real cohort');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v012 exposes a tableau-first reversible browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v012/index.html');
  const sketch = await read('studies/webgpu/v012/sketch.js');
  const style = await read('studies/webgpu/v012/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="hinge"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyHinge/);
  assert.match(sketch, /deleteHinge/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v012 is recorded exactly once as the 2026-09-17 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-17');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-17');
  assert.equal(record.rawPath, '/studies/webgpu/v012/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-17');
  assert.ok(record.critiques.length >= 3);
  assert.match(record.metrics.memoryRule, /converge|fold|fan|hinge/i);
  assert.equal(await read('works/webgpu-2026-09-17/index.html').then(Boolean), true);
});
