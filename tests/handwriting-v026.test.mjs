import test from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => import('node:fs/promises').then(({ readFile }) => readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('handwriting v026 turns proximity then withdrawal into distributed route custody', async () => {
  const { buildFrame, commitDeparture, geometrySignature } = await import('../studies/handwriting/v026/engine.mjs');
  const baseline = buildFrame(0, []);
  const armed = commitDeparture(baseline, { glyph: 2, distance: 0.32 });
  const changed = commitDeparture(armed, { glyph: 2, distance: 0.84 });

  assert.equal(baseline.composition, 'route-rack');
  assert.equal(armed.memory.length, 0);
  assert.equal(armed.material.lastEvent, 'armed');
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].glyph, 2);
  assert.notEqual(changed.memory[0].replyIndex, 2);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
  assert.notEqual(changed.glyphs[2].route, baseline.glyphs[2].route);
  assert.notEqual(changed.glyphs[changed.memory[0].replyIndex].route, baseline.glyphs[changed.memory[0].replyIndex].route);
});

test('the route-custody ledger is bounded and deterministic', async () => {
  const { MEMORY_LIMIT, buildFrame, commitDeparture, geometrySignature } = await import('../studies/handwriting/v026/engine.mjs');
  const events = [
    { glyph: 0, distance: 0.84 },
    { glyph: 2, distance: 0.84 },
    { glyph: 4, distance: 0.84 },
    { glyph: 6, distance: 0.84 },
    { glyph: 1, distance: 0.84 }
  ];
  const first = events.reduce((frame, event) => commitDeparture(frame, event), buildFrame(12, []));
  const repeat = events.reduce((frame, event) => commitDeparture(frame, event), buildFrame(12, []));

  assert.equal(MEMORY_LIMIT, 4);
  assert.equal(first.memory.length, 4);
  assert.equal(first.material.departureCount, 5);
  assert.equal(geometrySignature(first), geometrySignature(repeat));
  assert.match(first.material.custody, /^[a-z]{4}$/);
});

test('lifting the latest departure restores the exact preceding route rack', async () => {
  const { buildFrame, commitDeparture, liftLatestDeparture, geometrySignature } = await import('../studies/handwriting/v026/engine.mjs');
  const baseline = buildFrame(3, []);
  const first = commitDeparture(baseline, { glyph: 1, distance: 0.84 });
  const changed = commitDeparture(first, { glyph: 5, distance: 0.84 });

  assert.equal(liftLatestDeparture(changed).memory.length, 1);
  assert.equal(geometrySignature(liftLatestDeparture(changed)), geometrySignature(first));
});

test('every route witness receives a genuinely non-local reply', async () => {
  const { buildFrame, commitDeparture } = await import('../studies/handwriting/v026/engine.mjs');
  for (let glyph = 0; glyph < 7; glyph += 1) {
    const changed = commitDeparture(buildFrame(0, []), { glyph, distance: 0.84 });
    assert.notEqual(changed.memory[0].replyIndex, glyph, `${glyph} replied locally`);
  }
});

test('handwriting v026 raw tableau is a WebGL route sculpture before explanation', async () => {
  const html = await read('studies/handwriting/v026/index.html');
  const sketch = await read('studies/handwriting/v026/sketch.js');
  const style = await read('studies/handwriting/v026/style.css');

  assert.match(html, /id="route-rack"/);
  assert.match(html, /id="canvas-mount"/);
  assert.match(html, /id="read-margin"/);
  assert.match(html, /id="lift-departure"/);
  assert.match(html, /id="release-rack"/);
  assert.match(html, /data-raw-work-id="typography-2026-10-10"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(sketch, /WEBGL/);
  assert.match(sketch, /commitDeparture/);
  assert.match(sketch, /__mutineHandwritingV026/);
  assert.match(style, /prefers-reduced-motion: reduce/);
  assert.match(style, /min-height: 44px/);
});

test('handwriting v026 records its art gate, cultural translation, and daily route', async () => {
  const readme = await read('studies/handwriting/v026/README.md');
  const metrics = JSON.parse(await read('studies/handwriting/v026/metrics.json'));
  const critiques = JSON.parse(await read('studies/handwriting/v026/critiques.json'));
  const data = JSON.parse(await read('studio/data/works.json'));
  const canonical = await read('works/typography-2026-10-10/index.html');

  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion/i);
  assert.equal(metrics.seed, '0x48574926');
  assert.equal(metrics.visitorInput, true);
  assert.equal(metrics.replay, true);
  assert.match(metrics.memoryRule, /route|custody|reply/i);
  assert.match(metrics.interactionRule, /proximity|withdraw|departure/i);
  assert.equal(critiques.length, 5);
  const matches = data.works.filter((entry) => entry.currentId === 'typography' && entry.date === '2026-10-10');
  assert.equal(matches.length, 1);
  const work = matches[0];
  assert.equal(work.id, 'typography-2026-10-10');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.equal(work.rawPath, '/studies/handwriting/v026/');
  assert.equal(work.source.referenceId, 'little-critters');
  assert.match(work.source.translatedRule, /proximity|withdraw|route|reply/i);
  assert.equal(work.journal.anchor, 'journal-typography-2026-10-10');
  assert.equal(work.decision.lineage, 'typography-2026-10-08');
  assert.match(canonical, /data-catalog-work-detail="typography-2026-10-10"/);
});
