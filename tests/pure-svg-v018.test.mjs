import test from 'node:test';
import assert from 'node:assert/strict';

const {
  PLATE_COUNT,
  MEMORY_LIMIT,
  STAGES,
  buildTimeline,
  buildFrame,
  applyCountermark,
  removeLatestCountermark,
  geometrySignature
} = await import('../studies/pure-svg/v018/engine.mjs');

test('SVG v018 changes the medium from connected routes to disjoint compound plates', () => {
  const frame = buildTimeline()[STAGES - 1];

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.plates.length, PLATE_COUNT);
  assert.equal(frame.grammar, 'disjoint-countermark-plates');
  assert.ok(frame.plates.every((plate) => plate.closed === true));
  assert.ok(frame.plates.some((plate) => plate.role === 'source-countermark'));
  assert.ok(frame.plates.some((plate) => plate.role === 'remote-imprint'));
  assert.ok(frame.plates.some((plate) => plate.innerCut === true));
  assert.equal('links' in frame, false);
  assert.equal('anchors' in frame, false);
});

test('SVG v018 uses one-point attention, remote algebraic change, and exact replay', () => {
  const frame = buildFrame(7, []);
  const next = applyCountermark(frame, { x: 99, y: -2 });
  const replay = applyCountermark(frame, { x: 99, y: -2 });
  const restored = removeLatestCountermark(next);

  assert.equal(next.memory.length, 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.86, y: 0.18 });
  assert.equal(next.memory.at(-1).source, 'visitor-countermark');
  assert.equal(next.memory.at(-1).mode, 'remote-winding');
  assert.notEqual(next.remoteIndex, next.sourceIndex);
  assert.ok(next.plates[next.sourceIndex].notch === true);
  assert.ok(next.plates[next.remoteIndex].innerCut === true);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v018 exposes a tableau-first pure SVG browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v018/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v018/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v018/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v018/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v018/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="countermark"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyCountermark/);
  assert.match(sketch, /removeLatestCountermark/);
  assert.match(sketch, /remote-winding/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.plate--source-countermark/);
  assert.match(style, /\.plate--remote-imprint/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG compound paths');
  assert.equal(metrics.interactionRule, 'pointer proximity arms one plate; a single commit opens the source notch and imprints a remote compound-path cut');
});

test('SVG v018 is registered exactly once for the 2026-09-27 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-27');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-27');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v018/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-27');
  assert.equal(matches[0].decision.lineage, 'svg-2026-09-26');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].metrics.memoryRule, 'a committed attention opens a source notch and transfers a true compound-path cut to a distant plate');

  const canonical = await readFile(new URL('works/svg-2026-09-27/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-27"/);
});
