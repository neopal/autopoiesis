import test from 'node:test';
import assert from 'node:assert/strict';

const {
  APERTURE_COUNT,
  MEMORY_WINDOW,
  buildFrame,
  geometrySignature
} = await import('../studies/pure-svg/v044/engine.mjs');

test('SVG v044 builds a deterministic topology skin with negative apertures', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'topology-skin');
  assert.equal(first.apertures.length, APERTURE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.shell.length >= 12);
  assert.ok(first.apertures.every((aperture) => aperture.path.length > 30));
});

test('SVG v044 keeps an attempted tear neutral until it escapes the skin', async () => {
  const {
    beginCut,
    escapeSurface,
    commitCut
  } = await import('../studies/pure-svg/v044/engine.mjs');
  const initial = buildFrame();
  const started = beginCut(initial, 2);
  const escaped = escapeSurface(started, 1);
  const committed = commitCut(escaped);

  assert.deepEqual(escaped.pending, [2, 1]);
  assert.equal(escaped.interaction, 'cut-ready');
  assert.equal(geometrySignature(escaped), geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'cut-committed');
  assert.equal(committed.event.type, 'topology-split');
  assert.equal(committed.apertures[2].signature, initial.apertures[2].signature);
  assert.equal(committed.apertures[committed.event.receiverAperture].topology, 'split');
  assert.notEqual(
    committed.apertures[committed.event.receiverAperture].signature,
    initial.apertures[committed.event.receiverAperture].signature
  );
});

test('SVG v044 compounds four topology cuts, lifts exactly, and releases to the seed', async () => {
  const {
    buildTimeline,
    liftLatestCut,
    releaseSkin
  } = await import('../studies/pure-svg/v044/engine.mjs');
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestCut(settled);
  const released = releaseSkin();

  assert.equal(timeline.length, MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.cutCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('SVG v044 refuses incomplete or re-entered cuts without changing topology', async () => {
  const { reenterSurface } = await import('../studies/pure-svg/v044/engine.mjs');
  const initial = buildFrame();
  const started = (await import('../studies/pure-svg/v044/engine.mjs')).beginCut(initial, 1);
  const crossed = (await import('../studies/pure-svg/v044/engine.mjs')).escapeSurface(started, 2);
  const reentered = reenterSurface(crossed, 1);
  const incomplete = (await import('../studies/pure-svg/v044/engine.mjs')).commitCut(started);

  assert.equal(reentered.interaction, 'cut-refused-reentry');
  assert.equal(geometrySignature(reentered), geometrySignature(initial));
  assert.equal(incomplete.interaction, 'cut-refused-incomplete');
  assert.equal(geometrySignature(incomplete), geometrySignature(initial));
});

test('SVG v044 is registered exactly once for the 2026-11-04 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-11-04');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-11-04');
  assert.equal(matches[0].title, 'The cut changes its elsewhere.');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v044/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-11-04');
  assert.equal(matches[0].decision.lineage, 'svg-2026-11-02');
  assert.equal(matches[0].source.referenceId, 'p5-brush');

  const canonical = await readFile(new URL('works/svg-2026-11-04/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-04"/);
});

test('SVG v044 exposes the production handoff and blind-preview contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v044/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v044/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v044/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v044/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v044/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="tear"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginCut/);
  assert.match(sketch, /commitCut/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG topology skin');
  assert.equal(metrics.commitThreshold, 'escape from one interior aperture to the rim, then release');
});
