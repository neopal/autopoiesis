import test from 'node:test';
import assert from 'node:assert/strict';

const engine = () => import('../studies/handwriting/v039/engine.mjs');

const route = [0, 3, 7, 10];

function visitRoute(api, frame, ids = route) {
  let next = api.beginRoute(frame, ids[0]);
  for (const id of ids.slice(1)) next = api.appendRoute(next, id);
  return next;
}

test('Handwriting v039 keeps a traced route geometry-neutral until four distinct junctions rewire remote paths', async () => {
  const {
    buildFrame,
    beginRoute,
    appendRoute,
    commitRoute,
    geometrySignature,
    ROUTE_LENGTH
  } = await engine();
  const quiet = buildFrame();
  const armed = beginRoute(quiet, route[0]);
  const traced = appendRoute(appendRoute(appendRoute(armed, route[1]), route[2]), route[3]);

  assert.equal(ROUTE_LENGTH, 4);
  assert.equal(geometrySignature(armed), geometrySignature(quiet));
  assert.equal(geometrySignature(traced), geometrySignature(quiet));
  assert.equal(traced.pending.length, ROUTE_LENGTH);
  assert.equal(traced.memory.length, 0);

  const committed = commitRoute(traced);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.memory[0].mode, 'remote-rewire');
  assert.ok(committed.changedJunctionIds.length >= 3);
  assert.ok(committed.changedJunctionIds.every((id) => !route.includes(id)));
  assert.notEqual(committed.field.signature, quiet.field.signature);

  for (const id of route) {
    assert.deepEqual(committed.field.junctions[id], quiet.field.junctions[id]);
  }
});

test('Handwriting v039 refuses incomplete or repeated routes, compounds four rewirings, and lifts exactly', async () => {
  const {
    MEMORY_WINDOW,
    ROUTE_LENGTH,
    buildFrame,
    beginRoute,
    appendRoute,
    commitRoute,
    geometrySignature,
    liftLatest,
    release
  } = await engine();
  const quiet = buildFrame();
  const incomplete = commitRoute(appendRoute(beginRoute(quiet, route[0]), route[1]));
  const repeated = commitRoute(appendRoute(appendRoute(beginRoute(quiet, route[0]), route[1]), route[0]));
  assert.equal(incomplete.memory.length, 0);
  assert.equal(repeated.memory.length, 0);
  assert.match(incomplete.lastEvent, /refused/);
  assert.match(repeated.lastEvent, /refused/);

  const timeline = [];
  let frame = quiet;
  for (let index = 0; index < MEMORY_WINDOW + 1; index += 1) {
    timeline.push(frame);
    const ids = [
      (index + 0) % 12,
      (index + 3) % 12,
      (index + 6) % 12,
      (index + 9) % 12
    ];
    frame = commitRoute(visitRoute({ beginRoute, appendRoute }, frame, ids));
  }
  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(frame.history.length, MEMORY_WINDOW + 1);
  assert.equal(geometrySignature(liftLatest(frame)), geometrySignature(timeline.at(-1)));
  assert.equal(geometrySignature(release()), geometrySignature(quiet));
  assert.equal(ROUTE_LENGTH, route.length);
});

test('Handwriting v039 exposes a canvas route tableau with art-gate evidence and equivalent paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const index = await read('studies/handwriting/v039/index.html');
  const sketch = await read('studies/handwriting/v039/sketch.js');
  const style = await read('studies/handwriting/v039/style.css');
  const readme = await read('studies/handwriting/v039/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v039/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v039/critiques.json'));

  assert.match(index, /id="route-field"/);
  assert.match(index, /data-action="rewire"/);
  assert.match(index, /data-action="lift"/);
  assert.match(index, /data-action="release"/);
  assert.match(index, /canvas/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /closest\(['"]button['"]\)/);
  assert.match(sketch, /commitRoute/);
  assert.match(sketch, /liftLatest/);
  assert.match(sketch, /release/);
  assert.match(sketch, /keydown/);
  assert.match(style, /prefers-reduced-motion/);
  assert.match(style, /@media \(max-width: 680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.match(metrics.renderer, /Canvas/);
  assert.match(metrics.memoryRule, /route|junction|remote/i);
  assert.ok(critiques.length >= 9);
});
