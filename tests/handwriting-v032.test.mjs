import test from 'node:test';
import assert from 'node:assert/strict';

const loadEngine = () => import('../studies/handwriting/v032/engine.mjs');

test('handwriting v032 builds a deterministic typographic score and keeps three beats geometry-neutral', async () => {
  const { buildFrame, recordBeat, geometrySignature, GLYPH_COUNT, CADENCE_LENGTH } = await loadEngine();
  const baseline = buildFrame([]);
  const first = recordBeat(baseline, 1);
  const second = recordBeat(first, 7);
  const third = recordBeat(second, 10);
  const replay = buildFrame([]);

  assert.equal(GLYPH_COUNT, 12);
  assert.equal(CADENCE_LENGTH, 3);
  assert.equal(baseline.glyphs.length, GLYPH_COUNT);
  assert.equal(geometrySignature(baseline), geometrySignature(replay));
  assert.deepEqual(third.beats, [1, 7, 10]);
  assert.equal(geometrySignature(third), geometrySignature(baseline));
  assert.equal(third.lastEvent, 'beating');
});

test('handwriting v032 uses cadence tempo for a remote typographic mutation and lifts it exactly', async () => {
  const { buildFrame, recordBeat, commitCadence, liftLatestCadence, geometrySignature } = await import('../studies/handwriting/v032/engine.mjs');
  const baseline = buildFrame([]);
  let frame = recordBeat(baseline, 1, 0);
  frame = recordBeat(frame, 7, 260);
  frame = recordBeat(frame, 10, 560);
  const committed = commitCadence(frame);
  const changed = committed.changedGlyphIds;

  assert.equal(committed.history.length, 1);
  assert.equal(committed.history[0].tempo, 'even');
  assert.equal(committed.lastEvent, 'cadence');
  assert.equal(committed.beats.length, 0);
  assert.equal(changed.length, 3);
  assert.ok(changed.every((id) => ![1, 7, 10].includes(id)));
  assert.notEqual(geometrySignature(committed), geometrySignature(baseline));
  assert.ok(changed.some((id) => committed.glyphs[id].blank));
  assert.equal(geometrySignature(liftLatestCadence(committed)), geometrySignature(baseline));
});

test('handwriting v032 refuses incomplete or repeated beats without changing the score', async () => {
  const { buildFrame, recordBeat, commitCadence, geometrySignature } = await import('../studies/handwriting/v032/engine.mjs');
  const baseline = buildFrame([]);
  let frame = recordBeat(baseline, 3, 0);
  frame = recordBeat(frame, 3, 210);
  assert.equal(frame.lastEvent, 'refused');
  assert.deepEqual(frame.beats, [3]);
  const refused = commitCadence(frame);

  assert.equal(refused.lastEvent, 'refused');
  assert.equal(refused.history.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});

test('handwriting v032 compounds a bounded four-cadence memory deterministically', async () => {
  const { buildFrame, recordBeat, commitCadence, geometrySignature, MEMORY_WINDOW } = await import('../studies/handwriting/v032/engine.mjs');
  const cadences = [[0, 4, 10], [2, 6, 8], [1, 7, 5], [9, 3, 6], [4, 8, 2]];
  const times = [0, 260, 560];
  let frame = buildFrame([]);
  for (const cadence of cadences) {
    for (const [index, glyphId] of cadence.entries()) frame = recordBeat(frame, glyphId, times[index]);
    frame = commitCadence(frame);
  }
  let replay = buildFrame([]);
  for (const cadence of cadences) {
    for (const [index, glyphId] of cadence.entries()) replay = recordBeat(replay, glyphId, times[index]);
    replay = commitCadence(replay);
  }

  assert.equal(frame.history.length, cadences.length);
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.deepEqual(frame.memory.map((event) => event.cadence), cadences.slice(-MEMORY_WINDOW));
  assert.equal(geometrySignature(frame), geometrySignature(replay));
});

test('handwriting v032 refuses a cadence that loses its temporal relation', async () => {
  const { buildFrame, recordBeat, commitCadence, geometrySignature } = await import('../studies/handwriting/v032/engine.mjs');
  const baseline = buildFrame([]);
  let frame = recordBeat(baseline, 1, 0);
  frame = recordBeat(frame, 7, 240);
  frame = recordBeat(frame, 10, 2200);
  const refused = commitCadence(frame);

  assert.equal(refused.lastEvent, 'refused');
  assert.equal(refused.history.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});

test('handwriting v032 exposes a canvas score before explanation with preview controls', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/handwriting/v032/index.html');
  const sketch = await read('studies/handwriting/v032/sketch.js');
  const style = await read('studies/handwriting/v032/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-10-24"/);
  assert.match(html, /<figure[^>]+class="cadence-work artwork-frame"/);
  assert.match(html, /id="canvas-mount"/);
  assert.match(html, /id="commit-cadence"/);
  assert.match(html, /id="lift-cadence"/);
  assert.match(html, /id="release-cadence"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /recordBeat/);
  assert.match(sketch, /commitCadence/);
  assert.match(sketch, /liftLatestCadence/);
  assert.match(sketch, /__mutineHandwritingV032/);
  assert.match(style, /preview-mode/);
});

test('handwriting v032 keeps an explicit art gate and exactly one daily catalogue record', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const readme = await read('studies/handwriting/v032/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v032/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v032/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-24');

  assert.match(readme, /## Hypothesis/);
  assert.match(readme, /## Changed rule/);
  assert.match(readme, /## Visible consequence/);
  assert.match(readme, /## Falsifier/);
  assert.match(readme, /## Deletion condition/);
  assert.equal(metrics.seed, '0x48574932');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.ok(Array.isArray(critiques) && critiques.length >= 6);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-10-24');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v032/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-10-24');
});

test('handwriting v032 QA proof summary counts the captured screenshots exactly', async () => {
  const { readdir } = await import('node:fs/promises');
  const proofRoot = new URL('../research/qa/proofs/handwriting-v032-2026-10-24/', import.meta.url);
  const files = await readdir(proofRoot);
  const summary = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('qa-summary.json', proofRoot), 'utf8'));

  assert.equal(summary.screenshotCount, files.filter((file) => file.endsWith('.png') && !file.startsWith('production-')).length);
  assert.equal(summary.localViewportRuns, 20);
  assert.equal(summary.canonicalViewportRuns, 10);
  assert.equal(summary.productionViewportRuns, 20);
  assert.equal(summary.diagnosticCount, 0);
  assert.equal(summary.overflowCount, 0);
  assert.equal(summary.production.diagnosticCount, 0);
  assert.equal(summary.production.overflowCount, 0);
  assert.equal(summary.production.canonicalTableauFirst, true);
  assert.equal(summary.interaction.memoryAfterCommit, 1);
  assert.equal(summary.interaction.memoryAfterLift, 0);
  assert.equal(summary.blind.memory, 4);
});
