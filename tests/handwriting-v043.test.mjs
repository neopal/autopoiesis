import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v043/engine.mjs');

const source = 4;

test('Handwriting v043 keeps an attention pending until dwell commits a remote reflow', async () => {
  const { buildFrame, previewAttention, commitAttention, geometrySignature, PANEL_COUNT } = await engine();
  const quiet = buildFrame();
  const pending = previewAttention(quiet, source);

  assert.equal(PANEL_COUNT, 9);
  assert.equal(geometrySignature(pending), geometrySignature(quiet));
  assert.deepEqual(pending.pending, [source]);
  assert.equal(pending.memory.length, 0);

  const committed = commitAttention(pending);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'attention-fugue');
  assert.ok(committed.changedPanelIds.length >= 2);
  assert.ok(committed.changedPanelIds.every((id) => id !== source));
  assert.notEqual(geometrySignature(committed), geometrySignature(quiet));
  assert.deepEqual(committed.pending, []);
  assert.deepEqual(committed.field.panels[source], quiet.field.panels[source]);
});

test('Handwriting v043 compounds four attention reflows and lifts exactly', async () => {
  const { MEMORY_WINDOW, buildFrame, previewAttention, commitAttention, geometrySignature, liftLatest, release } = await engine();
  const quiet = buildFrame();
  const timeline = [];
  let frame = quiet;

  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    frame = commitAttention(previewAttention(frame, index % 9));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(frame.history.length, MEMORY_WINDOW + 1);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
});

test('Handwriting v043 refuses missing panels and exposes a DOM attention-fugue tableau', async () => {
  const { buildFrame, previewAttention, commitAttention } = await engine();
  const quiet = buildFrame();
  const refused = commitAttention(previewAttention(quiet, 99));
  assert.equal(refused.memory.length, 0);
  assert.match(refused.lastEvent, /refused/);

  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v043/index.html');
  const sketch = await read('studies/handwriting/v043/sketch.js');
  const style = await read('studies/handwriting/v043/style.css');
  const readme = await read('studies/handwriting/v043/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v043/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v043/critiques.json'));

  assert.match(index, /id="fugue-field"/);
  assert.match(index, /data-action="attend"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /data-panel-id/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /touch/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitAttention/);
  assert.match(sketch, /liftLatest/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.match(metrics.renderer, /DOM/);
  assert.match(metrics.memoryRule, /remote|reflow/i);
  assert.ok(critiques.length >= 9);
});

test('Handwriting v043 records exactly once for the 2026-11-05 daily slot with a canonical tableau route', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const publicCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const canonical = await read('works/typography-2026-11-05/index.html');
  const matches = works.works.filter((work) => work.currentId === 'typography' && work.date === '2026-11-05');
  const publicMatches = publicCatalog.works.works.filter((work) => work.id === 'typography-2026-11-05');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/handwriting/v043/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].source.referenceId, 'little-critters');
  assert.equal(publicMatches.length, 1);
  assert.match(canonical, /data-catalog-work-detail="typography-2026-11-05"/);
});
