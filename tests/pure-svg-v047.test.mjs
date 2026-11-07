import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/pure-svg/v047/engine.mjs');

 test('SVG v047 builds one deterministic reciprocal glyph before a look', () => {
  const first = engine.buildFrame();
  const second = engine.buildFrame();

  assert.equal(first.grammar, 'reciprocal-glyph');
  assert.equal(first.ports.length, engine.PORT_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(engine.geometrySignature(first), engine.geometrySignature(second));
  assert.ok(first.spinePath.startsWith('M '));
  assert.ok(first.spinePath.length > 120);
});

test('SVG v047 turns a completed look into a remote reply while the looked-at port stays exact', () => {
  const initial = engine.buildFrame();
  const started = engine.beginLook(initial, 1);
  const waitingSignature = engine.geometrySignature(started);
  const armed = engine.advanceLook(started, 620);
  const committed = engine.leaveLook(armed, 1);

  assert.equal(started.pending.sourcePort, 1);
  assert.equal(engine.geometrySignature(started), engine.geometrySignature(initial));
  assert.equal(armed.pending.armed, true);
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'look-committed');
  assert.equal(committed.event.type, 'reciprocal-reply');
  assert.equal(committed.event.sourcePort, 1);
  assert.notEqual(committed.event.replyPort, 1);
  assert.notEqual(engine.geometrySignature(committed), waitingSignature);
  assert.equal(committed.ports[1].signature, initial.ports[1].signature);
  assert.notEqual(committed.ports[committed.event.replyPort].signature, initial.ports[committed.event.replyPort].signature);
  assert.notEqual(committed.spinePath, initial.spinePath);
});

test('SVG v047 refuses a glance, a non-departure, and a second look at the same port without spending geometry', () => {
  const initial = engine.buildFrame();
  const glance = engine.leaveLook(engine.advanceLook(engine.beginLook(initial, 0), 280), 0);
  const noDeparture = engine.completeLook(initial, 2, 700, false);
  const first = engine.commitLook(initial, 2);
  const repeat = engine.commitLook(first, 2);

  assert.equal(glance.interaction, 'look-refused-short');
  assert.equal(noDeparture.interaction, 'look-refused-no-departure');
  assert.equal(engine.geometrySignature(glance), engine.geometrySignature(initial));
  assert.equal(engine.geometrySignature(noDeparture), engine.geometrySignature(initial));
  assert.equal(repeat.interaction, 'look-refused-repeat');
  assert.equal(engine.geometrySignature(repeat), engine.geometrySignature(first));
  assert.equal(engine.portAtPoint(initial, { x: 210, y: 480 }), 0);
  assert.equal(engine.portAtPoint(initial, { x: 600, y: 380 }), null);
});

test('SVG v047 compounds four reciprocal replies and lifts exactly', () => {
  const timeline = engine.buildTimeline();
  const initial = engine.buildFrame();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatestReply(settled);
  const released = engine.releaseGlyph();

  assert.equal(timeline.length, engine.MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, engine.MEMORY_WINDOW);
  assert.equal(settled.memory.map((event) => event.sourcePort).length, engine.MEMORY_WINDOW);
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(initial));
  assert.equal(released.memory.length, 0);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(initial));
});

test('SVG v047 publishes a tableau-first reciprocal glyph and one daily catalogue record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v047/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v047/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v047/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v047/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v047/metrics.json', root), 'utf8'));
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.id === 'svg-2026-11-07');

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /pointermove/);
  assert.match(sketch, /pointerleave/);
  assert.match(sketch, /beginLook/);
  assert.match(sketch, /leaveLook/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG reciprocal glyph');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v047/');
  assert.equal(matches[0].status, 'candidate / held');
  const canonical = await readFile(new URL('works/svg-2026-11-07/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-07"/);
});
