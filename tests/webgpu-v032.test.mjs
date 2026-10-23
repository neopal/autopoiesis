import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v032/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v032 engine must exist before the quorum archive can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v032 keeps individual witnesses neutral until three distinct cells form a remote quorum', async () => {
  const { buildFrame, witnessCell, commitQuorum, geometrySignature } = await loadEngine();
  const quiet = buildFrame();
  const first = witnessCell(quiet, { cell: 2 });
  const second = witnessCell(first, { cell: 9 });

  assert.equal(geometrySignature(first), geometrySignature(quiet), 'one witness must not deform the topology');
  assert.equal(geometrySignature(second), geometrySignature(quiet), 'two witnesses must remain geometry-neutral');
  assert.equal(second.memory.length, 0, 'the quorum archive must not write before three distinct witnesses');
  assert.deepEqual(second.witnesses, [2, 9]);

  const committed = commitQuorum(witnessCell(second, { cell: 17 }));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'remote-quorum');
  assert.deepEqual(committed.memory[0].witnesses, [2, 9, 17]);
  assert.notEqual(committed.field.signature, quiet.field.signature);
  assert.notEqual(committed.memory[0].remote, committed.memory[0].refusal);
  assert.notEqual(committed.memory[0].remote, committed.memory[0].bridge);
  assert.equal(committed.witnesses.length, 0, 'a committed quorum must clear the temporary witness set');
});

test('WebGPU v032 rejects duplicate witnesses, bounds quorum memory, and lifts the exact preceding topology', async () => {
  const { MEMORY_LIMIT, buildFrame, witnessCell, commitQuorum, geometrySignature, liftLatestQuorum, releaseArchive } = await loadEngine();
  const quiet = buildFrame();
  const duplicate = witnessCell(witnessCell(quiet, { cell: 3 }), { cell: 3 });
  assert.deepEqual(duplicate.witnesses, [3]);
  assert.equal(geometrySignature(duplicate), geometrySignature(quiet));
  assert.equal(commitQuorum(duplicate).memory.length, 0);

  let frame = quiet;
  for (let serial = 0; serial < MEMORY_LIMIT + 1; serial += 1) {
    frame = witnessCell(frame, { cell: (serial * 5) % 24 });
    frame = witnessCell(frame, { cell: (serial * 5 + 7) % 24 });
    frame = witnessCell(frame, { cell: (serial * 5 + 14) % 24 });
    frame = commitQuorum(frame);
  }
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  const lifted = liftLatestQuorum(frame);
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.notEqual(geometrySignature(lifted), geometrySignature(frame));
  assert.equal(releaseArchive().field.signature, quiet.field.signature);
});

test('WebGPU v032 settles four remote quorum events with void, bridge, and remote proxy consequences', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);
  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.cells.some((cell) => cell.voidness > 0.42));
  assert.ok(settled.field.cells.some((cell) => cell.bridge > 0.35));
  assert.ok(settled.field.cells.some((cell) => cell.proxy > 0.35));
  assert.ok(settled.field.links.some((link) => link.tension > 0.2));
});

test('WebGPU v032 exposes a cellular quorum tableau and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v032/index.html');
  const sketch = await read('studies/webgpu/v032/sketch.js');
  const style = await read('studies/webgpu/v032/style.css');
  const readme = await read('studies/webgpu/v032/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v032/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v032/critiques.json'));

  assert.match(index, /id="quorum-field"/);
  assert.match(index, /data-gesture="commit"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /blind/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /witnessCell/);
  assert.match(sketch, /commitQuorum/);
  assert.match(sketch, /createRenderPipeline/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'WebGPU quorum membrane with Canvas 2D fallback');
  assert.match(metrics.memoryRule, /quorum|remote|void|bridge/i);
  assert.equal(critiques.length, 7);
});

test('WebGPU v032 is recorded exactly once for the 2026-10-23 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-23');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-23');
  assert.equal(record.rawPath, '/studies/webgpu/v032/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-23');
  assert.ok(record.critiques.length >= 7);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /attention|proximity|social|agent/i);
  assert.match(record.source.translatedRule, /quorum|remote|witness|cell/i);
  assert.match(record.metrics.memoryRule, /quorum|remote|void|bridge/i);
  assert.equal(await read('works/webgpu-2026-10-23/index.html').then(Boolean), true);
});
