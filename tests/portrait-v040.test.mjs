import test from 'node:test';
import assert from 'node:assert/strict';

const {
  APERTURE_COUNT,
  MEMORY_LIMIT,
  buildField,
  geometrySignature,
  pulse,
  sealCadence,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v040/engine.mjs');

test('portrait v040 builds a deterministic planar return-mask with a cut aperture grammar', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(APERTURE_COUNT, 12);
  assert.equal(first.composition, 'return-mask');
  assert.equal(first.renderer, 'canvas2d');
  assert.equal(first.apertures.length, APERTURE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v040 records a pulse as geometry-neutral local attention', () => {
  const quiet = buildField();
  const pulsed = pulse(quiet, { site: 4, gap: 0.31 });

  assert.equal(pulsed.interaction, 'pulse / 1');
  assert.deepEqual(pulsed.pulses, [{ site: 4, gap: 0.31 }]);
  assert.equal(geometrySignature(pulsed), geometrySignature(quiet));
  assert.equal(pulsed.ledger[4], 1);
});

test('portrait v040 refuses a sequence that does not return to its first site', () => {
  let field = buildField();
  field = pulse(field, { site: 2, gap: 0.22 });
  field = pulse(field, { site: 8, gap: 0.61 });
  field = pulse(field, { site: 5, gap: 0.24 });
  const result = sealCadence(field);

  assert.equal(result.accepted, false);
  assert.equal(result.field.revision, 0);
  assert.equal(result.field.memory.length, 0);
  assert.equal(geometrySignature(result.field), geometrySignature(buildField()));
});

test('portrait v040 turns a returned cadence into remote cuts on one planar mask', () => {
  let field = buildField();
  field = pulse(field, { site: 2, gap: 0.22 });
  field = pulse(field, { site: 8, gap: 0.61 });
  field = pulse(field, { site: 2, gap: 0.24 });
  const result = sealCadence(field);
  const event = result.field.memory.at(-1);
  const quiet = buildField();

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'return-cadence');
  assert.equal(event.relation, 'remote-recut');
  assert.deepEqual(event.sequence, [2, 8, 2]);
  assert.equal(result.field.interaction, 'sealed / return');
  assert.equal(result.field.pulses.length, 0);
  assert.ok(event.remoteSites.every((site) => ![2, 8].includes(site)));
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.deepEqual(result.field.apertures[2], quiet.apertures[2]);
  assert.deepEqual(result.field.apertures[8], quiet.apertures[8]);
  assert.notEqual(result.field.mask.seam, quiet.mask.seam);
  assert.notEqual(result.field.mask.tilt, quiet.mask.tilt);
});

test('portrait v040 compounds four returns and lifts the exact preceding mask', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
});

test('portrait v040 exposes equivalent pointer, touch, keyboard, and pulse-control paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v040/index.html');
  const sketch = await read('studies/self-portrait/v040/sketch.js');
  const style = await read('studies/self-portrait/v040/style.css');

  assert.match(html, /data-return-stage/);
  assert.match(html, /data-action="pulse"/);
  assert.match(html, /data-action="seal"/);
  assert.match(html, /data-action="lift"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /touchstart|pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /sealCadence/);
  assert.match(sketch, /__mutinePortraitV040/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v040 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-02');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-11-02/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-11-02');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-11-02');
  assert.equal(record.rawPath, '/studies/self-portrait/v040/');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'portrait-2026-11-01');
  assert.match(record.metrics.changedRule, /return|cadence|remote/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-11-02"/);
  assert.equal(publicMatches.length, 1);
});
