import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/p5-brush/v038/engine.mjs');

const { applyPinch, buildFrame, buildTimeline, geometrySignature, liftLatest, releaseLayers, selectSeam } = engine;

const SPAN = [1, 5];

test('brush v038 begins as a deterministic browser-native stack of cut laminae', () => {
  const initial = buildFrame();
  const replay = buildFrame();

  assert.equal(initial.grammar, 'lamina-stack');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.skins.length, engine.SKIN_COUNT);
  assert.equal(initial.seams.length, engine.SEAM_COUNT);
  assert.equal(geometrySignature(initial), geometrySignature(replay));
  assert.ok(initial.skins.every((skin) => skin.path.length >= 6));
});

test('brush v038 selects a first seam without moving the stack', () => {
  const initial = buildFrame();
  const selected = selectSeam(initial, SPAN[0]);

  assert.equal(selected.interaction, 'seam-selected');
  assert.deepEqual(selected.pending.seams, [SPAN[0]]);
  assert.equal(selected.memory.length, 0);
  assert.equal(geometrySignature(selected), geometrySignature(initial));
});

test('brush v038 turns a non-adjacent seam pair into a layered peel and remembers three material roles', () => {
  const initial = buildFrame();
  const changed = applyPinch(initial, ...SPAN, 'test-pinch');

  assert.equal(changed.interaction, 'pinch-committed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.event.committed, true);
  assert.equal(changed.event.type, 'pressure-span');
  assert.notEqual(changed.event.peelSkin, changed.event.sealSkin);
  assert.notEqual(changed.event.sealSkin, changed.event.shedSkin);
  assert.ok(changed.event.span >= 2);
  assert.ok(changed.skins.some((skin) => skin.peel > 0));
  assert.ok(changed.skins.some((skin) => skin.opening > 0));
  assert.ok(changed.skins.some((skin) => skin.sealed > 0));
  assert.notEqual(geometrySignature(changed), geometrySignature(initial));
});

test('brush v038 confines pressure to the chosen shortest seam interval', () => {
  const changed = applyPinch(buildFrame(), 1, 5, 'test-interval');
  const activeSeams = changed.seams.filter((seam) => seam.pressure > 0).map((seam) => seam.id);

  assert.deepEqual(activeSeams, [1, 2, 3, 4, 5]);
});

test('brush v038 refuses adjacent pressure spans and lifts the latest peel exactly', () => {
  const initial = buildFrame();
  const refused = applyPinch(initial, 2, 3, 'test-adjacent');
  const committed = applyPinch(initial, ...SPAN, 'test-pinch');
  const lifted = liftLatest(committed);

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'pinch-refused-adjacent');
  assert.equal(geometrySignature(refused), geometrySignature(initial));
  assert.equal(lifted.memory.length, 0);
  assert.equal(geometrySignature(lifted), geometrySignature(initial));
  assert.equal(releaseLayers(committed).memory.length, 0);
});

test('brush v038 bounds deterministic peel memory to four pressure spans', () => {
  const timeline = buildTimeline();
  const replay = buildTimeline();
  const settled = timeline.at(-1);

  assert.equal(timeline.length, engine.STAGES);
  assert.equal(settled.memory.length, engine.MEMORY_LIMIT);
  assert.deepEqual(settled.memory, replay.at(-1).memory);
  assert.equal(geometrySignature(settled), geometrySignature(replay.at(-1)));
  assert.ok(settled.skins.some((skin) => skin.peel > 0));
  assert.ok(settled.seams.some((seam) => seam.pressure > 0));
});

test('brush v038 exposes a DOM-first pressure-span encounter and evidence contract', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v038/index.html');
  const sketch = await read('studies/p5-brush/v038/sketch.js');
  const style = await read('studies/p5-brush/v038/style.css');
  const readme = await read('studies/p5-brush/v038/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v038/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v038/critiques.json'));

  assert.match(html, /id="lamina-stack"/);
  assert.match(html, /data-gesture="pinch"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /tabindex="0"/);
  assert.match(sketch, /selectSeam/);
  assert.match(sketch, /applyPinch/);
  assert.match(sketch, /pointerdown|click/);
  assert.match(sketch, /Delete/);
  assert.match(sketch, /_p5Ready/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /@media \(max-width: 680px\)/);
  for (const phrase of ['hypothesis', 'changed rule', 'visible consequence', 'falsifier', 'deletion condition']) {
    assert.match(readme, new RegExp(phrase, 'i'));
  }
  assert.equal(metrics.seed, '0x42523838');
  assert.equal(metrics.grammar, 'lamina-stack');
  assert.equal(metrics.renderer, 'deterministic browser-native DOM/CSS lamina stack');
  assert.equal(metrics.replay, true);
  assert.equal(critiques.length, 8);
});

test('brush v038 is registered exactly once for the 2026-10-26 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'brush' && work.date === '2026-10-26');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'brush-2026-10-26');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v038/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-brush-2026-10-26');
  assert.equal(matches[0].decision.lineage, 'brush-2026-10-24');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.match(matches[0].metrics.changedRule, /seam|lamina|peel/i);
  const canonical = await readFile(new URL('works/brush-2026-10-26/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="brush-2026-10-26"/);
});
