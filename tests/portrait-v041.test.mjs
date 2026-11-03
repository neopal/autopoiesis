import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PLATE_COUNT,
  MEMORY_LIMIT,
  DWELL_THRESHOLD,
  buildField,
  geometrySignature,
  attend,
  commitAttention,
  liftLatest,
  releaseField,
  buildTimeline
} = await import('../studies/self-portrait/v041/engine.mjs');

test('portrait v041 builds a deterministic DOM attention-shutter composition', () => {
  const first = buildField();
  const second = buildField();

  assert.equal(PLATE_COUNT, 13);
  assert.equal(first.composition, 'attention-shutters');
  assert.equal(first.renderer, 'dom-css');
  assert.equal(first.plates.length, PLATE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('portrait v041 makes attention latent and geometry-neutral before the dwell threshold', () => {
  const quiet = buildField();
  const observing = attend(quiet, { site: 4, dwell: DWELL_THRESHOLD - 0.08 });
  const refused = commitAttention(observing);

  assert.equal(observing.interaction, 'observing / 4');
  assert.equal(refused.accepted, false);
  assert.equal(refused.field.revision, 0);
  assert.equal(refused.field.memory.length, 0);
  assert.equal(geometrySignature(refused.field), geometrySignature(quiet));
});

test('portrait v041 lets a watched shutter edit its own DOM geometry after the threshold', () => {
  const quiet = buildField();
  const observing = attend(quiet, { site: 4, dwell: DWELL_THRESHOLD + 0.22 });
  const result = commitAttention(observing);
  const event = result.field.memory.at(-1);

  assert.equal(result.accepted, true);
  assert.equal(event.kind, 'attention-fold');
  assert.equal(event.relation, 'local-self-edit');
  assert.equal(event.site, 4);
  assert.equal(result.field.interaction, 'folded / local');
  assert.equal(result.field.memory.length, 1);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.equal(result.field.plates[4].state, 'folded');
  assert.ok(result.field.plates[4].segments.length > quiet.plates[4].segments.length);
});

test('portrait v041 retains local attention edits and lifts the exact preceding field', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.memory.length, MEMORY_LIMIT - 1);
  assert.equal(releaseField().revision, 0);
});

test('portrait v041 exposes pointer, touch, keyboard, and watch-control paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v041/index.html');
  const sketch = await read('studies/self-portrait/v041/sketch.js');
  const style = await read('studies/self-portrait/v041/style.css');

  assert.match(html, /data-attention-stage/);
  assert.match(html, /data-action="watch"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitAttention/);
  assert.match(sketch, /__mutinePortraitV041/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('portrait v041 restores keyboard focus after rerendering a selected shutter', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v041/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /selectedSite = \(selectedSite \+ direction[\s\S]*?renderField\(`selected \/ \$\{selectedSite\}`\)[\s\S]*?querySelector\(`\[data-plate=/);
});

test('portrait v041 returns focus to the stage after a keyboard commit', async () => {
  const { readFile } = await import('node:fs/promises');
  const sketch = await readFile(new URL('../studies/self-portrait/v041/sketch.js', import.meta.url), 'utf8');
  assert.match(sketch, /watchSelected\(\);\s*stageNode\.focus\(\{ preventScroll: true \}\)/);
});

test('portrait v041 records one factual daily work and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-11-03');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-11-03/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-11-03');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-11-03');
  assert.equal(record.rawPath, '/studies/self-portrait/v041/');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'portrait-2026-11-02');
  assert.match(record.metrics.changedRule, /dwell|attention|local/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-11-03"/);
  assert.equal(publicMatches.length, 1);
});
