import test from 'node:test';
import assert from 'node:assert/strict';

const {
  DEPOSIT_COUNT,
  RELAY_LIMIT,
  SEED,
  buildFrame,
  geometrySignature
} = await import('../studies/p5-brush/v054/engine.mjs');

test('brush v054 begins as a deterministic detached relay ledger', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(SEED, 0x42523534);
  assert.equal(DEPOSIT_COUNT, 9);
  assert.equal(RELAY_LIMIT, 4);
  assert.equal(first.composition, 'relay-ledger');
  assert.equal(first.renderer, 'inline-svg');
  assert.equal(first.interaction, 'quiet ledger');
  assert.equal(first.memory.length, 0);
  assert.equal(first.body.deposits.length, DEPOSIT_COUNT);
  assert.equal(first.body.relays.length, 0);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('brush v054 turns a complete pressure relay into a global transfer between detached deposits', async () => {
  const { commitRelay } = await import('../studies/p5-brush/v054/engine.mjs');
  const quiet = buildFrame();
  const result = commitRelay(quiet, {
    source: 'west', receiver: 'east', pressure: 0.76, counterpressure: 0.82, shear: 0.28
  });

  assert.equal(result.accepted, true);
  assert.equal(result.event.kind, 'pressure-relay');
  assert.equal(result.field.memory.length, 1);
  assert.equal(result.field.body.relays.length, 1);
  assert.notEqual(geometrySignature(result.field), geometrySignature(quiet));
  assert.ok(result.field.body.deposits.every((deposit, index) => {
    const base = quiet.body.deposits[index];
    return deposit.x !== base.x || deposit.y !== base.y || deposit.rotation !== base.rotation;
  }));
});

test('brush v054 refuses same-site, weak, or unbent pressure without changing the ledger', async () => {
  const { commitRelay } = await import('../studies/p5-brush/v054/engine.mjs');
  const quiet = buildFrame();
  const sameSite = commitRelay(quiet, { source: 'west', receiver: 'west', pressure: 0.9, counterpressure: 0.9, shear: 0.3 });
  const weak = commitRelay(quiet, { source: 'north', receiver: 'south', pressure: 0.2, counterpressure: 0.9, shear: 0.3 });
  const straight = commitRelay(quiet, { source: 'east', receiver: 'west', pressure: 0.9, counterpressure: 0.9, shear: 0.01 });

  assert.equal(sameSite.accepted, false);
  assert.equal(weak.accepted, false);
  assert.equal(straight.accepted, false);
  assert.equal(geometrySignature(sameSite.field), geometrySignature(quiet));
  assert.equal(geometrySignature(weak.field), geometrySignature(quiet));
  assert.equal(geometrySignature(straight.field), geometrySignature(quiet));
});

test('brush v054 makes relay order visible and lifts the latest transfer exactly', async () => {
  const { buildTimeline, commitRelay, liftLatest, releaseLedger } = await import('../studies/p5-brush/v054/engine.mjs');
  const first = { source: 'west', receiver: 'east', pressure: 0.76, counterpressure: 0.82, shear: 0.28 };
  const second = { source: 'north', receiver: 'south', pressure: 0.64, counterpressure: 0.78, shear: -0.22 };
  const forward = commitRelay(commitRelay(buildFrame(), first).field, second).field;
  const reverse = commitRelay(commitRelay(buildFrame(), second).field, first).field;
  const timeline = buildTimeline();
  const latest = timeline.at(-1);
  const lifted = liftLatest(latest);

  assert.notEqual(geometrySignature(forward), geometrySignature(reverse));
  assert.equal(timeline.length, RELAY_LIMIT + 1);
  assert.equal(latest.memory.length, RELAY_LIMIT);
  assert.equal(lifted.interaction, 'lifted / exact');
  assert.equal(geometrySignature(lifted), geometrySignature(timeline.at(-2)));
  assert.equal(releaseLedger().memory.length, 0);
  assert.equal(geometrySignature(releaseLedger()), geometrySignature(buildFrame()));
});

test('brush v054 exposes an SVG relay tableau with pointer, touch, and keyboard paths', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const html = await read('studies/p5-brush/v054/index.html');
  const sketch = await read('studies/p5-brush/v054/sketch.js');
  const style = await read('studies/p5-brush/v054/style.css');

  assert.match(html, /data-relay-stage/);
  assert.match(html, /data-relay-svg/);
  assert.match(html, /data-gesture="relay"/);
  assert.match(html, /data-gesture="lift"/);
  assert.match(html, /data-gesture="release"/);
  assert.match(html, /<svg/i);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup|pointercancel/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /commitRelay/);
  assert.match(sketch, /__mutineBrushV054/);
  assert.match(style, /prefers-reduced-motion/);
  assert.doesNotMatch(style, /@import\s+url\(['"]https?:\/\//i);
});

test('brush v054 has one canonical daily record and records the art gate', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const works = JSON.parse(await read('studio/data/works.json'));
  const catalog = JSON.parse(await read('studio/data/catalog-public.json'));
  const matches = works.works.filter((work) => work.id === 'brush-2026-11-11');
  const publicMatches = catalog.works.works.filter((work) => work.id === 'brush-2026-11-11');
  const canonical = await read('works/brush-2026-11-11/index.html');
  const readme = await read('studies/p5-brush/v054/README.md');
  const metrics = JSON.parse(await read('studies/p5-brush/v054/metrics.json'));
  const critiques = JSON.parse(await read('studies/p5-brush/v054/critiques.json'));

  assert.equal(matches.length, 1);
  assert.equal(publicMatches.length, 1);
  assert.equal(matches[0].currentId, 'brush');
  assert.equal(matches[0].date, '2026-11-11');
  assert.equal(matches[0].rawPath, '/studies/p5-brush/v054/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.match(matches[0].journal.anchor, /journal-brush-2026-11-11/);
  assert.equal(matches[0].source.referenceId, 'p5-brush');
  assert.equal(publicMatches[0].source, undefined);
  assert.equal(metrics.grammar, 'relay-ledger');
  assert.equal(metrics.memoryWindow, 4);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.ok(critiques.some((critique) => critique.persona === 'Perceptual critic' && critique.status === 'unresolved'));
  assert.ok(critiques.some((critique) => critique.persona === 'Cynic' && critique.status === 'gate'));
  assert.match(canonical, /data-work-id="brush-2026-11-11"/);
  assert.match(canonical, /catalog\.js/);
});
