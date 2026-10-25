import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v034/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v034 engine must exist before the orbital chorus can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v034 keeps an orbital listen neutral until release, then exchanges distance through a reciprocal chorus', async () => {
  const { buildFrame, attendChorus, moveChorus, releaseChorus, geometrySignature, MIN_ARC } = await loadEngine();
  const quiet = buildFrame();
  const listened = attendChorus(quiet, { angle: 0.18, at: 40 });
  const moved = moveChorus(listened, { angle: 0.18 + MIN_ARC * 0.62, at: 260 });

  assert.equal(geometrySignature(listened), geometrySignature(quiet), 'listening must not deform the orbit');
  assert.equal(geometrySignature(moved), geometrySignature(quiet), 'moving the listening gate must remain neutral');
  assert.equal(moved.memory.length, 0, 'the chorus must not write history before release');

  const committed = releaseChorus(moved, { releasedAt: 620 });
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'reciprocal-relay');
  assert.notEqual(committed.memory[0].sourceSector, committed.memory[0].replySector, 'the chorus must answer away from the listened sector');
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.ok(committed.field.agents.some((agent, index) => agent.radius !== quiet.field.agents[index].radius));
  assert.ok(committed.field.agents.some((agent, index) => agent.phase !== quiet.field.agents[index].phase));
  assert.ok(committed.field.agents.some((agent, index) => agent.reciprocity > quiet.field.agents[index].reciprocity));
});

test('WebGPU v034 refuses a shallow listen, bounds relay memory, and lifts the exact preceding chorus', async () => {
  const { MEMORY_LIMIT, buildFrame, attendChorus, releaseChorus, geometrySignature, liftLatestRelay, releaseArchive } = await loadEngine();
  const quiet = buildFrame();
  const refused = releaseChorus(attendChorus(quiet, { angle: 0.5, at: 20 }), { releasedAt: 100 });
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastAction, /refused/);

  let frame = quiet;
  const arcs = [[0.12, 0.56], [0.64, 0.18], [0.28, 0.82], [0.9, 0.42], [0.44, 0.04]];
  for (const [start, end] of arcs) {
    frame = releaseChorus(attendChorus(frame, { angle: start, at: 0 }), { angle: end, releasedAt: 520 });
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestRelay(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v034 settles four reciprocal relays with orbit, phase, and distance variation', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);
  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.agents.some((agent) => agent.radius > 0.74));
  assert.ok(settled.field.agents.some((agent) => agent.radius < 0.38));
  assert.ok(settled.field.agents.some((agent) => Math.abs(agent.phase) > 0.18));
  assert.ok(settled.field.agents.some((agent) => agent.reciprocity > 0.35));
});

test('WebGPU v034 exposes an orbital chorus tableau and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v034/index.html');
  const sketch = await read('studies/webgpu/v034/sketch.js');
  const style = await read('studies/webgpu/v034/style.css');
  const readme = await read('studies/webgpu/v034/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v034/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v034/critiques.json'));

  assert.match(index, /id="chorus-field"/);
  assert.match(index, /data-gesture="relay"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /releaseChorus/);
  assert.match(sketch, /liftLatestRelay/);
  assert.match(sketch, /releaseArchive/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU orbital chorus with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /relay|recipro|orbit|distance/i);
  assert.equal(critiques.length, 8);
});

test('WebGPU v034 is recorded exactly once for the 2026-10-25 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-25');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-25');
  assert.equal(record.rawPath, '/studies/webgpu/v034/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-25');
  assert.ok(record.critiques.length >= 8);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /attention|proximity|social|agent/i);
  assert.match(record.source.translatedRule, /relay|recipro|orbit|distance/i);
  assert.match(record.metrics.memoryRule, /relay|recipro|orbit|distance/i);
  assert.equal(await read('works/webgpu-2026-10-25/index.html').then(Boolean), true);
});
