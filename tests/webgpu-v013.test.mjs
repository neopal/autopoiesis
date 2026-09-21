import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v013/engine.mjs', import.meta.url);

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v013 engine must exist before its behavior can be evaluated');
  return import(enginePath.href);
};

const orientationDelta = (a, b) => a.reduce((sum, agent, index) => {
  const dx = Math.cos(agent.angle) - Math.cos(b[index].angle);
  const dy = Math.sin(agent.angle) - Math.sin(b[index].angle);
  return sum + Math.hypot(dx, dy);
}, 0);

test('WebGPU v013 makes a situated crowd turn, answer, and preserve a changed collective orientation', async () => {
  const {
    AGENT_COUNT,
    MEMORY_LIMIT,
    STAGES,
    buildTimeline,
    deleteLook,
    distance
  } = await loadEngine();
  const frame = buildTimeline()[STAGES - 1];
  const withoutLatest = deleteLook(frame);
  const latest = frame.memory.at(-1);
  const fieldDelta = orientationDelta(frame.agents, withoutLatest.agents);
  const positionDelta = frame.agents.reduce((sum, agent, index) => sum + distance(agent, withoutLatest.agents[index]), 0);

  assert.equal(frame.agents.length, AGENT_COUNT);
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.ok(frame.aggregate.attentiveAgents > 0);
  assert.ok(frame.aggregate.reciprocalAgents > 0);
  assert.ok(frame.aggregate.answeringAgents > 0);
  assert.ok(fieldDelta > 18, `expected remembered looking to change orientation, got ${fieldDelta}`);
  assert.ok(positionDelta > 0.3, `expected the crowd's occupied field to shift, got ${positionDelta}`);
  assert.ok(latest.attentionLoad > 0);
  assert.ok(latest.replyLoad > 0);
  assert.ok(latest.answerLoad > 0);
  assert.ok(latest.point.x >= 0.08 && latest.point.x <= 0.92);
  assert.ok(latest.point.y >= 0.08 && latest.point.y <= 0.92);
});

test('WebGPU v013 visitor look is bounded, replayable, and structurally reversible', async () => {
  const {
    MEMORY_LIMIT,
    applyLook,
    buildFrame,
    buildTimeline,
    deleteLook
  } = await loadEngine();
  const frame = buildTimeline()[5];
  const next = applyLook(frame, { x: 1.4, y: -0.2 });
  const replay = applyLook(frame, { x: 1.4, y: -0.2 });
  const restored = deleteLook(next);
  const baseline = buildFrame(frame.stage, frame.memory);

  assert.equal(next.memory.length, Math.min(frame.memory.length + 1, MEMORY_LIMIT));
  assert.deepEqual(next.memory.at(-1).point, { x: 0.92, y: 0.08 });
  assert.equal(next.memory.at(-1).source, 'visitor-look');
  assert.ok(next.memory.at(-1).attentionLoad > 0, 'a bounded visitor look must attract a real cohort');
  assert.ok(next.memory.at(-1).replyLoad > 0, 'a bounded visitor look must trigger reciprocal orientation');
  assert.deepEqual(replay, next);
  assert.deepEqual(restored.agents, baseline.agents);
  assert.deepEqual(restored.archive, baseline.archive);
});

test('WebGPU v013 exposes a tableau-first reciprocal browser contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/webgpu/v013/index.html');
  const sketch = await read('studies/webgpu/v013/sketch.js');
  const style = await read('studies/webgpu/v013/style.css');

  assert.match(index, /<canvas[^>]+id="field"/);
  assert.match(index, /data-gesture="look"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.search\.includes\('interaction=1'\)/);
  assert.match(index, /location\.search\.includes\('static=1'\)/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyLook/);
  assert.match(sketch, /deleteLook/);
  assert.match(sketch, /blindMode/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
});

test('WebGPU v013 is recorded exactly once as the 2026-09-21 daily candidate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-09-21');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-09-21');
  assert.equal(record.rawPath, '/studies/webgpu/v013/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-09-21');
  assert.ok(record.critiques.length >= 4);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /look|attention|answer|reciprocal/i);
  assert.equal(await read('works/webgpu-2026-09-21/index.html').then(Boolean), true);
});
