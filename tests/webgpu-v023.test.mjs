import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v023/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v023 engine must exist before the membrane archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v023 turns a complete three-token witness into apertures in one continuous membrane and lifts it exactly', async () => {
  const { buildFrame, commitWitness, geometrySignature, liftLatestWitness, pressToken } = await loadEngine();
  const quiet = buildFrame(0, []);
  const drafted = ['A', 'C', 'B'].reduce((frame, token) => pressToken(frame, token), quiet);
  const changed = commitWitness(drafted);
  const restored = liftLatestWitness(changed);

  assert.equal(drafted.memory.length, 0);
  assert.equal(drafted.draft.join(''), 'ACB');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'membrane-witness');
  assert.ok(changed.surface.apertures.length >= 2);
  assert.ok(changed.surface.triangles.some((triangle) => triangle.open === true));
  assert.ok(changed.surface.vertices.some((vertex) => vertex.z !== 0 || vertex.twist !== 0));
  assert.notEqual(changed.surface.signature, quiet.surface.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v023 keeps the typed draft non-causal, rejects incomplete calls, and routes later witnesses through membrane residue', async () => {
  const { MEMORY_LIMIT, SEQUENCE, buildFrame, commitWitness, pressToken, releaseMembrane } = await loadEngine();
  const quiet = buildFrame(0, []);
  const partial = pressToken(quiet, SEQUENCE[0]);
  const incomplete = commitWitness(partial);
  const first = commitWitness(SEQUENCE.slice(0, 3).reduce((frame, token) => pressToken(frame, token), quiet));
  const secondDraft = ['D', 'A', 'C'].reduce((frame, token) => pressToken(frame, token), first);
  const second = commitWitness(secondDraft);
  const settled = [0, 1, 2].reduce((frame, index) => {
    return commitWitness(['B', 'D', 'A'].map((token, offset) => SEQUENCE[(index + offset + 1) % SEQUENCE.length]).reduce((current, token) => pressToken(current, token), frame));
  }, quiet);
  const overfull = commitWitness(SEQUENCE.slice(0, 3).reduce((frame, token) => pressToken(frame, token), settled));
  const released = releaseMembrane();

  assert.equal(partial.memory.length, 0);
  assert.equal(incomplete.memory.length, 0);
  assert.equal(incomplete.lastAction, 'incomplete-witness');
  assert.notEqual(second.surface.route, first.surface.route);
  assert.ok(second.surface.residue > first.surface.residue);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.surface.signature, quiet.surface.signature);
});

test('WebGPU v023 settles a 21-stage preview with three remembered witnesses and real apertures', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(21).at(-1);

  assert.equal(settled.stage, 20);
  assert.equal(settled.memory.length, 3);
  assert.ok(settled.surface.apertures.length >= 6);
  assert.ok(settled.surface.triangles.filter((triangle) => triangle.open).length >= 12);
});

test('WebGPU v023 exposes a continuous membrane, token encounter, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v023/index.html');
  const sketch = await read('studies/webgpu/v023/sketch.js');
  const style = await read('studies/webgpu/v023/style.css');
  const readme = await read('studies/webgpu/v023/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v023/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v023/critiques.json'));

  assert.match(index, /id="membrane-field"/);
  assert.match(index, /data-token="A"/);
  assert.match(index, /data-token="B"/);
  assert.match(index, /data-token="C"/);
  assert.match(index, /data-gesture="seal"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /pressToken/);
  assert.match(sketch, /commitWitness/);
  assert.match(sketch, /liftLatestWitness/);
  assert.match(sketch, /releaseMembrane/);
  assert.match(sketch, /navigator\.gpu/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU continuous membrane with Canvas mesh fallback');
  assert.match(metrics.memoryRule, /aperture|membrane|residue|route/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v023 is recorded exactly once for the 2026-10-05 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-05');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-05');
  assert.equal(record.rawPath, '/studies/webgpu/v023/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-05');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.metrics.memoryRule, /aperture|membrane|residue|route/i);
  assert.equal(await read('works/webgpu-2026-10-05/index.html').then(Boolean), true);
});
