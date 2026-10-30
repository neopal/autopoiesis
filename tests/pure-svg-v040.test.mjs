import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MEMORY_WINDOW,
  PORTAL_COUNT,
  armWitness,
  buildFrame,
  buildTimeline,
  commitResponse,
  geometrySignature,
  liftLatestResponse,
  releaseMass
} = await import('../studies/pure-svg/v040/engine.mjs');

const SOURCE_INDEX = 2;

function committedFrame(frame, index = SOURCE_INDEX) {
  return commitResponse(armWitness(frame, index));
}

test('SVG v040 arms a witness without changing the compound mass', () => {
  const initial = buildFrame();
  const armed = armWitness(initial, SOURCE_INDEX);

  assert.equal(initial.grammar, 'reciprocal-aperture');
  assert.equal(initial.memory.length, 0);
  assert.equal(initial.portals.length, PORTAL_COUNT);
  assert.equal(armed.interaction, 'witness-armed');
  assert.equal(armed.event.committed, false);
  assert.equal(armed.selectedIndex, SOURCE_INDEX);
  assert.equal(geometrySignature(armed), geometrySignature(initial));
  assert.equal(armed.mass.pathSignature, initial.mass.pathSignature);
});

test('SVG v040 commits a remote response and keeps the witnessed aperture exact', () => {
  const initial = buildFrame();
  const armed = armWitness(initial, SOURCE_INDEX);
  const next = commitResponse(armed);

  assert.equal(next.memory.length, 1);
  assert.equal(next.event.committed, true);
  assert.equal(next.event.type, 'reciprocal-response');
  assert.equal(next.event.sourceIndex, SOURCE_INDEX);
  assert.equal(next.interaction, 'response-committed');
  assert.equal(next.mass.portalCount, PORTAL_COUNT);
  assert.notEqual(geometrySignature(next), geometrySignature(initial));
  assert.notEqual(next.mass.pathSignature, initial.mass.pathSignature);
  assert.equal(next.portals[SOURCE_INDEX].signature, initial.portals[SOURCE_INDEX].signature);
  assert.ok(next.event.remoteIndices.every((index) => index !== SOURCE_INDEX));
});

test('SVG v040 refuses an unarmed response and a duplicate selection stays geometry-neutral', () => {
  const initial = buildFrame();
  const refused = commitResponse(initial);
  const armed = armWitness(initial, 1);
  const rearmed = armWitness(armed, 1);

  assert.equal(refused.memory.length, 0);
  assert.equal(refused.interaction, 'response-refused-unarmed');
  assert.equal(geometrySignature(refused), geometrySignature(initial));
  assert.equal(geometrySignature(rearmed), geometrySignature(initial));
  assert.equal(rearmed.selectedIndex, 1);
});

test('SVG v040 compounds four reciprocal responses, lifts exactly, and releases to seed', () => {
  const timeline = buildTimeline();
  const settled = timeline.at(-1);
  const initial = buildFrame();
  const lifted = liftLatestResponse(settled);
  const released = releaseMass();

  assert.equal(settled.memory.length, MEMORY_WINDOW);
  assert.equal(settled.state.responseCount, MEMORY_WINDOW);
  assert.deepEqual(buildTimeline(), timeline);
  assert.notEqual(geometrySignature(settled), geometrySignature(initial));
  assert.notEqual(geometrySignature(lifted), geometrySignature(settled));
  assert.equal(lifted.memory.length, MEMORY_WINDOW - 1);
  assert.equal(released.memory.length, 0);
  assert.equal(geometrySignature(released), geometrySignature(initial));
});

test('SVG v040 exposes an aperture-first encounter and cultural handoff metadata', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v040/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v040/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v040/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v040/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v040/metrics.json', root), 'utf8'));

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="answer"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(index, /location\.hash === '#interaction'/);
  assert.match(index, /location\.hash === '#static'/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /armWitness/);
  assert.match(sketch, /commitResponse/);
  assert.match(sketch, /removeAttribute\('aria-keyshortcuts'\)/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG reciprocal aperture mass');
  assert.equal(metrics.commitThreshold, 'a witnessed aperture followed by an explicit answer');
});

test('SVG v040 is registered exactly once for the 2026-10-30 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.currentId === 'svg' && work.date === '2026-10-30');

  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'svg-2026-10-30');
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v040/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].lifecycle, 'active');
  assert.equal(matches[0].journal.anchor, 'journal-svg-2026-10-30');
  assert.equal(matches[0].decision.lineage, 'svg-2026-10-29');
  assert.equal(matches[0].source.referenceId, 'little-critters');

  const canonical = await readFile(new URL('works/svg-2026-10-30/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-10-30"/);
});
