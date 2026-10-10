import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v029/engine.mjs';

const dwellA = {
  point: { x: 0.28, y: 0.66 },
  duration: 940
};

const dwellB = {
  point: { x: 0.74, y: 0.34 },
  duration: 1480
};

test('Brush v029 begins as a radial sediment mass with deterministic solid tongues', async () => {
  const { buildFrame, geometrySignature, TONGUE_COUNT } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'radial-sediment');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.tongues.length, TONGUE_COUNT);
  assert.equal(frame.tongues.every((tongue) => tongue.points.length >= 10), true);
  assert.equal(frame.tonguePaths.length, TONGUE_COUNT);
  assert.equal(frame.tonguePaths.every((path) => path.endsWith('Z')), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v029 turns stillness into a material swell and a distant settling', async () => {
  const { applyDwell, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const changed = applyDwell(frame, dwellA, 'pointer-dwell');
  const repeated = applyDwell(changed, dwellA, 'pointer-dwell');
  const second = applyDwell(changed, dwellB, 'pointer-dwell');

  assert.equal(changed.interaction, 'dwell-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'stillness-event');
  assert.ok(changed.swelledCount > 0);
  assert.ok(changed.settledCount > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
  assert.equal(repeated.interaction, 'dwell-refused');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(changed));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(changed));
});

test('Brush v029 refuses short waiting, bounds memory, and lifts the exact preceding mass', async () => {
  const { MEMORY_LIMIT, applyDwell, buildFrame, buildTimeline, geometrySignature, liftLatestDwell, releaseDwells } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const events = [
    dwellA,
    dwellB,
    { point: { x: 0.2, y: 0.3 }, duration: 780 },
    { point: { x: 0.82, y: 0.62 }, duration: 1210 },
    { point: { x: 0.42, y: 0.48 }, duration: 1680 }
  ];
  const refused = applyDwell(frame, { point: { x: 0.5, y: 0.5 }, duration: 320 }, 'pointer-dwell');
  assert.equal(refused.interaction, 'dwell-refused-short');
  assert.equal(refused.memory.length, 0);

  for (const dwell of events) frame = applyDwell(frame, dwell, 'timeline');
  const restored = liftLatestDwell(frame);
  const expected = buildFrame(frame.stage - 1, frame.memory.slice(0, -1));
  const settled = buildTimeline().at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.swelledCount > 0);
  assert.ok(settled.settledCount > 0);
  assert.equal(geometrySignature(restored), geometrySignature(expected));
  assert.equal(geometrySignature(releaseDwells(frame)), geometrySignature(buildFrame(0, [])));
});

test('Brush v029 exposes a stillness-first exhibition surface and art-gate record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v029/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v029/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v029/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v029/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v029/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v029/critiques.json', root), 'utf8'));

  assert.match(index, /id="sediment-field"/);
  assert.match(index, /data-gesture="dwell"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /applyDwell/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /dwell-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic Canvas 2D radial-sediment field');
  assert.equal(critiques.length, 6);
});

test('Brush v029 is registered exactly once for the 2026-10-10 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-10');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-10');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v029/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-10');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-09');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /still|dwell|swell|settle/i);

  const canonical = await readFile(new URL('works/brush-2026-10-10/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-10"/);
});
