import test from 'node:test';
import assert from 'node:assert/strict';

const loadEngine = () => import('../studies/handwriting/v035/engine.mjs');

 test('handwriting v035 builds a deterministic pressure-casting rack', async () => {
  const { buildFrame, geometrySignature, BLOCK_COUNT, MEMORY_WINDOW, MODE } = await loadEngine();
  const first = buildFrame([]);
  const second = buildFrame([]);

  assert.equal(BLOCK_COUNT, 12);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(MODE, 'pressure-casting-rack');
  assert.equal(first.blocks.length, BLOCK_COUNT);
  assert.equal(first.history.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.blocks.every((block) => block.token && Number.isFinite(block.x) && Number.isFinite(block.y) && Number.isFinite(block.depth)));
  assert.ok(new Set(first.blocks.map((block) => block.tier)).size >= 3);
});

test('handwriting v035 keeps a pressure charge neutral until release, then casts remotely', async () => {
  const { buildFrame, beginPressure, releasePressure, geometrySignature } = await loadEngine();
  const baseline = buildFrame([]);
  const charged = beginPressure(baseline, 3, 480);

  assert.equal(charged.active, 3);
  assert.equal(charged.lastEvent, 'charging');
  assert.equal(geometrySignature(charged), geometrySignature(baseline));

  const cast = releasePressure(charged, 920);
  assert.equal(cast.lastEvent, 'cast');
  assert.equal(cast.active, null);
  assert.equal(cast.history.length, 1);
  assert.ok(cast.changedBlockIds.length >= 3);
  assert.ok(cast.blocks[3].depth === baseline.blocks[3].depth);
  assert.ok(cast.blocks.some((block) => block.role === 'receiver' && block.id !== 3 && block.depth !== baseline.blocks[block.id].depth));
  assert.notEqual(geometrySignature(cast), geometrySignature(baseline));

  const refused = releasePressure(baseline, 920);
  assert.equal(refused.lastEvent, 'refused');
  assert.equal(refused.history.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(baseline));
});

test('handwriting v035 compounds pressure memory and lifts the newest cast exactly', async () => {
  const { buildFrame, beginPressure, releasePressure, liftLatest, release, geometrySignature, MEMORY_WINDOW } = await loadEngine();
  const sources = [3, 8, 1, 10, 5];
  let frame = buildFrame([]);
  const snapshots = [frame];
  for (const source of sources) {
    frame = releasePressure(beginPressure(frame, source, 420 + source * 11), 760 + source * 17);
    snapshots.push(frame);
  }

  assert.equal(frame.history.length, sources.length);
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.deepEqual(frame.memory.map((event) => event.source), sources.slice(-MEMORY_WINDOW));

  const lifted = liftLatest(frame);
  assert.equal(lifted.lastEvent, 'lifted');
  assert.equal(lifted.history.length, sources.length - 1);
  assert.equal(geometrySignature(lifted), geometrySignature(snapshots[snapshots.length - 2]));
  assert.equal(geometrySignature(release()), geometrySignature(buildFrame([])));
});

test('handwriting v035 exposes a WebGL pressure rack before explanation', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/handwriting/v035/index.html');
  const sketch = await read('studies/handwriting/v035/sketch.js');
  const style = await read('studies/handwriting/v035/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-10-27"/);
  assert.match(html, /id="casting-field"/);
  assert.match(html, /id="cast-canvas"/);
  assert.match(html, /id="cast-control"/);
  assert.match(html, /id="lift-cast"/);
  assert.match(html, /id="release-cast"/);
  assert.match(sketch, /getContext\(['"]webgl/);
  assert.match(sketch, /beginPressure/);
  assert.match(sketch, /releasePressure/);
  assert.match(sketch, /__mutineHandwritingV035/);
  assert.match(style, /preview-mode/);
  assert.match(style, /prefers-reduced-motion/);
});

test('handwriting v035 keeps the art gate, cultural translation, and one daily record explicit', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const readme = await read('studies/handwriting/v035/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v035/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v035/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-27');

  for (const heading of ['## Hypothesis', '## Changed rule', '## Visible consequence', '## Falsifier', '## Deletion condition', '## Radical progression gate']) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
  }
  assert.equal(metrics.seed, '0x48574935');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'p5-brush');
  assert.ok(Array.isArray(critiques) && critiques.length >= 8);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-10-27');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v035/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-10-27');
  assert.equal(matching[0].source.referenceId, 'p5-brush');
  const workHtml = await read('works/typography-2026-10-27/index.html');
  assert.match(workHtml, /data-catalog-work-detail="typography-2026-10-27"/);
});
