import test from 'node:test';
import assert from 'node:assert/strict';

const {
  GLYPH_COUNT,
  MEMORY_WINDOW,
  WITNESS_LENGTH,
  buildFrame,
  buildTimeline,
  armToken,
  commitWitness,
  geometrySignature,
  liftLatestWitness,
  releaseMemory,
  witnessIsValid
} = await import('../studies/naive-art/v033/engine.mjs');

test('naive v033 begins as a deterministic misheard proof sheet', () => {
  const first = buildFrame();
  const second = buildFrame();

  assert.equal(first.grammar, 'misheard-proof');
  assert.equal(first.memory.length, 0);
  assert.equal(first.glyphs.length, GLYPH_COUNT);
  assert.equal(first.glyphs.every((glyph) => glyph.state === 'quiet'), true);
  assert.equal(geometrySignature(first), geometrySignature(second));
});

test('naive v033 listens without writing until a complete witness is submitted', () => {
  const baseline = buildFrame();
  const first = armToken(baseline, { token: 1 });
  const second = armToken(first, { token: 4 });

  assert.deepEqual(first.pending, [1]);
  assert.deepEqual(second.pending, [1, 4]);
  assert.equal(second.memory.length, 0);
  assert.equal(geometrySignature(second), geometrySignature(baseline));
});

test('naive v033 refuses repeated or incomplete witnesses without geometry change', () => {
  const baseline = buildFrame();
  const repeated = commitWitness(armToken(armToken(baseline, { token: 1 }), { token: 1 }));
  const incomplete = commitWitness(armToken(baseline, { token: 1 }));

  assert.equal(repeated.memory.length, 0);
  assert.equal(repeated.interaction, 'witness-refused');
  assert.equal(incomplete.memory.length, 0);
  assert.equal(incomplete.interaction, 'witness-refused');
  assert.equal(geometrySignature(repeated), geometrySignature(baseline));
  assert.equal(geometrySignature(incomplete), geometrySignature(baseline));
});

test('naive v033 makes a valid witness misread the proof at a distance', () => {
  const baseline = buildFrame();
  const armed = [1, 4, 2].reduce((state, token) => armToken(state, { token }), baseline);
  const changed = commitWitness(armed);
  const event = changed.memory.at(-1);
  const changedGlyphs = changed.glyphs.filter((glyph, index) => geometrySignature({ glyphs: [glyph] }) !== geometrySignature({ glyphs: [baseline.glyphs[index]] }));

  assert.equal(witnessIsValid([1, 4, 2]), true);
  assert.equal(event.kind, 'misheard-proof');
  assert.deepEqual(event.witness, [1, 4, 2]);
  assert.equal(event.witness.every((token) => ![event.source, event.echo, event.blank].includes(token)), true);
  assert.equal(changedGlyphs.length, 4);
  assert.equal(changed.glyphs[event.source].state, 'misheard');
  assert.equal(changed.glyphs[event.echo].state, 'echo');
  assert.equal(changed.glyphs[event.blank].state, 'blank');
  assert.equal(changed.lineBreaks.length, 1);
  assert.notEqual(geometrySignature(changed), geometrySignature(baseline));
});

test('naive v033 bounds memory and lifts the exact preceding proof', () => {
  let frame = buildFrame();
  const signatures = [geometrySignature(frame)];
  for (const witness of [...buildTimeline(), ...buildTimeline()]) {
    frame = witness.reduce((state, token) => armToken(state, { token }), frame);
    frame = commitWitness(frame);
    signatures.push(geometrySignature(frame));
  }

  assert.equal(frame.memory.length, MEMORY_WINDOW);
  assert.equal(geometrySignature(liftLatestWitness(frame)), signatures.at(-2));
  assert.equal(geometrySignature(releaseMemory(frame)), signatures[0]);
});

test('naive v033 exposes the keyboard proof tableau and its interaction surface', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const html = await readFile(new URL('studies/naive-art/v033/index.html', root), 'utf8');
  const sketch = await readFile(new URL('studies/naive-art/v033/sketch.js', root), 'utf8');
  const style = await readFile(new URL('studies/naive-art/v033/style.css', root), 'utf8');
  const readme = await readFile(new URL('studies/naive-art/v033/README.md', root), 'utf8');

  assert.match(html, /id="proof-sheet"/);
  assert.match(html, /data-action="witness"/);
  assert.match(html, /data-action="lift"/);
  assert.match(html, /data-action="release"/);
  assert.match(sketch, /keydown/);
  assert.match(sketch, /pointerdown/);
  assert.match(sketch, /__mutineNaiveV033/);
  assert.match(style, /min-height:\s*44px/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.match(readme, /hypothesis/i);
  assert.match(readme, /changed rule/i);
  assert.match(readme, /visible consequence/i);
  assert.match(readme, /falsifier/i);
  assert.match(readme, /deletion condition/i);
});

test('naive v033 is registered exactly once for the 2026-10-23 daily slot', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../', import.meta.url);
  const register = JSON.parse(await readFile(new URL('studio/data/works.json', root), 'utf8'));
  const matches = register.works.filter((entry) => entry.currentId === 'naive' && entry.date === '2026-10-23');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, 'naive-2026-10-23');
  assert.equal(matches[0].rawPath, '/studies/naive-art/v033/');
  assert.equal(matches[0].status, 'candidate / held');
  assert.equal(matches[0].journal.anchor, 'journal-naive-2026-10-23');
  assert.equal(matches[0].decision.lineage, 'naive-2026-10-22');
  assert.equal(matches[0].source.referenceId, 'little-critters');
});
