import test from 'node:test';
import assert from 'node:assert/strict';

test('brush v024 turns a reciprocal pair into a real missing span', async () => {
  const { buildFrame, applyPair, geometrySignature } = await import('../studies/p5-brush/v024/engine.mjs');
  const base = buildFrame(0, []);
  const changed = applyPair(base, { from: 2, to: 8 });

  assert.equal(base.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.interaction, 'pair-committed');
  assert.notEqual(geometrySignature(changed), geometrySignature(base));
  assert.ok(changed.segments.slice(3, 8).some((segment) => segment.removed));
  assert.ok(changed.segments.slice(3, 8).some((segment) => segment.width < 0.001));
});

test('brush v024 completes a pair from pending attention without letting the first touch mutate memory', async () => {
  const { buildFrame, completePair } = await import('../studies/p5-brush/v024/engine.mjs');
  const base = buildFrame(0, []);
  const armed = { ...base, pendingAnchor: 4 };
  const changed = completePair(armed, 9);

  assert.equal(armed.memory.length, 0);
  assert.equal(changed.memory.length, 1);
  assert.equal(changed.memory[0].from, 4);
  assert.equal(changed.memory[0].to, 9);
  assert.equal(changed.interaction, 'pair-committed');
});

test('brush v024 raw tableau exposes a pair-based canvas encounter and release controls', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile('studies/p5-brush/v024/index.html', 'utf8');

  assert.match(html, /id="bridge-field"/);
  assert.match(html, /id="pair-control"/);
  assert.match(html, /id="lift-control"/);
  assert.match(html, /id="release-control"/);
  assert.match(html, /p5\.min\.js/);
  assert.match(html, /data-raw-work-id="brush-2026-10-05"/);
  assert.match(html, /aria-keyshortcuts="Enter Space Delete R S"/);
});

test('brush v024 has one dated catalogue record and a tableau-first canonical route', async () => {
  const { readFile } = await import('node:fs/promises');
  const register = JSON.parse(await readFile('studio/data/works.json', 'utf8'));
  const work = register.works.find((entry) => entry.id === 'brush-2026-10-05');
  const canonical = await readFile('works/brush-2026-10-05/index.html', 'utf8');

  assert.ok(work);
  assert.equal(work.currentId, 'brush');
  assert.equal(work.date, '2026-10-05');
  assert.equal(work.rawPath, '/studies/p5-brush/v024/');
  assert.equal(work.status, 'candidate / held');
  assert.equal(work.lifecycle, 'active');
  assert.match(canonical, /data-work-id="brush-2026-10-05"/);
});
