import test from 'node:test';
import assert from 'node:assert/strict';

const engineUrl = '../studies/p5-brush/v027/engine.mjs';

const scrapeA = {
  points: [
    { x: 0.18, y: 0.74 },
    { x: 0.32, y: 0.54 },
    { x: 0.48, y: 0.42 },
    { x: 0.64, y: 0.32 }
  ],
  pressure: 0.72
};

const scrapeB = {
  points: [
    { x: 0.72, y: 0.76 },
    { x: 0.61, y: 0.60 },
    { x: 0.49, y: 0.52 },
    { x: 0.34, y: 0.48 }
  ],
  pressure: 0.58
};

test('Brush v027 begins as a deterministic population of detached pigment islands', async () => {
  const { buildFrame, geometrySignature, ISLAND_COUNT } = await import(engineUrl);
  const frame = buildFrame(0, []);

  assert.equal(frame.grammar, 'fracture-return');
  assert.equal(frame.memory.length, 0);
  assert.equal(frame.islands.length, ISLAND_COUNT);
  assert.ok(frame.islands.every((island) => island.points.length >= 8));
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
  assert.equal(frame.islands.every((island) => Number.isFinite(island.x) && Number.isFinite(island.y)), true);
});

test('Brush v027 makes a freehand scrape fracture crossed islands and return residue elsewhere', async () => {
  const { applyScrape, buildFrame, geometrySignature } = await import(engineUrl);
  const frame = buildFrame(0, []);
  const changed = applyScrape(frame, scrapeA, 'pointer-scrape');
  const repeated = applyScrape(changed, scrapeA, 'pointer-scrape');
  const second = applyScrape(changed, scrapeB, 'pointer-scrape');

  assert.equal(changed.interaction, 'scrape-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].kind, 'pigment-scrape');
  assert.ok(changed.islands.some((island) => island.fracture > 0));
  assert.ok(changed.islands.some((island) => island.returnMass > 0));
  assert.notEqual(geometrySignature(changed), geometrySignature(frame));
  assert.equal(repeated.interaction, 'scrape-refused');
  assert.equal(repeated.memory.length, 1);
  assert.equal(geometrySignature(repeated), geometrySignature(changed));
  assert.equal(second.memory.length, 2);
  assert.notEqual(geometrySignature(second), geometrySignature(changed));
});

test('Brush v027 keeps a bounded scrape archive and lifts the exact preceding population', async () => {
  const { MEMORY_LIMIT, STAGES, applyScrape, buildFrame, buildTimeline, geometrySignature, liftLatestScrape, releaseScrapes } = await import(engineUrl);
  let frame = buildFrame(0, []);
  for (const scrape of [scrapeA, scrapeB, { ...scrapeA, pressure: 0.41 }, { ...scrapeB, pressure: 0.83 }, { ...scrapeA, pressure: 0.29 }]) {
    frame = applyScrape(frame, scrape, 'timeline');
  }

  const settled = buildTimeline(STAGES).at(-1);
  const restored = liftLatestScrape(frame);

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(settled.memory.length, MEMORY_LIMIT);
  assert.ok(settled.islands.some((island) => island.fracture > 0.3));
  assert.ok(settled.islands.some((island) => island.returnMass > 0.2));
  assert.equal(geometrySignature(restored), geometrySignature(buildFrame(0, frame.memory.slice(0, -1))));
  assert.equal(geometrySignature(releaseScrapes(frame)), geometrySignature(buildFrame(0, [])));
});

test('Brush v027 exposes a scrape-first exhibition surface and art-gate record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/p5-brush/v027/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/p5-brush/v027/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/p5-brush/v027/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/p5-brush/v027/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/p5-brush/v027/metrics.json', root), 'utf8'));
  const critiques = JSON.parse(await readFile(new URL('studies/p5-brush/v027/critiques.json', root), 'utf8'));

  assert.match(index, /id="fracture-field"/);
  assert.match(index, /data-gesture="scrape"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /applyScrape/);
  assert.match(sketch, /pointer(Down|Move|Up)/i);
  assert.match(sketch, /scrape-committed/);
  assert.match(style, /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic p5.js 2D fracture-return field');
  assert.equal(critiques.length, 6);
});

test('Brush v027 is registered exactly once for the 2026-10-08 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-08');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-08');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v027/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-08');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-07');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /fracture|return|scrape/i);

  const canonical = await readFile(new URL('works/brush-2026-10-08/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-08"/);
});
