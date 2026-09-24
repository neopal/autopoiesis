import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';

const {
  STAGES,
  PRIMITIVE_BUDGET,
  buildFrame,
  buildTimeline,
  distance,
  applyAttention,
  deleteAttention
} = await import('../studies/pure-svg/v015/engine.mjs');

const signature = (frame) => ({
  territories: frame.territories,
  holes: frame.holes,
  memory: frame.memory,
  topology: frame.topology
});

const territoryDelta = (a, b) => a.territories.reduce((sum, territory, index) => {
  const other = b.territories[index];
  return sum
    + distance(territory.center, other.center)
    + distance(territory.anchor, other.anchor)
    + Math.abs(territory.scale - other.scale)
    + Math.abs(territory.rotation - other.rotation)
    + (territory.visible === other.visible ? 0 : 0.28)
    + (territory.holeOpen === other.holeOpen ? 0 : 0.32);
}, 0);

test('SVG v015 has a dedicated study tableau path', async () => {
  await access(new URL('../studies/pure-svg/v015/index.html', import.meta.url));
  assert.ok(true);
});

test('SVG v015 translates attention into a visible change of void ownership', () => {
  const frame = buildTimeline()[STAGES - 1];
  const latest = frame.memory.at(-1);
  const withoutLatest = buildFrame(frame.stage, frame.memory.slice(0, -1));

  assert.ok(frame.memory.length >= 2);
  assert.equal(latest.kind, 'attention');
  assert.ok(latest.hostIndex >= 0);
  assert.ok(latest.receiverIndex >= 0);
  assert.notEqual(latest.hostIndex, latest.receiverIndex);
  assert.ok(latest.holeIndex >= 0);
  assert.ok(frame.territories.some((territory) => territory.holeOpen === false));
  assert.ok(frame.territories.some((territory) => territory.holeOpen === true && territory.role === 'receiving'));
  assert.notDeepEqual(frame.topology, withoutLatest.topology);
  assert.ok(territoryDelta(frame, withoutLatest) > 0.72, `expected void ownership change, got ${territoryDelta(frame, withoutLatest)}`);
  assert.ok(frame.holes >= 1);
  assert.equal(frame.primitiveBudget, PRIMITIVE_BUDGET);
});

test('SVG v015 visitor attention is bounded, deterministic, and exactly reversible', () => {
  const frame = buildTimeline()[4];
  const next = applyAttention(frame, { x: 99, y: -2 });

  assert.equal(next.memory.length, frame.memory.length + 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.86, y: 0.18 });
  assert.equal(next.memory.at(-1).source, 'visitor-attention');
  assert.deepEqual(applyAttention(frame, { x: 99, y: -2 }), next);
  assert.deepEqual(signature(deleteAttention(next)), signature(buildFrame(frame.stage, frame.memory)));
});

test('SVG v015 breaks route and gate grammar before explanation', () => {
  const frame = buildTimeline()[STAGES - 1];
  assert.equal(frame.territories.some((territory) => territory.kind === 'gate'), false);
  assert.equal(frame.territories.some((territory) => territory.kind === 'corridor'), false);
  assert.ok(frame.territories.some((territory) => territory.kind === 'compound'));
  assert.ok(frame.territories.some((territory) => territory.holeOpen === false));
  assert.ok(frame.territories.some((territory) => territory.role === 'receiving'));
});

test('SVG v015 exposes a tableau-first void-ownership browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v015/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v015/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v015/style.css', root), 'utf8');

  assert.match(index, /interactive-preview/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attention"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /deleteAttention/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /holeOpen/);
  assert.match(sketch, /receiving/);
  assert.match(sketch, /frozen\s*\?\s*render\(timeline\[0\],\s*1,\s*'sequence'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.territory--receiving/);
  assert.match(style, /static-mode[^}]*void-mark/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
});

test('SVG v015 is registered as the unique 2026-09-24 daily work', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-24');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-24');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v015/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-24');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v014');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-09-24/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-24"/);
});
