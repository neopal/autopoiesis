import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const worksData = JSON.parse(await read('studio/data/works.json'));
const { buildCatalog } = await import('../studio/catalog.mjs');
const catalog = buildCatalog(
  JSON.parse(await read('studio/data/studio.json')),
  worksData,
  JSON.parse(await read('studio/data/stimuli.json'))
);

test('works are explicit daily records with canonical routes', () => {
  assert.equal(worksData.schema, 'mutine-works/v1');
  assert.equal(catalog.works.length, 8);
  assert.ok(catalog.works.every((work) => /^\d{4}-\d{2}-\d{2}$/.test(work.date)));
  assert.ok(catalog.works.every((work) => work.id === `${work.currentId}-${work.date}`));
  assert.ok(catalog.works.every((work) => work.route === `/works/${work.id}/`));
  assert.ok(catalog.works.every((work) => work.journal?.anchor === `journal-${work.id}`));
  assert.ok(catalog.works.every((work) => /^\/studies\/.+\/$/.test(work.rawPath)));
});

test('daily slots never duplicate a current and date', () => {
  const slots = catalog.works.map((work) => `${work.currentId}/${work.date}`);
  assert.equal(new Set(slots).size, slots.length);
});

test('each recorded tableau and canonical daily page exists', async () => {
  for (const work of catalog.works) {
    assert.equal(await exists(work.rawPath.replace(/^\//, '') + 'index.html'), true, work.rawPath);
    assert.equal(await exists(`${work.route.slice(1)}index.html`), true, work.route);
  }
});

test('field tests remain separate from daily works', () => {
  assert.ok(catalog.fieldTests.length >= 2);
  assert.equal(catalog.works.some((work) => work.id.includes('subtractive-ecology')), false);
  assert.equal(catalog.works.some((work) => work.id.includes('disobedient-writing')), false);
});

test('complete and active lifecycle values are preserved by normalization', () => {
  const complete = buildCatalog(
    { currents: [{ id: 'x', title: 'X', state: 'active' }] },
    { works: [{ id: 'x-2026-01-01', currentId: 'x', date: '2026-01-01', title: 'done', status: 'complete', rawPath: '/studies/x/v001/' }] }
  ).works[0];
  assert.equal(complete.lifecycle, 'complete');
  assert.equal(catalog.works.every((work) => work.lifecycle === 'active'), true);
});
