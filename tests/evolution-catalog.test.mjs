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

test('the studio board exposes every atelier as an honest state, not a fabricated artwork', async () => {
  const raw = await readFile(new URL('../galerie/data/studio.json', import.meta.url));
  const studio = JSON.parse(raw);
  assert.equal(studio.chantiers.length, 6);
  assert.ok(studio.chantiers.some((x) => x.state === 'active' && x.evolution === 'v001'));
  assert.ok(studio.chantiers.every((x) => ['active', 'dormant', 'archived'].includes(x.state)));
  assert.ok(studio.chantiers.filter((x) => x.state === 'dormant').every((x) => x.evolution === null));
});

test('an active Brush room has a runnable v001, evidence, and a deletion-aware metric', async () => {
  const evolutions = JSON.parse(await readFile(new URL('../galerie/data/evolutions.json', import.meta.url)));
  const studio = JSON.parse(await readFile(new URL('../galerie/data/studio.json', import.meta.url)));
  const brush = evolutions.evolutions.find((entry) => entry.id === 'p5-brush-v001');
  assert.ok(brush, 'Brush v001 must be indexed before the room is active');
  assert.equal(brush.chantier, 'p5-brush');
  assert.match(brush.path, /^\/chantiers\/p5-brush\/v001\//);
  assert.ok(brush.source?.includes('acamposuribe'), 'the work must name its source trace');
  assert.ok(Number.isFinite(brush.metrics.erasureRatio), 'the work must measure removal');
  assert.equal(brush.critiques.length, 3);
  assert.deepEqual(studio.chantiers.find((room) => room.id === 'brush'), {
    id: 'brush', title: 'Brush', state: 'active', evolution: 'v001',
    question: 'Can paint remember its removals?', href: '/chantiers/p5-brush/v001/'
  });
  for (const file of ['index.html', 'sketch.js', 'metrics.json', 'critiques.json', 'reponse.md']) {
    await readFile(new URL(`../chantiers/p5-brush/v001/${file}`, import.meta.url));
  }
});
