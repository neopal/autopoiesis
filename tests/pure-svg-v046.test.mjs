import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/pure-svg/v046/engine.mjs');

test('SVG v046 builds a deterministic pressure block before any pulse', () => {
  const first = engine.buildFrame();
  const second = engine.buildFrame();

  assert.equal(first.grammar, 'alternating-pressure-block');
  assert.equal(first.layers.length, engine.LAYER_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(engine.geometrySignature(first), engine.geometrySignature(second));
  assert.ok(first.bodyPath.length > 80);
  assert.ok(first.voidPath.length > 40);
});

test('SVG v046 accepts an alternating held pulse and changes the block, not the pressure well', () => {
  const initial = engine.buildFrame();
  const held = engine.beginPressure(initial, 'left');
  const committed = engine.releasePressure(held, 'left', true);

  assert.equal(held.pending.side, 'left');
  assert.equal(engine.geometrySignature(held), engine.geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'pressure-committed');
  assert.equal(committed.event.mode, 'crease');
  assert.notEqual(committed.bodyPath, initial.bodyPath);
  assert.notEqual(committed.voidPath, initial.voidPath);
  assert.equal(committed.jaws.left, initial.jaws.left);
  assert.equal(committed.jaws.right, initial.jaws.right);

  const repeat = engine.releasePressure(engine.beginPressure(committed, 'left'), 'left', true);
  assert.equal(repeat.interaction, 'pressure-refused-repeat');
  assert.equal(engine.geometrySignature(repeat), engine.geometrySignature(committed));
});

test('SVG v046 alternates material modes, compounds four loads, and lifts exactly', () => {
  const timeline = engine.buildTimeline();
  const initial = engine.buildFrame();
  const settled = timeline.at(-1);
  const lifted = engine.liftLatestPressure(settled);
  const released = engine.releaseBlock();

  assert.equal(timeline.length, engine.MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, engine.MEMORY_WINDOW);
  assert.deepEqual(settled.memory.map((event) => event.side), ['left', 'right', 'left', 'right']);
  assert.deepEqual(settled.memory.map((event) => event.mode), ['crease', 'lean', 'cleave', 'settle']);
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(initial));
  assert.equal(released.memory.length, 0);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(initial));
});

test('SVG v046 refuses a miss, a short pulse, and a same-side pulse without spending material', () => {
  const initial = engine.buildFrame();
  const miss = engine.beginPressure(initial, 'centre');
  const short = engine.releasePressure(engine.beginPressure(initial, 'right'), 'right', false);
  const first = engine.commitPressure(initial, 'right');
  const repeat = engine.releasePressure(engine.beginPressure(first, 'right'), 'right', true);

  assert.equal(miss.interaction, 'pressure-refused-miss');
  assert.equal(short.interaction, 'pressure-refused-short');
  assert.equal(engine.geometrySignature(short), engine.geometrySignature(initial));
  assert.equal(repeat.interaction, 'pressure-refused-repeat');
  assert.equal(engine.geometrySignature(repeat), engine.geometrySignature(first));
  assert.equal(engine.pressureSideAtPoint(initial, { x: 250, y: 380 }), 'left');
  assert.equal(engine.pressureSideAtPoint(initial, { x: 500, y: 380 }), null);
});

test('SVG v046 publishes a tableau-first pressure encounter and one daily catalogue record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v046/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v046/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v046/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v046/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v046/metrics.json', root), 'utf8'));
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.id === 'svg-2026-11-06');

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="press"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginPressure/);
  assert.match(sketch, /releasePressure/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG alternating pressure block');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v046/');
  assert.equal(matches[0].status, 'candidate / held');
  const canonical = await readFile(new URL('works/svg-2026-11-06/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-06"/);
});
