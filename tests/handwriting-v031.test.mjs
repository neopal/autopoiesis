import test from 'node:test';
import assert from 'node:assert/strict';

const read = async (path) => (await import('node:fs/promises')).readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const loadEngine = () => import('../studies/handwriting/v031/engine.mjs');

test('handwriting v031 builds a deterministic station route field', async () => {
  const { buildFrame, geometrySignature, STATION_COUNT } = await loadEngine();
  const first = buildFrame(0, []);
  const second = buildFrame(0, []);

  assert.equal(STATION_COUNT, 11);
  assert.equal(first.stations.length, STATION_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.route.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
  assert.ok(first.stations.every((station) => station.glyph && station.path));
  assert.ok(first.routePaths.length >= STATION_COUNT - 1);
});

test('handwriting v031 resolves a pointer to the nearest visible station without changing geometry', async () => {
  const { nearestStation } = await loadEngine();
  const points = [{ id: 1, x: 100, y: 200 }, { id: 6, x: 320, y: 110 }];

  assert.equal(nearestStation(points, { x: 104, y: 197 }, 18), 1);
  assert.equal(nearestStation(points, { x: 320, y: 110 }, 18), 6);
  assert.equal(nearestStation(points, { x: 180, y: 180 }, 18), -1);
});

test('handwriting v031 keeps the first two route crossings geometry-neutral', async () => {
  const { buildFrame, traceStation, geometrySignature } = await loadEngine();
  const baseline = buildFrame(0, []);
  const first = traceStation(baseline, 2);
  const second = traceStation(first, 7);

  assert.deepEqual(first.route, [2]);
  assert.deepEqual(second.route, [2, 7]);
  assert.equal(geometrySignature(first), geometrySignature(baseline));
  assert.equal(geometrySignature(second), geometrySignature(baseline));
  assert.equal(second.memory.length, 0);
});

test('handwriting v031 commits only a complete route and changes three actual station geometries', async () => {
  const { buildFrame, traceStation, commitRoute, geometrySignature } = await loadEngine();
  let frame = buildFrame(0, []);
  frame = traceStation(frame, 2);
  frame = traceStation(frame, 7);
  frame = traceStation(frame, 9);
  const committed = commitRoute(frame);

  assert.equal(committed.memory.length, 1);
  assert.deepEqual(committed.memory[0].route, [2, 7, 9]);
  assert.equal(committed.route.length, 0);
  assert.equal(committed.lastEvent, 'route');
  assert.notEqual(geometrySignature(committed), geometrySignature(buildFrame(0, [])));
  assert.ok(committed.changedStationIds.length >= 3);
  assert.notEqual(committed.stations[2].path, buildFrame(0, []).stations[2].path);
  assert.notEqual(committed.stations[7].path, buildFrame(0, []).stations[7].path);
  assert.notEqual(committed.stations[9].path, buildFrame(0, []).stations[9].path);
});

test('handwriting v031 rejects repeated or incomplete routes without mutation', async () => {
  const { buildFrame, traceStation, commitRoute, geometrySignature } = await loadEngine();
  let frame = buildFrame(0, []);
  frame = traceStation(frame, 3);
  const incomplete = commitRoute(frame);
  assert.equal(incomplete.lastEvent, 'refused');
  assert.equal(incomplete.memory.length, 0);
  assert.equal(geometrySignature(incomplete), geometrySignature(buildFrame(0, [])));

  frame = traceStation(frame, 3);
  assert.deepEqual(frame.route, [3]);
  assert.equal(geometrySignature(frame), geometrySignature(buildFrame(0, [])));
});

test('handwriting v031 lifts the latest route back to the exact preceding field', async () => {
  const { buildFrame, traceStation, commitRoute, liftLatestRoute, geometrySignature } = await loadEngine();
  const baseline = buildFrame(0, []);
  let frame = traceStation(baseline, 1);
  frame = traceStation(frame, 5);
  frame = traceStation(frame, 8);
  const changed = commitRoute(frame);
  const restored = liftLatestRoute(changed);

  assert.equal(restored.memory.length, 0);
  assert.equal(geometrySignature(restored), geometrySignature(baseline));
});

test('handwriting v031 compounds a bounded four-route memory deterministically', async () => {
  const { buildFrame, traceStation, commitRoute, geometrySignature, MEMORY_WINDOW } = await loadEngine();
  const routes = [[0, 4, 10], [2, 6, 8], [1, 7, 5], [9, 3, 6], [4, 8, 2]];
  let frame = buildFrame(0, []);
  for (const route of routes) {
    for (const station of route) frame = traceStation(frame, station);
    frame = commitRoute(frame);
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.deepEqual(frame.memory.map((event) => event.route), routes.slice(-MEMORY_WINDOW));
  let replay = buildFrame(0, []);
  for (const route of routes) {
    for (const station of route) replay = traceStation(replay, station);
    replay = commitRoute(replay);
  }
  assert.equal(geometrySignature(frame), geometrySignature(replay));
});

test('handwriting v031 exposes the route tableau before explanation', async () => {
  const html = await read('studies/handwriting/v031/index.html');
  const sketch = await read('studies/handwriting/v031/sketch.js');
  const style = await read('studies/handwriting/v031/style.css');

  assert.match(html, /data-raw-work-id="typography-2026-10-23"/);
  assert.match(html, /<figure[^>]+class="route-work artwork-frame"/);
  assert.match(html, /id="route-svg"/);
  assert.match(html, /id="lift-route"/);
  assert.match(html, /id="release-route"/);
  assert.match(sketch, /traceStation/);
  assert.match(sketch, /commitRoute/);
  assert.match(sketch, /liftLatestRoute/);
  assert.match(sketch, /__mutineHandwritingV031/);
  assert.match(style, /preview-mode/);
});

test('handwriting v031 proof summary counts the captured screenshots exactly', async () => {
  const { readdir } = await import('node:fs/promises');
  const proofRoot = new URL('../research/qa/proofs/handwriting-v031-2026-10-23/', import.meta.url);
  const files = await readdir(proofRoot);
  const summary = JSON.parse(await read('research/qa/proofs/handwriting-v031-2026-10-23/qa-summary.json'));

  assert.equal(summary.screenshotCount, files.filter((file) => file.endsWith('.png')).length);
});

test('handwriting v031 keeps an explicit art gate and one daily catalogue record', async () => {
  const readme = await read('studies/handwriting/v031/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v031/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v031/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const matching = data.works.filter((work) => work.currentId === 'typography' && work.date === '2026-10-23');

  assert.match(readme, /## Hypothesis/);
  assert.match(readme, /## Changed rule/);
  assert.match(readme, /## Visible consequence/);
  assert.match(readme, /## Falsifier/);
  assert.match(readme, /## Deletion condition/);
  assert.equal(metrics.seed, '0x48574931');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.memoryWindow, 4);
  assert.ok(Array.isArray(critiques) && critiques.length >= 5);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'typography-2026-10-23');
  assert.equal(matching[0].rawPath, '/studies/handwriting/v031/');
  assert.equal(matching[0].journal.anchor, 'journal-typography-2026-10-23');
  const workHtml = await read('works/typography-2026-10-23/index.html');
  assert.match(workHtml, /data-catalog-work-detail="typography-2026-10-23"/);
});
