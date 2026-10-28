import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PLATE_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  probeMaterial,
  castMaterial,
  liftLatest,
  releaseMaterial,
  buildTimeline
} = await import('../studies/self-portrait/v036/engine.mjs');

test('portrait v036 keeps a pressure probe geometry-neutral until the material cast', () => {
  const quiet = buildFrame();
  const probed = probeMaterial(quiet, {
    start: { x: -0.72, y: -0.5 },
    end: { x: 0.64, y: 0.48 },
    pressure: 0.82
  });

  assert.equal(PLATE_COUNT, 9);
  assert.equal(geometrySignature(probed), geometrySignature(quiet));
  assert.ok(probed.resistance.some((value) => value > 0));
  assert.equal(probed.lastProbe.pressure, 0.82);
});

test('portrait v036 makes the next geometry from accumulated resistance rather than the contact point', () => {
  const quiet = buildFrame();
  const probed = probeMaterial(quiet, {
    start: { x: -0.72, y: -0.5 },
    end: { x: 0.64, y: 0.48 },
    pressure: 0.82
  });
  const result = castMaterial(probed);
  const event = result.frame.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'pressure-cast');
  assert.notEqual(event.hardenedIndex, event.originIndex);
  assert.notEqual(event.fracturedIndex, event.originIndex);
  assert.notEqual(event.binderIndex, event.originIndex);
  assert.notEqual(geometrySignature(result.frame), geometrySignature(quiet));
  assert.equal(result.frame.plates[event.hardenedIndex].state, 'hardened');
  assert.equal(result.frame.plates[event.fracturedIndex].state, 'fractured');
  assert.equal(result.frame.plates[event.binderIndex].state, 'binder');
});

test('portrait v036 exposes actual material changes in width, notch, and bridge geometry', () => {
  const result = castMaterial(probeMaterial(buildFrame(), {
    start: { x: -0.66, y: 0.15 },
    end: { x: 0.68, y: 0.17 },
    pressure: 0.9
  }));
  const event = result.frame.memory.at(-1);
  const quiet = buildFrame();

  assert.ok(result.frame.plates[event.hardenedIndex].width > quiet.plates[event.hardenedIndex].width);
  assert.ok(result.frame.plates[event.fracturedIndex].notch > quiet.plates[event.fracturedIndex].notch);
  assert.ok(result.frame.plates[event.binderIndex].bridge > quiet.plates[event.binderIndex].bridge);
});

test('portrait v036 bounds four casts and lifts the exact preceding material field', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.interaction, 'lifted');
});

test('portrait v036 releases the pressure ledger to a deterministic quiet specimen', () => {
  const quiet = buildFrame();
  const changed = castMaterial(probeMaterial(quiet, {
    start: { x: -0.3, y: -0.4 },
    end: { x: 0.55, y: 0.5 },
    pressure: 0.7
  })).frame;
  const released = releaseMaterial();

  assert.equal(geometrySignature(released), geometrySignature(quiet));
  assert.equal(released.memory.length, 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(released));
});

test('portrait v036 is a browser-native resistance cast with equivalent pointer, keyboard, and control paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v036/index.html');
  const sketch = await read('studies/self-portrait/v036/sketch.js');
  const style = await read('studies/self-portrait/v036/style.css');

  assert.match(html, /data-resistance-cast/);
  assert.match(html, /id="resistance-canvas"/);
  assert.match(html, /data-action="cast"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutinePortraitV036/);
  assert.match(style, /prefers-reduced-motion/);
});

test('portrait v036 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-10-28');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-28/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-10-28');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-28');
  assert.equal(record.rawPath, '/studies/self-portrait/v036/');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.decision.lineage, 'portrait-2026-10-27');
  assert.match(record.metrics.changedRule, /resistance|material|cast/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-28"/);
  assert.equal(publicMatches.length, 1);
});

test('portrait v036 keeps the raw tableau independent of remote font imports', async () => {
  const { readFile } = await import('node:fs/promises');
  const style = await readFile(new URL('../studies/self-portrait/v036/style.css', import.meta.url), 'utf8');

  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});
