import test from 'node:test';
import assert from 'node:assert/strict';

const loadEngine = () => import('../studies/handwriting/v034/engine.mjs');

test('handwriting v034 builds a deterministic double-register of situated letter fragments', async () => {
  const { buildFrame, geometrySignature, FRAGMENT_COUNT, MEMORY_WINDOW } = await loadEngine();
  const first = buildFrame([]);
  const second = buildFrame([]);

  assert.equal(FRAGMENT_COUNT, 14);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(first.fragments.length, FRAGMENT_COUNT);
  assert.equal(first.history.length, 0);
  assert.equal(first.mode, 'double-register');
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.fragments.every((fragment) => fragment.token && Number.isFinite(fragment.x) && Number.isFinite(fragment.y)));
  assert.equal(new Set(first.fragments.map((fragment) => fragment.register)).size, 2);
  assert.ok(first.fragments.some((fragment) => fragment.role === 'interval'));
});

test('handwriting v034 keeps attention geometry-neutral and only departure can make a remote answer', async () => {
  const { buildFrame, attend, withdrawPresence, geometrySignature } = await loadEngine();
  const baseline = buildFrame([]);
  const watched = attend(baseline, 2);

  assert.equal(watched.active, 2);
  assert.equal(watched.lastEvent, 'attending');
  assert.equal(geometrySignature(watched), geometrySignature(baseline));

  const answered = withdrawPresence(watched);
  assert.equal(answered.lastEvent, 'withdrawal');
  assert.equal(answered.active, null);
  assert.equal(answered.history.length, 1);
  assert.ok(answered.changedFragmentIds.length >= 3);
  assert.ok(answered.fragments.some((fragment) => fragment.answer === 1 && fragment.register !== watched.fragments[2].register));
  assert.notEqual(geometrySignature(answered), geometrySignature(baseline));

  const unobserved = withdrawPresence(baseline);
  assert.equal(unobserved.lastEvent, 'refused');
  assert.equal(unobserved.history.length, 0);
  assert.equal(geometrySignature(unobserved), geometrySignature(baseline));
});

test('handwriting v034 compounds four departures and lifts the newest remote answer exactly', async () => {
  const { buildFrame, attend, withdrawPresence, liftLatest, release, geometrySignature, MEMORY_WINDOW } = await loadEngine();
  const sources = [2, 5, 1, 9, 4];
  let frame = buildFrame([]);
  const snapshots = [frame];
  for (const source of sources) {
    frame = withdrawPresence(attend(frame, source));
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

test('handwriting v034 exposes a browser-native typographic tableau before explanation', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/handwriting/v034/index.html');
  const sketch = await read('studies/handwriting/v034/sketch.js');
  const style = await read('studies/handwriting/v034/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-10-26"/);
  assert.match(html, /<figure[^>]+class="register-work artwork-frame"/);
  assert.match(html, /id="register-field"/);
  assert.match(html, /id="register-stage"/);
  assert.match(html, /id="withdraw-control"/);
  assert.match(html, /id="lift-register"/);
  assert.match(html, /id="release-register"/);
  assert.match(sketch, /attend/);
  assert.match(sketch, /withdrawPresence/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /__mutineHandwritingV034/);
  assert.match(style, /preview-mode/);
  assert.match(style, /prefers-reduced-motion/);
});

test('handwriting v034 keeps the art gate, cultural translation, and one daily record explicit', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const readme = await read('studies/handwriting/v034/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v034/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v034/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-26');

  for (const heading of ['## Hypothesis', '## Changed rule', '## Visible consequence', '## Falsifier', '## Deletion condition', '## Radical progression gate']) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
  }
  assert.equal(metrics.seed, '0x48574934');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'little-critters');
  assert.ok(Array.isArray(critiques) && critiques.length >= 8);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-10-26');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v034/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-10-26');
  assert.equal(matching[0].source.referenceId, 'little-critters');
  const workHtml = await read('works/typography-2026-10-26/index.html');
  assert.match(workHtml, /data-catalog-work-detail="typography-2026-10-26"/);
});

test('handwriting v034 QA proof records the release gates without invented browser evidence', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const summary = JSON.parse(await read('research/qa/proofs/handwriting-v034-2026-10-26/qa-summary.json'));

  assert.equal(summary.localViewportRuns, 20);
  assert.equal(summary.localDiagnostics, 0);
  assert.equal(summary.localOverflow, 0);
  assert.equal(summary.localMinTouchTarget, 44);
  assert.equal(summary.interaction.committed, true);
  assert.equal(summary.interaction.previewGeometryUnchanged, true);
  assert.equal(summary.interaction.liftRestored, true);
  assert.equal(summary.blind.memory, 4);
  assert.equal(summary.blind.controls, 'none');
});
