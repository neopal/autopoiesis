import test from 'node:test';
import assert from 'node:assert/strict';

test('portrait v021 begins as a deterministic suspended blind-side mobile', async () => {
  const { FACET_COUNT, buildFrame, geometrySignature } = await import('../studies/self-portrait/v021/engine.mjs');
  const first = buildFrame(0, []);
  const repeat = buildFrame(0, []);

  assert.equal(first.composition, 'webgl-blind-side-mobile');
  assert.equal(first.memory.length, 0);
  assert.equal(first.facets.length, FACET_COUNT);
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.ok(first.facets.some((facet) => facet.depth !== 0 || facet.tilt !== 0));
});

test('portrait v021 turns a situated departure into local aversion and a non-local geometric answer', async () => {
  const {
    buildFrame,
    armAttention,
    commitDeparture,
    geometrySignature
  } = await import('../studies/self-portrait/v021/engine.mjs');
  const baseline = buildFrame(0, []);
  const armed = armAttention(baseline, { x: 0.12, y: -0.08 });
  const changed = commitDeparture(armed, { x: 0.12, y: -0.08, facetIndex: armed.pendingFacet });
  const event = changed.memory.at(-1);
  const local = changed.facets[event.facetIndex];
  const remote = changed.facets[event.replyIndex];

  assert.equal(armed.memory.length, 0, 'proximity may arm attention but must not write history');
  assert.equal(changed.memory.length, 1);
  assert.equal(event.kind, 'blind-side-turn');
  assert.equal(event.source, 'measured-departure');
  assert.notEqual(event.facetIndex, event.replyIndex);
  assert.equal(local.status, 'averted');
  assert.equal(remote.status, 'answered');
  assert.ok(Math.abs(local.tilt) > Math.abs(baseline.facets[event.facetIndex].tilt));
  assert.ok(Math.abs(remote.shadowShift) > 0 || Math.abs(remote.z - baseline.facets[event.replyIndex].z) > 0);
  assert.notEqual(geometrySignature(baseline), geometrySignature(changed));
});

test('portrait v021 keeps a bounded reciprocal memory and lifts the latest departure exactly', async () => {
  const {
    MEMORY_LIMIT,
    buildFrame,
    commitDeparture,
    liftLatestDeparture,
    releaseAttention,
    geometrySignature
  } = await import('../studies/self-portrait/v021/engine.mjs');
  const baseline = buildFrame(3, []);
  const first = commitDeparture(baseline, { facetIndex: 1, x: -0.2, y: 0 });
  const second = commitDeparture(first, { facetIndex: 7, x: 0.1, y: 0.2 });
  const lifted = liftLatestDeparture(second);
  let many = baseline;
  for (let index = 0; index < 7; index += 1) many = commitDeparture(many, { facetIndex: index % 11 });

  assert.equal(geometrySignature(lifted), geometrySignature(first));
  assert.equal(many.memory.length, MEMORY_LIMIT);
  assert.equal(releaseAttention(3).memory.length, 0);
});

test('portrait v021 has a replayable staged score with four different situated replies', async () => {
  const { buildTimeline, geometrySignature, defaultCue } = await import('../studies/self-portrait/v021/engine.mjs');
  const timeline = buildTimeline();
  const repeat = buildTimeline();
  const replies = timeline.at(-1).memory.map((event) => event.replyIndex);

  assert.equal(timeline.length, 17);
  assert.equal(timeline.at(-1).memory.length, 4);
  assert.equal(new Set(replies).size, replies.length);
  assert.equal(geometrySignature(timeline.at(-1)), geometrySignature(repeat.at(-1)));
  assert.ok(defaultCue(0).x !== defaultCue(1).x || defaultCue(0).y !== defaultCue(1).y);
});

test('portrait v021 ships a WebGL tableau with approach-departure controls and blind preview support', async () => {
  const { access, readFile } = await import('node:fs/promises');
  const files = [
    'studies/self-portrait/v021/index.html',
    'studies/self-portrait/v021/sketch.js',
    'studies/self-portrait/v021/style.css',
    'studies/self-portrait/v021/README.md',
    'studies/self-portrait/v021/metrics.json',
    'studies/self-portrait/v021/critiques.json'
  ];
  for (const path of files) await access(new URL(`../${path}`, import.meta.url));
  const html = await readFile(new URL('../studies/self-portrait/v021/index.html', import.meta.url), 'utf8');
  const sketch = await readFile(new URL('../studies/self-portrait/v021/sketch.js', import.meta.url), 'utf8');
  const style = await readFile(new URL('../studies/self-portrait/v021/style.css', import.meta.url), 'utf8');
  assert.match(html, /p5\.js\/1\.11\.3\/p5\.min\.js/);
  assert.match(html, /id="blind-field"/);
  assert.match(html, /data-gesture="approach"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(sketch, /armAttention/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /pointer-tap-refused/);
  assert.match(sketch, /__mutinePortraitV021/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /touch-action:\s*none/);
});

test('portrait v021 records one honest daily work and its canonical navigable route', async () => {
  const { access, readFile } = await import('node:fs/promises');
  await access(new URL('../works/portrait-2026-10-05/index.html', import.meta.url));
  const canonical = await readFile(new URL('../works/portrait-2026-10-05/index.html', import.meta.url), 'utf8');
  const data = JSON.parse(await readFile(new URL('../studio/data/works.json', import.meta.url), 'utf8'));
  const matches = data.works.filter((work) => work.currentId === 'portrait' && work.date === '2026-10-05');
  assert.equal(matches.length, 1);
  const record = matches[0];
  assert.equal(record.id, 'portrait-2026-10-05');
  assert.equal(record.rawPath, '/studies/self-portrait/v021/');
  assert.equal(record.status, 'candidate / held');
  assert.equal(record.lifecycle, 'active');
  assert.equal(record.journal.anchor, 'journal-portrait-2026-10-05');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.match(record.source.translatedRule, /departure|facet|attention/i);
  assert.ok(record.critiques.length >= 6);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-05"/);
});
