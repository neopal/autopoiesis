import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const studio = JSON.parse(await read('studio/data/studio.json'));
const worksData = JSON.parse(await read('studio/data/works.json'));
const { buildCatalog } = await import('../studio/catalog.mjs');
const catalog = buildCatalog(studio, worksData);

test('catalog is current -> daily work -> journal/critique data', () => {
  assert.equal(catalog.currents.length, 6);
  assert.equal(catalog.works.length, worksData.works.length);
  assert.equal(catalog.worksByCurrent.typography.length, 2);
  assert.deepEqual(catalog.worksByCurrent.typography.map((work) => work.date), ['2026-08-31', '2026-08-28']);
  assert.equal(catalog.works.find((work) => work.id === 'naive-2026-08-31').lifecycle, 'active');
  assert.ok(catalog.works.every((work) => work.route === `/works/${work.id}/`));
  assert.ok(catalog.works.every((work) => work.currentTitle));
});

test('renderer has one source and renders latest work per current', async () => {
  const source = await read('studio/catalog.js');
  assert.match(source, /buildCatalog\(studio, works, stimuli\)/);
  assert.match(source, /catalog\.currents\.map\(renderHomeCurrent\)/);
  assert.match(source, /gallery-current-grid/);
  assert.doesNotMatch(source, /home-current-grid/);
  assert.match(source, /current\.works\.map\(renderWorkCard\)/);
  assert.match(source, /withPreview\(work\.rawPath, \{ static: '1' \}\)/);
  assert.doesNotMatch(source, /evolutions\.json/);
  assert.doesNotMatch(source, /renderVersionRail|data-catalog-version/);
});

test('detail renderer provides timeline, journal, critiques and decision regions', async () => {
  const source = await read('studio/catalog.js');
  for (const region of ['timeline', 'journal', 'critiques', 'evidence', 'navigation']) {
    assert.match(source, new RegExp(`data-work-region="${region}"`));
  }
  assert.match(source, /previous daily work/);
  assert.match(source, /next daily work/);
  assert.match(source, /work-timeline-bar/);
  assert.match(source, /#journal/);
});

test('styles support dense current grids and mobile collapse', async () => {
  const css = await read('studio/catalog.css');
  assert.match(css, /\.current-page \.catalog-grid \{ grid-template-columns: repeat\(3/);
  assert.match(css, /\.gallery-current-grid \{ display: grid/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /\.home-current__art \{[^}]*display: block/);
  assert.match(css, /\.work-timeline-bar \{[^}]*overflow-x: auto/);
});
