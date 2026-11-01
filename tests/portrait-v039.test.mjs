import test from 'node:test';
import assert from 'node:assert/strict';

const {
  RIBBON_COUNT,
  MEMORY_LIMIT,
  buildField,
  geometrySignature,
  armSide,
  commitCounterfield,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v039/engine.mjs');

test('portrait v039 builds a deterministic counterfield volume', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(RIBBON_COUNT, 22);
  assert.equal(first.composition, 'counterfield-volume');
  assert.equal(first.renderer, 'webgl');
  assert.equal(first.ribbons.length, RIBBON_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v039 stores one side of a pair without changing the portrait geometry', () => {
  const quiet = buildField();
  const armed = armSide(quiet, { side: 'left', amount: 0.82 });

  assert.equal(armed.interaction, 'armed / left');
  assert.deepEqual(armed.offers, [{ side: 'left', amount: 0.82 }]);
  assert.equal(geometrySignature(armed), geometrySignature(quiet));
});

test('portrait v039 refuses an incomplete or repeated-side pair', () => {
  const quiet = buildField();
  const one = armSide(quiet, { side: 'left', amount: 0.82 });
  const repeated = armSide(one, { side: 'left', amount: 0.31 });
  const incomplete = commitCounterfield(repeated);

  assert.deepEqual(repeated.offers, [{ side: 'left', amount: 0.31 }]);
  assert.equal(incomplete.accepted, false);
  assert.equal(incomplete.field.revision, 0);
  assert.equal(geometrySignature(incomplete.field), geometrySignature(quiet));
});

test('portrait v039 turns opposite pressure into a global counterfield production event', () => {
  const quiet = buildField();
  const offered = armSide(armSide(quiet, { side: 'left', amount: 0.24 }), { side: 'right', amount: 0.9 });
  const result = commitCounterfield(offered);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'counterfield-production');
  assert.equal(event.relation, 'global-production');
  assert.equal(result.field.interaction, 'produced / counterfield');
  assert.equal(result.field.offers.length, 0);
  assert.ok(Math.abs(event.bias) > 0.5);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.ribbons.every((ribbon, index) => ribbon.curve !== quiet.ribbons[index].curve));
  assert.notEqual(result.field.volume.twist, quiet.volume.twist);
});

test('portrait v039 compounds four counterfields and lifts the exact preceding volume', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
});

test('portrait v039 exposes a WebGL volume with equivalent pointer, touch, and keyboard paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v039/index.html');
  const sketch = await read('studies/self-portrait/v039/sketch.js');
  const style = await read('studies/self-portrait/v039/style.css');

  assert.match(html, /data-volume-stage/);
  assert.match(html, /data-action="left"/);
  assert.match(html, /data-action="right"/);
  assert.match(html, /data-action="produce"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /touchstart|pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /getContext\(['"]webgl/);
  assert.match(sketch, /__mutinePortraitV039/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v039 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-01');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-11-01/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-11-01');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-11-01');
  assert.equal(record.rawPath, '/studies/self-portrait/v039/');
  assert.equal(record.source.referenceId, 'p5-brush');
  assert.equal(record.decision.lineage, 'portrait-2026-10-31');
  assert.match(record.metrics.changedRule, /counterfield|global|pair/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-11-01"/);
  assert.equal(publicMatches.length, 1);
});
