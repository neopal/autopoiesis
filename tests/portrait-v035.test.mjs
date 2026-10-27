import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NODE_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  geometrySignature,
  observeField,
  auditVoid,
  liftLatest,
  buildTimeline,
  releaseField
} = await import('../studies/self-portrait/v035/engine.mjs');

test('portrait v035 records proximity without moving the ring, then audits the empty centre into a remote geometry event', () => {
  const quiet = buildFrame();
  const watched = observeField(quiet, { node: 2, amount: 0.8 });

  assert.equal(NODE_COUNT, 12);
  assert.equal(geometrySignature(watched), geometrySignature(quiet));
  assert.equal(watched.attention[2], 0.8);

  const audited = auditVoid(watched);
  const event = audited.frame.memory.at(-1);

  assert.equal(audited.accepted, true);
  assert.equal(event.kind, 'void-audit');
  assert.notEqual(event.openedIndex, event.observedNode);
  assert.notEqual(event.compressedIndex, event.observedNode);
  assert.notEqual(geometrySignature(audited.frame), geometrySignature(quiet));
  assert.equal(audited.frame.nodes[event.openedIndex].state, 'opened');
  assert.equal(audited.frame.nodes[event.compressedIndex].state, 'compressed');
  assert.equal(audited.frame.nodes[event.relayIndex].state, 'relay');
});

test('portrait v035 lets accumulated attention, not the tapped site, choose the audit roles', () => {
  const quiet = buildFrame();
  const watched = observeField(quiet, { node: 9, amount: 1 });
  const audited = auditVoid(watched);
  const event = audited.frame.memory.at(-1);

  assert.equal(event.observedNode, 9);
  assert.notEqual(event.openedIndex, 9);
  assert.notEqual(event.compressedIndex, 9);
  assert.notEqual(event.relayIndex, 9);
});

test('portrait v035 bounds four audit memories and lifts the exact preceding field', () => {
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.equal(timeline.length, MEMORY_LIMIT + 1);
  assert.equal(latest.memory.length, MEMORY_LIMIT);
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(lifted.interaction, 'lifted');
});

test('portrait v035 makes the audit visible in actual aperture, width, and angle geometry', () => {
  const quiet = buildFrame();
  const audited = auditVoid(observeField(quiet, { node: 5, amount: 0.9 })).frame;
  const event = audited.memory.at(-1);

  assert.ok(audited.nodes[event.openedIndex].aperture > 0);
  assert.ok(audited.nodes[event.compressedIndex].width > 0);
  assert.notEqual(audited.nodes[event.relayIndex].angle, quiet.nodes[event.relayIndex].angle);
});

test('portrait v035 exposes a browser-native attention orbit and equivalent pointer, keyboard, and control paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v035/index.html');
  const sketch = await read('studies/self-portrait/v035/sketch.js');
  const style = await read('studies/self-portrait/v035/style.css');

  assert.match(html, /data-attention-orbit/);
  assert.match(html, /id="orbit-field"/);
  assert.match(html, /data-action="audit"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutinePortraitV035/);
  assert.match(style, /prefers-reduced-motion/);
});

test('portrait v035 has one factual daily record, a canonical route, and public catalogue lineage', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const matches = works.works.filter((work) => work.id === 'portrait-2026-10-27');
  const record = matches[0];
  const canonical = await read('works/portrait-2026-10-27/index.html');
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'portrait-2026-10-27');

  assert.equal(matches.length, 1);
  assert.equal(record.currentId, 'portrait');
  assert.equal(record.date, '2026-10-27');
  assert.equal(record.rawPath, '/studies/self-portrait/v035/');
  assert.equal(record.source.referenceId, 'little-critters');
  assert.equal(record.decision.lineage, 'portrait-2026-10-26');
  assert.match(record.metrics.changedRule, /attention|audit|centre/i);
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-27"/);
  assert.equal(publicMatches.length, 1);
});

test('portrait v035 releases the attention ledger to the deterministic quiet seed', () => {
  const quiet = buildFrame();
  const changed = auditVoid(observeField(quiet, { node: 4, amount: 0.7 })).frame;
  const released = releaseField();

  assert.equal(geometrySignature(released), geometrySignature(quiet));
  assert.equal(released.memory.length, 0);
  assert.notEqual(geometrySignature(changed), geometrySignature(released));
});

test('portrait v035 keeps its raw tableau independent of remote font imports', async () => {
  const { readFile } = await import('node:fs/promises');
  const style = await readFile(new URL('../studies/self-portrait/v035/style.css', import.meta.url), 'utf8');

  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});
