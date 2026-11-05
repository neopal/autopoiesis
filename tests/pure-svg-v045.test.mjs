import test from 'node:test';
import assert from 'node:assert/strict';

const engine = await import('../studies/pure-svg/v045/engine.mjs');

test('SVG v045 creates a deterministic counterfield register before attention is committed', () => {
  const first = engine.buildFrame();
  const second = engine.buildFrame();

  assert.equal(first.grammar, 'counterfield-register');
  assert.equal(first.tiles.length, engine.TILE_COUNT);
  assert.equal(first.memory.length, 0);
  assert.equal(first.interaction, 'quiet');
  assert.equal(engine.geometrySignature(first), engine.geometrySignature(second));
  assert.ok(first.tiles.every((tile) => tile.outerPath.length > 30 && tile.counterPath.length > 20));
});

test('SVG v045 keeps a two-site attention handoff neutral until commit, then opens a remote tile', () => {
  const initial = engine.buildFrame();
  const started = engine.beginAttention(initial, 2);
  const ready = engine.handoffAttention(started, 8);
  const committed = engine.commitAttention(ready);

  assert.deepEqual(ready.pending, [2, 8]);
  assert.equal(ready.interaction, 'attention-ready');
  assert.equal(engine.geometrySignature(ready), engine.geometrySignature(initial));
  assert.equal(committed.memory.length, 1);
  assert.equal(committed.interaction, 'attention-committed');
  assert.equal(committed.event.type, 'remote-absence');
  assert.equal(committed.tiles[2].signature, initial.tiles[2].signature);
  assert.equal(committed.tiles[8].signature, initial.tiles[8].signature);
  const receiver = committed.tiles[committed.event.receiverTile];
  assert.equal(receiver.state, 'opened');
  assert.notEqual(receiver.signature, initial.tiles[committed.event.receiverTile].signature);
  assert.ok(receiver.fracturePath);
});

test('SVG v045 compounds four remote openings, lifts exactly, and releases to the seed', () => {
  const timeline = engine.buildTimeline();
  const settled = timeline.at(-1);
  const initial = engine.buildFrame();
  const lifted = engine.liftLatestAttention(settled);
  const released = engine.releaseRegister();

  assert.equal(timeline.length, engine.MEMORY_WINDOW + 1);
  assert.equal(settled.memory.length, engine.MEMORY_WINDOW);
  assert.equal(settled.state.handoffCount, engine.MEMORY_WINDOW);
  assert.equal(engine.geometrySignature(lifted), engine.geometrySignature(timeline.at(-2)));
  assert.notEqual(engine.geometrySignature(settled), engine.geometrySignature(initial));
  assert.equal(released.memory.length, 0);
  assert.equal(engine.geometrySignature(released), engine.geometrySignature(initial));
});

test('SVG v045 refuses incomplete or repeated attention without changing geometry', () => {
  const initial = engine.buildFrame();
  const started = engine.beginAttention(initial, 4);
  const repeated = engine.handoffAttention(started, 4);
  const incomplete = engine.commitAttention(started);

  assert.equal(repeated.interaction, 'attention-refused-repeat');
  assert.equal(engine.geometrySignature(repeated), engine.geometrySignature(initial));
  assert.equal(incomplete.interaction, 'attention-refused-incomplete');
  assert.equal(engine.geometrySignature(incomplete), engine.geometrySignature(initial));
});

test('SVG v045 resolves a pointer position to a situated tile without turning the field into a grid', () => {
  const frame = engine.buildFrame();

  assert.equal(engine.tileAtPoint(frame, { x: 484, y: 166 }), 2);
  assert.equal(engine.tileAtPoint(frame, { x: 100, y: 80 }), null);
});

test('SVG v045 publishes a real tableau contract and one daily catalogue record', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const index = await readFile(new URL('studies/pure-svg/v045/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/pure-svg/v045/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/pure-svg/v045/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/pure-svg/v045/README.md', root), 'utf8');
  const metrics = JSON.parse(await readFile(new URL('studies/pure-svg/v045/metrics.json', root), 'utf8'));
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((work) => work.id === 'svg-2026-11-05');

  assert.match(index, /<svg[^>]+id="field"/);
  assert.match(index, /data-gesture="attend"/);
  assert.match(index, /data-gesture="lift"/);
  assert.match(index, /data-gesture="release"/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /pointerup/);
  assert.match(sketch, /beginAttention/);
  assert.match(sketch, /commitAttention/);
  assert.match(style, /prefers-reduced-motion:reduce/);
  assert.match(style, /@media\s*\(max-width:\s*680px\)/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
  assert.equal(metrics.replay, true);
  assert.equal(metrics.renderer, 'deterministic inline SVG counterfield register');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rawPath, '/studies/pure-svg/v045/');
  assert.equal(matches[0].status, 'candidate / held');
  const canonical = await readFile(new URL('works/svg-2026-11-05/index.html', root), 'utf8');
  assert.match(canonical, /data-catalog-work-detail="svg-2026-11-05"/);
});
