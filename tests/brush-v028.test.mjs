import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v028/engine.mjs';

const mendA = {
  points: [
    { x: 0.22, y: 0.72 },
    { x: 0.38, y: 0.58 },
    { x: 0.64, y: 0.36 }
  ],
  pressure: 0.68
};

const mendB = {
  points: [
    { x: 0.76, y: 0.70 },
    { x: 0.56, y: 0.50 },
    { x: 0.28, y: 0.30 }
  ],
  pressure: 0.44
};

test('Brush v028 begins as one continuous SVG reservoir with real wounds', async () => {
  const { buildFrame, geometrySignature, WOUND_COUNT } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'mending-reservoir');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.wounds.length, WOUND_COUNT);
  assert.equal(frame.wounds.every((wound) => wound.points.length >= 8), true);
  assert.equal(frame.paths.length, WOUND_COUNT);
  assert.ok(frame.paths.every((path) => path.includes('Z M')));
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('Brush v028 turns a mending gesture into closure here and a new wound elsewhere', async () => {
  const { applyMend, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const changed = applyMend(frame, mendA, 'pointer-mend');
  const repeated = applyMend(changed, mendA, 'pointer-mend');
  const second = applyMend(changed, mendB, 'pointer-mend');

  assert.equal(changed.interaction, 'mend-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'paint-mend');
  assert.ok(changed.sealedCount > 0);
  assert.ok(changed.openedCount > 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
  assert.equal(repeated.interaction, 'mend-refused');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(changed));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(changed));
});

test('Brush v028 keeps bounded mends and lifts the exact preceding wound topology', async () => {
  const { MEMORY_LIMIT, STAGES, applyMend, buildFrame, buildTimeline, geometrySignature, liftLatestMend, releaseMends } = await import(engineUrl);
  let frame = buildFrame(0, []);
  for (const mend of [mendA, mendB, { ...mendA, pressure: 0.37 }, { ...mendB, pressure: 0.81 }, { ...mendA, pressure: 0.25 }]) {
    frame = applyMend(frame, mend, 'timeline');
  }

  const settled = buildTimeline(STAGES).at(-1);
  const restored = liftLatestMend(frame);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.sealedCount > 0);
  assert.ok(settled.openedCount > 0);
  assert.equal(geometrySignature(restored), geometrySignature(buildFrame(0, frame.memory.slice(0, -1))));
  assert.equal(geometrySignature(releaseMends(frame)), geometrySignature(buildFrame(0, [])));
});

test('Brush v028 exposes a mending-first exhibition surface and art-gate record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v028/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v028/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v028/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v028/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v028/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v028/critiques.json', root), 'utf8'));

  assert.match(index, /id="mending-field"/);
  assert.match(index, /data-gesture="mend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /applyMend/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /mend-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG mending-reservoir field');
  assert.equal(critiques.length, 6);
});

test('Brush v028 is registered exactly once for the 2026-10-09 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-09');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-09');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v028/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-09');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-08');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /mend|wound|seal/i);

  const canonical = await readFile(new URL('works/brush-2026-10-09/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-09"/);
});
