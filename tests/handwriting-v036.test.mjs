import test from 'node:test';
import assert from 'node:assert/strict';

const loadEngine = () => import('../studies/handwriting/v036/engine.mjs');

test('handwriting v036 builds a deterministic phoneme ecology rather than a rack or register', async () => {
  const { buildFrame, geometrySignature, SLOT_COUNT, MEMORY_WINDOW, MODE } = await loadEngine();
  const first = buildFrame([]);
  const second = buildFrame([]);

  assert.equal(SLOT_COUNT, 15);
  assert.equal(MEMORY_WINDOW, 4);
  assert.equal(MODE, 'phoneme-ecology');
  assert.equal(first.slots.length, SLOT_COUNT);
  assert.equal(first.history.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.slots.every((slot) => slot.text && Number.isFinite(slot.x) && Number.isFinite(slot.y)));
  assert.ok(new Set(first.slots.map((slot) => slot.family)).size >= 3);
});

test('handwriting v036 keeps situated attention neutral until a complete utterance is spoken', async () => {
  const { buildFrame, attend, speak, commitSpeech, geometrySignature } = await loadEngine();
  const baseline = buildFrame([]);
  const watched = attend(baseline, 4);
  const drafted = speak(watched, 'm');

  assert.equal(watched.active, 4);
  assert.equal(watched.lastEvent, 'attending');
  assert.equal(geometrySignature(watched), geometrySignature(baseline));
  assert.equal(drafted.draft, 'm');
  assert.equal(geometrySignature(drafted), geometrySignature(baseline));

  const refused = commitSpeech(drafted);
  assert.equal(refused.lastEvent, 'refused');
  assert.equal(refused.history.length, 0);
  assert.equal(geometrySignature(refused), geometrySignature(baseline));

  const spoken = commitSpeech(speak(watched, 'murmur'));
  assert.equal(spoken.lastEvent, 'spoken');
  assert.equal(spoken.history.length, 1);
  assert.ok(spoken.changedSlotIds.length >= 3);
  assert.ok(spoken.changedSlotIds.some((id) => id !== watched.active));
  assert.notEqual(geometrySignature(spoken), geometrySignature(baseline));
});

test('handwriting v036 distributes language memory and lifts the newest utterance exactly', async () => {
  const { buildFrame, speak, commitSpeech, liftLatest, release, geometrySignature, MEMORY_WINDOW } = await loadEngine();
  const phrases = ['murmur', 'unmake', 'listen', 'margin', 'answer'];
  let frame = buildFrame([]);
  const snapshots = [frame];
  for (const phrase of phrases) {
    frame = commitSpeech(speak(frame, phrase));
    snapshots.push(frame);
  }

  assert.equal(frame.history.length, phrases.length);
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.deepEqual(frame.memory.map((event) => event.phrase), phrases.slice(-MEMORY_WINDOW));
  assert.ok(frame.slots.some((slot) => slot.role === 'receiver'));
  assert.ok(frame.slots.some((slot) => slot.role === 'silence'));

  const lifted = liftLatest(frame);
  assert.equal(lifted.lastEvent, 'lifted');
  assert.equal(lifted.history.length, phrases.length - 1);
  assert.equal(geometrySignature(lifted), geometrySignature(snapshots.at(-2)));
  assert.equal(geometrySignature(release()), geometrySignature(buildFrame([])));
});

test('handwriting v036 leaves a canvas ecology and explicit art gate before explanation', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/handwriting/v036/index.html');
  const sketch = await read('studies/handwriting/v036/sketch.js');
  const style = await read('studies/handwriting/v036/style.css');
  const readme = await read('studies/handwriting/v036/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v036/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v036/critiques.json'));

  assert.match(html, /data-raw-work-id="typography-2026-10-28"/);
  assert.match(html, /id="phoneme-field"/);
  assert.match(html, /id="speech-input"/);
  assert.match(html, /id="speak-control"/);
  assert.match(html, /id="lift-speech"/);
  assert.match(html, /id="release-speech"/);
  assert.match(sketch, /getContext\(['"]2d/);
  assert.match(sketch, /commitSpeech/);
  assert.match(sketch, /__mutineHandwritingV036/);
  assert.match(style, /preview-mode/);
  assert.match(style, /prefers-reduced-motion/);
  for (const heading of ['## Hypothesis', '## Changed rule', '## Visible consequence', '## Falsifier', '## Deletion condition', '## Radical progression gate']) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
  }
  assert.equal(metrics.seed, '0x48574936');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.equal(metrics.referenceId, 'little-critters');
  assert.ok(Array.isArray(critiques) && critiques.length >= 8);
});

test('handwriting v036 QA proof records the responsive and interaction gates without invented evidence', async () => {
  const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const summary = JSON.parse(await read('research/qa/proofs/handwriting-v036-2026-10-28/qa-summary.json'));

  assert.equal(summary.localViewportRuns, 20);
  assert.equal(summary.localDiagnostics, 0);
  assert.equal(summary.localOverflow, 0);
  assert.equal(summary.localMinTouchTarget, 44);
  assert.equal(summary.interaction.committed, true);
  assert.equal(summary.interaction.previewGeometryUnchanged, true);
  assert.equal(summary.interaction.liftRestored, true);
  assert.equal(summary.interaction.remoteChange, true);
  assert.equal(summary.blind.memory, 4);
  assert.equal(summary.blind.controls, 'none');
});
