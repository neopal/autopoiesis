import test from 'node:test';
import assert from 'node:assert/strict';

const {
  ANCHOR_COUNT,
  MEMORY_WINDOW,
  MIN_STROKE_LENGTH,
  MIN_STROKE_POINTS,
  armStroke,
  buildFrame,
  buildTimeline,
  commitStroke,
  geometrySignature,
  liftLatestStroke,
  releaseMemory,
  strokeIsValid
} = await import('../studies/naive-art/v035/engine.mjs');

test('naive v035 begins as one deterministic memory plate, not a tiled model', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'pressure-misread');
  assert.equal(first.surface, 'single-memory-plate');
  assert.equal(first.memory.length, 0);
  assert.equal(first.anchors.length, ANCHOR_COUNT);
  assert.ok(first.aperture);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('naive v035 arms a bounded pressure stroke without drawing it', () => {
  const baseline = buildFrame();
  const armed = armStroke(baseline, { points: buildTimeline()[0] });

  assert.equal(armed.pending.length, buildTimeline()[0].length);
  assert.equal(armed.memory.length, 0);
  assert.equal(armed.interaction, 'stroke-armed');
  assert.equal(geometrySignature(armed), geometrySignature(baseline));
});

test('naive v035 refuses short, sparse, or sprawling pressure strokes', () => {
  const baseline = buildFrame();
  const short = commitStroke(armStroke(baseline, { points: [[0.2, 0.2], [0.2, 0.2]] }), { points: [[0.2, 0.2], [0.2, 0.2]] });
  const sparse = commitStroke(baseline, { points: [[0.1, 0.1]] });
  const sprawling = commitStroke(baseline, { points: [[0.05, 0.1], [0.98, 0.92], [0.92, 0.08]] });

  assert.equal(strokeIsValid(buildTimeline()[0]), true);
  assert.equal(strokeIsValid([[0.2, 0.2], [0.2, 0.2]]), false);
  assert.equal(strokeIsValid([[0.05, 0.1], [0.98, 0.92], [0.92, 0.08]]), false);
  assert.ok(MIN_STROKE_POINTS >= 3);
  assert.ok(MIN_STROKE_LENGTH > 0);
  for (const refused of [short, sparse, sprawling]) {
    assert.equal(refused.memory.length, 0);
    assert.equal(refused.interaction, 'stroke-refused');
    assert.equal(geometrySignature(refused), geometrySignature(baseline));
  }
});

test('naive v035 makes a remote false contour and a real absence from one stroke', () => {
  const baseline = buildFrame();
  const armed = armStroke(baseline, { points: buildTimeline()[0] });
  const changed = commitStroke(armed, { points: buildTimeline()[0] });
  const event = changed.memory.at(-1);
  const changedAnchors = changed.anchors.filter((anchor, index) => anchor.signature !== baseline.anchors[index].signature);

  assert.equal(event.kind, 'pressure-misread');
  assert.notEqual(event.source, event.transfer);
  assert.notEqual(event.source, event.absence);
  assert.notEqual(event.transfer, event.absence);
  assert.equal(changedAnchors.length, 4);
  assert.equal(changed.anchors[event.source].state, 'pressed');
  assert.equal(changed.anchors[event.transfer].state, 'false-contour');
  assert.equal(changed.anchors[event.absence].state, 'absence');
  assert.equal(changed.anchors[event.shadow].state, 'remembering');
  assert.notEqual(changed.aperture.signature, baseline.aperture.signature);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
});

test('naive v035 carries pressure into later production, bounds memory, and lifts exactly', () => {
  let frame = buildFrame();
  const signatures = [geometrySignature(frame)];

  for (const points of buildTimeline().concat(buildTimeline())) {
    frame = armStroke(frame, { points });
    frame = commitStroke(frame, { points });
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatestStroke(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseMemory(frame)), signatures[0]);
});

test('naive v035 exposes a p5 tableau and meaningful gesture paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('studies/naive-art/v035/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/naive-art/v035/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/naive-art/v035/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/naive-art/v035/README.md', root), 'utf8');

  assert.match(html, /id="plate-field"/);
  assert.match(html, /data-action="misread"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /createGraphics/);
  assert.match(sketch, /__mutineNaiveV035/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('naive v035 is registered exactly once for the 2026-10-25 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'naive' && entry.date === '2026-10-25');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-10-25');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v035/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-naive-2026-10-25');
  assert.equal(matches[0].decision.lineage, 'naive-2026-10-24');
  assert.equal(matches[0].source.referenceId, 'p5-brush');
});
