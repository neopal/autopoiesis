import test from 'node:test';
import assert from 'node:assert/strict';

const {
  applyPressure,
  buildFrame,
  geometrySignature,
  removeLatestPressure
} = await import('../studies/pure-svg/v021/engine.mjs');

test('SVG v021 begins as one pressure-bearing ribbon rather than a contour or plate field', () => {
  const frame = buildFrame(11, []);

  assert.equal(frame.grammar, 'pressure-ribbon');
  assert.equal(frame.stations.length, 7);
  assert.equal(frame.ribbon.closed, true);
  assert.equal(frame.ribbon.fillRule, 'nonzero');
  assert.ok(frame.ribbon.pathSignature.length > 40);
  assert.equal(frame.memory.length, 0);
  assert.equal('contour' in frame, false);
  assert.equal('clauses' in frame, false);
  assert.equal('pockets' in frame, false);
});

test('SVG v021 treats a traveled pressure as material memory, not a pointer tap', () => {
  const frame = buildFrame(11, []);
  const next = applyPressure(frame, 2, 0.86);
  const replay = applyPressure(frame, 2, 0.86);
  const restored = removeLatestPressure(next);

  assert.equal(next.pressure.gesture, 'traveled-pressure');
  assert.equal(next.pressure.mode, 'material-crease');
  assert.equal(next.pressure.station, 2);
  assert.equal(next.stations[2].role, 'crease');
  assert.equal(next.stations[5].role, 'binder');
  assert.notEqual(next.ribbon.pathSignature, frame.ribbon.pathSignature);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v021 exposes a tableau-first pressure ribbon surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v021/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v021/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v021/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v021/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v021/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="pressure"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /applyPressure/);
  assert.match(sketch, /removeLatestPressure/);
  assert.match(sketch, /traveled-pressure/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.ribbon/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG pressure ribbon');
});

test('SVG v021 is registered exactly once for the 2026-10-03 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-03');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-03');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v021/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-03');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-02');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.memoryRule, /pressure|ribbon|binder/i);

  const canonical = await readFile(new URL('works/svg-2026-10-03/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-03"/);
});
