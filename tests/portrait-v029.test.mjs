import test from 'node:test';
import assert from 'node:assert/strict';

const {
  STATION_COUNT,
  buildFrame,
  geometrySignature,
  visitStation,
  commitQuorum,
  liftLatest,
  releaseField
} = await import('../studies/self-portrait/v029/engine.mjs');

test('portrait v029 keeps attention geometry-neutral until a three-station quorum', () => {
  const baseline = buildFrame(0);
  const armed = visitStation(visitStation(visitStation(baseline, 0), 2), 4);

  assert.equal(baseline.composition, 'compound-delegation-shell');
  assert.equal(baseline.stations.length, STATION_COUNT);
  assert.equal(armed.memory.length, 0);
  assert.equal(geometrySignature(armed), geometrySignature(baseline));

  const changed = commitQuorum(armed);
  const event = changed.memory.at(-1);

  assert.equal(event.source, 'visitor-quorum');
  assert.equal(event.kind, 'edge-delegation');
  assert.equal(event.roles.length, 3);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.ok(event.donorIndex !== event.receiverIndex);
  assert.ok(event.cutIndex !== event.donorIndex);
  assert.equal(changed.stations[event.donorIndex].state, 'donor');
  assert.equal(changed.stations[event.receiverIndex].state, 'receiver');
  assert.equal(changed.stations[event.cutIndex].state, 'cut');
});

test('portrait v029 bounds delegation memory and lifts the exact preceding shell', () => {
  let frame = buildFrame(1);
  const signatures = [geometrySignature(frame)];
  const visits = [
    [0, 1, 3],
    [1, 2, 4],
    [0, 2, 3],
    [1, 3, 4],
    [0, 2, 4]
  ];

  for (const indices of visits) {
    frame = indices.reduce((current, index) => visitStation(current, index), frame);
    frame = commitQuorum(frame);
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, 4);
  assert.equal(frame.commits.length, 4);
  assert.equal(geometrySignature(liftLatest(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseField(1)), geometrySignature(buildFrame(1)));
});

test('portrait v029 publishes one canonical 2026-10-21 daily record', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const data = JSON.parse(await read('studio/data/works.json'));
  const matches = data.works.filter((entry) => entry.currentId === 'portrait' && entry.date === '2026-10-21');
  const work = matches[0];

  assert.equal(matches.length, 1);
  assert.equal(work.id, 'portrait-2026-10-21');
  assert.equal(work.rawPath, '/studies/self-portrait/v029/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.journal.anchor, 'journal-portrait-2026-10-21');
  assert.equal(work.source.referenceId, 'little-critters');

  const canonical = await read('works/portrait-2026-10-21/index.html');
  assert.match(canonical, /data-catalog-work-detail="portrait-2026-10-21"/);
});

test('portrait v029 exposes an SVG compound shell and accessible quorum controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/self-portrait/v029/index.html');
  const sketch = await read('studies/self-portrait/v029/sketch.js');
  const style = await read('studies/self-portrait/v029/style.css');
  const readme = await read('studies/self-portrait/v029/README.md');

  assert.match(html, /data-raw-work-id="portrait-2026-10-21"/);
  assert.match(html, /id="delegation-svg"/);
  assert.match(html, /data-action="commit"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /<svg/);
  assert.match(sketch, /commitQuorum/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /__mutinePortraitV029/);
  assert.match(style, /min-height:44px/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});
