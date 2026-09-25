import test from 'node:test';
import assert from 'node:assert/strict';

const {
  JOINT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  buildTimeline
} = await import('../studies/pure-svg/v016/engine.mjs');

test('SVG v016 turns a situated witness into a broken articulated body', () => {
  const frame = buildTimeline()[STAGES - 1];

  assert.equal(frame.memory.length, MEMORY_LIMIT);
  assert.equal(frame.joints.length, JOINT_COUNT);
  assert.equal(frame.grammar, 'single-articulated-body');
  assert.ok(frame.segments.some((segment) => segment.visible === false));
  assert.ok(frame.echoes.some((echo) => echo.visible === true));
  assert.ok(frame.joints.some((joint) => joint.role === 'sacrificed'));
  assert.ok(frame.joints.some((joint) => joint.role === 'inherited'));
  assert.equal('territories' in frame, false);
  assert.equal('gates' in frame, false);
});

test('SVG v016 witness mutation is bounded, deterministic, and exactly reversible', async () => {
  const { applyAttention, buildFrame, deleteAttention, geometrySignature } = await import('../studies/pure-svg/v016/engine.mjs');
  const frame = buildFrame(6, []);
  const next = applyAttention(frame, { x: 99, y: -2 });
  const replay = applyAttention(frame, { x: 99, y: -2 });
  const restored = deleteAttention(next);

  assert.equal(next.memory.length, 1);
  assert.deepEqual(next.memory.at(-1).point, { x: 0.86, y: 0.18 });
  assert.equal(next.memory.at(-1).source, 'visitor-witness');
  assert.equal(next.memory.at(-1).mode, 'held-gaze');
  assert.equal(next.memory.at(-1).commitThreshold, 0.65);
  assert.deepEqual(replay, next);
  assert.equal(geometrySignature(restored), geometrySignature(frame));
});

test('SVG v016 exposes a tableau-first, held-gaze browser surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v016/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v016/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v016/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v016/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v016/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="witness"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /applyAttention/);
  assert.match(sketch, /deleteAttention/);
  assert.match(sketch, /held-gaze/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /\.joint--sacrificed/);
  assert.match(style, /\.echo--inherited/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG geometry');
  assert.equal(metrics.commitThreshold, 0.65);
});

test('SVG v016 is registered exactly once for the 2026-09-25 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-09-25');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-09-25');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v016/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-09-25');
  assert.equal(matches[0].decision.lineage, 'pure-svg-v015');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(matches[0].metrics.commitThreshold, 0.65);

  const canonical = await readFile(new URL('works/svg-2026-09-25/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-09-25"/);
});
