import test from 'node:test';
import assert from 'node:assert/strict';

const {
  FACET_COUNT,
  MEMORY_WINDOW,
  MIN_DWELL,
  armFacet,
  buildFrame,
  buildTimeline,
  commitObservation,
  geometrySignature,
  liftLatestObservation,
  observationIsValid,
  releaseMemory
} = await import('../studies/naive-art/v034/engine.mjs');

test('naive v034 begins as a deterministic false-reconstruction relief', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'false-reconstruction');
  assert.equal(first.surface, 'single-relief-model');
  assert.equal(first.memory.length, 0);
  assert.equal(first.facets.length, FACET_COUNT);
  assert.equal(first.facets.every((facet) => facet.state === 'quiet'), true);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('naive v034 holds a local look without changing the relief', () => {
  const baseline = buildFrame();
  const armed = armFacet(baseline, { facet: 4 });

  assert.deepEqual(armed.pending, [4]);
  assert.equal(armed.memory.length, 0);
  assert.equal(geometrySignature(armed), geometrySignature(baseline));
});

test('naive v034 refuses a short or repeated look without changing geometry', () => {
  const baseline = buildFrame();
  const short = commitObservation(armFacet(baseline, { facet: 4 }), { dwell: MIN_DWELL - 1 });
  const repeated = commitObservation(armFacet(armFacet(baseline, { facet: 4 }), { facet: 4 }), { dwell: MIN_DWELL });

  assert.equal(observationIsValid({ facet: 4, dwell: MIN_DWELL }), true);
  assert.equal(short.memory.length, 0);
  assert.equal(short.interaction, 'observation-refused');
  assert.equal(repeated.memory.length, 0);
  assert.equal(repeated.interaction, 'observation-refused');
  assert.equal(geometrySignature(short), geometrySignature(baseline));
  assert.equal(geometrySignature(repeated), geometrySignature(baseline));
});

test('naive v034 makes the least-observed facet reconstruct the wrong evidence', () => {
  const baseline = buildFrame();
  const observed = commitObservation(armFacet(baseline, { facet: 4 }), { dwell: MIN_DWELL + 180 });
  const event = observed.memory.at(-1);
  const changed = observed.facets.filter((facet, index) => geometrySignature({ facets: [facet] }) !== geometrySignature({ facets: [baseline.facets[index]] }));

  assert.equal(event.kind, 'false-reconstruction');
  assert.equal(event.lookedAt, 4);
  assert.notEqual(event.falseCopy, event.lookedAt);
  assert.notEqual(event.missing, event.lookedAt);
  assert.notEqual(event.falseCopy, event.missing);
  assert.equal(changed.length, 4);
  assert.equal(observed.facets[event.lookedAt].state, 'observed');
  assert.equal(observed.facets[event.falseCopy].state, 'false-copy');
  assert.equal(observed.facets[event.missing].state, 'missing');
  assert.equal(observed.facets[event.ridge].state, 'remembering');
  assert.notEqual(geometrySignature(observed), geometrySignature(baseline));
});

test('naive v034 remembers attention, bounds memory, and lifts the exact preceding relief', () => {
  let frame = buildFrame();
  const signatures = [geometrySignature(frame)];
  for (const facet of buildTimeline().concat(buildTimeline())) {
    frame = armFacet(frame, { facet });
    frame = commitObservation(frame, { dwell: MIN_DWELL + 90 });
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatestObservation(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseMemory(frame)), signatures[0]);
});

test('naive v034 exposes the relief tableau and meaningful interaction paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('studies/naive-art/v034/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/naive-art/v034/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/naive-art/v034/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/naive-art/v034/README.md', root), 'utf8');

  assert.match(html, /id="relief-field"/);
  assert.match(html, /data-action="observe"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /__mutineNaiveV034/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('naive v034 is registered exactly once for the 2026-10-24 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'naive' && entry.date === '2026-10-24');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-10-24');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v034/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-naive-2026-10-24');
  assert.equal(matches[0].decision.lineage, 'naive-2026-10-23');
  assert.equal(matches[0].source.referenceId, 'little-critters');
});
