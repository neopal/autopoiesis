import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v025/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v025 engine must exist before the pressure crown can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v025 turns one committed pressure strike into local shear, a non-local vacancy, and exact lift', async () => {
  const { armStrike, buildFrame, commitStrike, geometrySignature, liftLatestStrike } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armStrike(quiet, 3);
  const changed = commitStrike(armed, { sector: 3, pressure: 0.84 });
  const restored = liftLatestStrike(changed);

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.sector, 3);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].mode, 'pressure-cure');
  assert.ok(changed.chamber.sectors[3].shear !== quiet.chamber.sectors[3].shear);
  assert.ok(changed.chamber.sectors.some((sector, index) => index !== 3 && sector.vacancy > quiet.chamber.sectors[index].vacancy));
  assert.notEqual(changed.chamber.signature, quiet.chamber.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v025 keeps arming non-causal while later strikes inherit cured geometry and memory stays bounded', async () => {
  const { MEMORY_LIMIT, armStrike, buildFrame, commitStrike, releaseCrown } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armStrike(quiet, 99);
  const first = commitStrike(armed, { sector: 2, pressure: 0.48 });
  const second = commitStrike(first, { sector: 9, pressure: 0.92 });
  const settled = [0, 1, 2].reduce((frame, index) => commitStrike(frame, { sector: index * 3 + 1, pressure: 0.62 + index * 0.05 }), second);
  const overfull = commitStrike(settled, { sector: 11, pressure: 1 });
  const released = releaseCrown();

  assert.equal(armed.memory.length, 0);
  assert.equal(armed.armed.sector, 11);
  assert.notEqual(second.chamber.route, first.chamber.route);
  assert.ok(second.chamber.residue > first.chamber.residue);
  assert.ok(second.chamber.sectors.some((sector) => sector.shear !== first.chamber.sectors[sector.id].shear));
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.equal(overfull.memory.length, MEMORY_LIMIT);
  assert.equal(released.chamber.signature, quiet.chamber.signature);
});

test('WebGPU v025 settles a 13-stage preview with four remembered strikes and a visible cavity response', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(13).at(-1);

  assert.equal(settled.stage, 12);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.chamber.sectors.filter((sector) => sector.shear !== 0).length >= 4);
  assert.ok(settled.chamber.sectors.some((sector) => sector.vacancy > 0));
});

test('WebGPU v025 exposes a crown tableau, GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v025/index.html');
  const sketch = await read('studies/webgpu/v025/sketch.js');
  const style = await read('studies/webgpu/v025/style.css');
  const readme = await read('studies/webgpu/v025/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v025/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v025/critiques.json'));

  assert.match(index, /id="gpu-grain"/);
  assert.match(index, /id="crown-field"/);
  assert.match(index, /data-gesture="strike"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /commitStrike/);
  assert.match(sketch, /liftLatestStrike/);
  assert.match(sketch, /releaseCrown/);
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
  assert.equal(metrics.renderer, 'WebGPU pressure crown with Canvas 3D projection fallback');
  assert.match(metrics.memoryRule, /pressure|shear|vacancy|crown/i);
  assert.equal(critiques.length, 5);
});

test('WebGPU v025 is recorded exactly once for the 2026-10-08 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-08');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-08');
  assert.equal(record.rawPath, '/studies/webgpu/v025/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-08');
  assert.ok(record.critiques.length >= 5);
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.match(record.metrics.memoryRule, /pressure|shear|vacancy|crown/i);
  assert.equal(await read('works/webgpu-2026-10-08/index.html').then(Boolean), true);
});
