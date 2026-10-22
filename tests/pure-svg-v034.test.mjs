import test from 'node:test';
import assert from 'node:assert/strict';

const {
  TOKEN_COUNT,
  buildFrame,
  advanceBeat,
  buildTimeline,
  geometrySignature,
  liftLatestBeat,
  releaseScore
} = await import('../studies/pure-svg/v034/engine.mjs');

test('SVG v034 delays a mark until a second beat rewrites the temporal score', () => {
  const initial = buildFrame();
  const next = advanceBeat(initial, { interval: 320 });

  assert.equal(initial.grammar, 'delayed-score');
  assert.equal(initial.memory.length, 0);
  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'delayed-beat');
  assert.equal(next.tokens.length, TOKEN_COUNT);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.ok(next.tokens.filter((token) => token.role !== 'quiet').length >= 3);
});

test('SVG v034 refuses stutter and late timing, then lifts the exact prior score', () => {
  const initial = buildFrame();
  const stutter = advanceBeat(initial, { interval: 90 });
  const late = advanceBeat(initial, { interval: 900 });
  assert.equal(stutter.memory.length, 0);
  assert.equal(stutter.interaction, 'beat-refused-stutter');
  assert.equal(late.memory.length, 0);
  assert.equal(late.interaction, 'beat-refused-late');

  const committed = advanceBeat(initial, { interval: 320 });
  const lifted = liftLatestBeat(committed);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
});

test('SVG v034 exposes deterministic bounded memory and a clean release', () => {
  const timeline = buildTimeline();
  assert.equal(timeline.at(-1).memory.length, 4);
  assert.equal(timeline.at(-1).tokens.length, TOKEN_COUNT);
  assert.deepEqual(buildTimeline(), timeline);
  assert.deepEqual(advanceBeat(buildFrame(), { interval: 320 }), advanceBeat(buildFrame(), { interval: 320 }));

  const released = releaseScore();
  assert.equal(released.memory.length, 0);
  assert.equal(released.interaction, 'released');
  assert.equal(geometrySignature(released), geometrySignature(buildFrame()));
});

test('SVG v034 is registered exactly once for the 2026-10-22 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-22');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-22');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v034/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-22');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-21');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-22/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-22"/);
});
test('SVG v034 exposes a tableau-first temporal encounter and release evidence', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v034/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v034/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v034/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v034/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v034/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="beat"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /advanceBeat/);
  assert.match(sketch, /pendingBeatAt/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG delayed temporal score');
  assert.equal(metrics.commitThreshold, 'a second beat between bounded intervals');
});
