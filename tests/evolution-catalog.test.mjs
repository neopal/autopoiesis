import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the opening evolution declares its lineage, critiques and formal metrics', async () => {
  const raw = await readFile(new URL('../galerie/data/evolutions.json', import.meta.url));
  const data = JSON.parse(raw);
  const work = data.evolutions.find((entry) => entry.id === 'typographie-manuscrite-v001');

  assert.ok(work, 'v001 must be indexed by the gallery');
  assert.equal(work.chantier, 'typographie-manuscrite');
  assert.equal(work.seed, 'mutine-v001-autopoiese');
  assert.equal(work.critiques.length, 3);
  assert.deepEqual(Object.keys(work.metrics).sort(), ['density', 'entropy', 'symmetry']);
  assert.match(work.path, /^\/chantiers\/typographie-manuscrite\/v001\//);
});
