import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const enginePath = new URL('../studies/webgpu/v028/engine.mjs', import.meta.url);
const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const loadEngine = async () => {
  assert.ok(existsSync(enginePath), 'v028 engine must exist before the vacancy object can be evaluated');
  return import(enginePath.href);
};

test('WebGPU v028 turns an addressed cavity into a non-local vacancy in one deterministic object', async () => {
  const { armFocus, buildFrame, commitAbsence, geometrySignature, liftLatestAbsence } = await loadEngine();
  const quiet = buildFrame(0, []);
  const armed = armFocus(quiet, { cavity: 5 });
  const opened = commitAbsence(armed);
  const restored = liftLatestAbsence(opened);

  assert.equal(armed.memory.length, 0, 'focus is observational until the commit key is used');
  assert.equal(armed.armed.cavity, 5);
  assert.equal(opened.memory.length, 1);
  assert.equal(opened.memory[0].mode, 'dispatched-absence');
  assert.notEqual(opened.memory[0].remote, 5, 'the addressed cavity must not receive the vacancy');
  assert.ok(opened.field.cavities[5].closure > quiet.field.cavities[5].closure, 'the addressed cavity must actually close');
  assert.ok(opened.field.cavities.some((cavity, index) => cavity.opening > quiet.field.cavities[index].opening), 'a remote cavity must actually open');
  assert.ok(opened.field.shells.some((shell, index) => shell.shift !== quiet.field.shells[index].shift), 'the enclosing object must answer as a body');
  assert.notEqual(opened.field.signature, quiet.field.signature);
  assert.equal(geometrySignature(restored), geometrySignature(quiet));
});

test('WebGPU v028 refuses an empty focus, compounds a bounded vacancy archive, and releases exactly', async () => {
  const { MEMORY_LIMIT, armFocus, buildFrame, commitAbsence, releaseArchive } = await loadEngine();
  const quiet = buildFrame(0, []);
  const empty = commitAbsence(armFocus(quiet, { cavity: null }));
  let frame = empty;
  for (const cavity of [2, 9, 14, 7, 3]) frame = commitAbsence(armFocus(frame, { cavity }));
  const released = releaseArchive();

  assert.equal(empty.memory.length, 0);
  assert.equal(empty.lastAction, 'absence-refused-empty');
  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(released.field.signature, quiet.field.signature);
  assert.equal(released.lastAction, 'archive-released');
});

test('WebGPU v028 settles a nine-stage preview with four remembered absences and displaced shell geometry', async () => {
  const { buildTimeline } = await loadEngine();
  const settled = buildTimeline(9).at(-1);

  assert.equal(settled.stage, 8);
  assert.equal(settled.memory.length, 4);
  assert.ok(settled.field.cavities.filter((cavity) => cavity.opening > 0).length >= 3);
  assert.ok(settled.field.cavities.filter((cavity) => cavity.closure > 0).length >= 3);
  assert.ok(settled.field.shells.some((shell) => shell.shift !== 0));
});

test('WebGPU v028 exposes a negative-space object tableau, optional GPU path, and explicit art-gate evidence', async () => {
  const index = await read('studies/webgpu/v028/index.html');
  const sketch = await read('studies/webgpu/v028/sketch.js');
  const style = await read('studies/webgpu/v028/style.css');
  const readme = await read('studies/webgpu/v028/README.md');
  const metrics = JSON.parse(await read('studies/webgpu/v028/metrics.json'));
  const critiques = JSON.parse(await read('studies/webgpu/v028/critiques.json'));

  assert.match(index, /id="vacancy-field"/);
  assert.match(index, /data-gesture="commit"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /navigator\.gpu|WebGPU/i);
  assert.match(index, /interaction=1/);
  assert.match(index, /static=1/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /commitAbsence/);
  assert.match(sketch, /liftLatestAbsence/);
  assert.match(sketch, /releaseArchive/);
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
  assert.equal(metrics.renderer, 'WebGPU negative-space object with Canvas 2D cavity fallback');
  assert.match(metrics.memoryRule, /vacancy|cavity|shell|remote/i);
  assert.equal(critiques.length, 6);
});

test('WebGPU v028 is recorded exactly once for the 2026-10-13 daily slot', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((work) => work.currentId === 'webgpu' && work.date === '2026-10-13');
  const record = matches[0];

  assert.equal(matches.length, 1);
  assert.ok(record);
  assert.equal(record.id, 'webgpu-2026-10-13');
  assert.equal(record.rawPath, '/studies/webgpu/v028/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-webgpu-2026-10-13');
  assert.ok(record.critiques.length >= 6);
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.source.title, 'little-critters');
  assert.match(record.source.observedMechanism, /proximity|attention|agents/i);
  assert.match(record.source.translatedRule, /vacancy|cavity|absence|remote/i);
  assert.match(record.browserEvidence.status, /production/i);
  assert.match(record.browserEvidence.viewportRuns, /20\/20 production/i);
  assert.ok(record.browserEvidence.unresolved.includes('independent caption-free perceptual comparison with labels, readout, controls, annotations, and prose hidden'));
  assert.match(record.metrics.memoryRule, /vacancy|cavity|shell|remote/i);
  assert.equal(await read('works/webgpu-2026-10-13/index.html').then(Boolean), true);
});
