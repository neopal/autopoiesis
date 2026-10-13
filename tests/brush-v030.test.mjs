import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v030/engine.mjs';

const pulseA = {
  point: { x: 0.22, y: 0.68 },
  duration: 260
};

const pulseB = {
  point: { x: 0.78, y: 0.31 },
  duration: 420
};

test('Brush v030 begins as one folded pigment sheet with deterministic register folds', async () => {
  const { buildFrame, geometrySignature, FOLD_COUNT } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'pressure-register');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.folds.length, FOLD_COUNT);
  assert.equal(frame.folds.every((fold) => fold.points.length >= 12), true);
  assert.equal(frame.foldPaths.length, FOLD_COUNT);
  assert.equal(frame.foldPaths.every((path) => path.startsWith('M') && path.endsWith('Z')), true);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v030 turns a bounded pressure pulse into three non-local fold changes', async () => {
  const { applyPulse, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const changed = applyPulse(frame, pulseA, 'pointer-pulse');
  const repeated = applyPulse(changed, pulseA, 'pointer-pulse');
  const second = applyPulse(changed, pulseB, 'pointer-pulse');

  assert.equal(changed.interaction, 'pulse-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'pressure-pulse');
  assert.ok(changed.buckledCount > 0);
  assert.ok(changed.liftedCount > 0);
  assert.ok(changed.scarredCount > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
  assert.notEqual(changed.lastPulse.pressIndex, changed.lastPulse.liftIndex);
  assert.notEqual(changed.lastPulse.liftIndex, changed.lastPulse.scarIndex);
  assert.equal(repeated.interaction, 'pulse-refused-repeat');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(changed));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(changed));
});

test('Brush v030 refuses weak and over-held pressure, bounds memory, and lifts exact geometry', async () => {
  const { MAX_PRESS_MS, MEMORY_LIMIT, MIN_PRESS_MS, applyPulse, buildFrame, buildTimeline, geometrySignature, liftLatestPulse, releasePulses } = await import(engineUrl);
  let frame = buildFrame(0, []);
  const refusedShort = applyPulse(frame, { point: { x: 0.5, y: 0.5 }, duration: MIN_PRESS_MS - 1 }, 'pointer-pulse');
  const refusedLong = applyPulse(frame, { point: { x: 0.5, y: 0.5 }, duration: MAX_PRESS_MS + 1 }, 'pointer-pulse');
  assert.equal(refusedShort.interaction, 'pulse-refused-weak');
  assert.equal(refusedLong.interaction, 'pulse-refused-overheld');
  assert.equal(refusedShort.memory.length, 0);
  assert.equal(refusedLong.memory.length, 0);

  const events = [
    pulseA,
    pulseB,
    { point: { x: 0.18, y: 0.3 }, duration: 180 },
    { point: { x: 0.84, y: 0.62 }, duration: 510 },
    { point: { x: 0.44, y: 0.48 }, duration: 340 }
  ];
  for (const pulse of events) frame = applyPulse(frame, pulse, 'timeline');

  const restored = liftLatestPulse(frame);
  const expected = buildFrame(frame.stage - 1, frame.memory.slice(0, -1));
  const settled = buildTimeline().at(-1);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.buckledCount > 0);
  assert.ok(settled.liftedCount > 0);
  assert.ok(settled.scarredCount > 0);
  assert.equal(geometrySignature(restored), geometrySignature(expected));
  assert.equal(geometrySignature(releasePulses(frame)), geometrySignature(buildFrame(0, [])));
});

test('Brush v030 exposes a pressure-first exhibition surface and art-gate record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v030/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v030/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v030/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v030/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v030/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v030/critiques.json', root), 'utf8'));

  assert.match(index, /id="pressure-field"/);
  assert.match(index, /data-gesture="pulse"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /p5\.min\.js/);
  assert.match(sketch, /applyPulse/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /pulse-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D pressure-register sheet');
  assert.equal(critiques.length, 6);
});

test('Brush v030 is registered exactly once for the 2026-10-13 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-13');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-13');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v030/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-13');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-10');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /pulse|pressure|fold|seam/i);

  const canonical = await readFile(new URL('works/brush-2026-10-13/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-13"/);
});
