import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const expectedDailyIds = [
  'svg-2026-09-02',
  'typography-2026-08-28',
  'brush-2026-08-28',
  'typography-2026-08-31',
  'svg-2026-08-31',
  'portrait-2026-08-31',
  'naive-2026-08-31',
  'brush-2026-08-31'
];

test('daily work register preserves the eight recorded dates without inventing history', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));

  assert.equal(data.schema, 'mutine-works/v1');
  assert.deepEqual(data.works.map((work) => work.id), expectedDailyIds);
  assert.deepEqual(data.works.map((work) => work.date), [
    '2026-09-02',
    '2026-08-28', '2026-08-28', '2026-08-31', '2026-08-31',
    '2026-08-31', '2026-08-31', '2026-08-31'
  ]);
  assert.ok(data.works.every((work) => /^\d{4}-\d{2}-\d{2}$/.test(work.date)));
  assert.ok(data.works.every((work) => work.rawPath?.startsWith('/studies/')));
  assert.ok(data.works.every((work) => work.journal?.anchor === `journal-${work.id}`));
  assert.ok(data.works.every((work) => Array.isArray(work.critiques)));
});

test('daily work identifiers are unique per current and date', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const keys = data.works.map((work) => `${work.currentId}/${work.date}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('the SVG daily work records a real v002 tableau with a causal engine', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'svg-2026-09-02');

  assert.ok(work, 'the SVG daily work must be recorded');
  assert.equal(work.currentId, 'svg');
  assert.equal(work.date, '2026-09-02');
  assert.equal(work.rawPath, '/studies/pure-svg/v002/');
  assert.equal(work.journal.anchor, 'journal-svg-2026-09-02');
  assert.equal(work.decision.lineage, 'pure-svg-v001');

  const tableau = await read('studies/pure-svg/v002/index.html');
  const engine = await read('studies/pure-svg/v002/engine.mjs');
  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture/);
  assert.match(tableau, /tabindex="0"/);
  const sketch = await read('studies/pure-svg/v002/sketch.js');
  assert.match(sketch, /keydown/);
  assert.doesNotMatch(sketch, /class="limbs" d="\$\{limbs\}"/);
  assert.match(engine, /delete.*scar|scar.*delete/i);
  assert.match(engine, /downstream|inherited/i);

  const style = await read('studies/pure-svg/v002/style.css');
  assert.match(style, /\.paper\{/);
  assert.match(style, /\.animal\{/);
  assert.match(style, /\.active-scar\{/);
  assert.match(style, /prefers-reduced-motion:reduce/);
});

test('artist philosophy is a small data record, not another public index page', async () => {
  const artist = JSON.parse(await read('studio/data/artist.json'));
  assert.equal(artist.id, 'mutine');
  assert.ok(artist.statement);
  assert.ok(Array.isArray(artist.principles));
  assert.ok(artist.principles.length >= 3 && artist.principles.length <= 5);
});

test('the catalogue groups daily works by current in reverse chronological order', async () => {
  const { buildCatalog } = await import('../studio/catalog.mjs');
  const studio = JSON.parse(await read('studio/data/studio.json'));
  const works = JSON.parse(await read('studio/data/works.json'));
  const catalog = buildCatalog(studio, works);

  assert.equal(catalog.currents.length, 6);
  assert.equal(catalog.works.length, 8);
  for (const current of catalog.currents) {
    const dates = current.works.map((work) => work.date);
    assert.deepEqual(dates, [...dates].sort((a, b) => b.localeCompare(a)));
  }

  assert.deepEqual(catalog.currents.find((current) => current.id === 'typography').works.map((work) => work.id), [
    'typography-2026-08-31',
    'typography-2026-08-28'
  ]);
  assert.deepEqual(catalog.currents.find((current) => current.id === 'brush').works.map((work) => work.id), [
    'brush-2026-08-31',
    'brush-2026-08-28'
  ]);
  assert.equal(catalog.currents.find((current) => current.id === 'webgpu').works.length, 0);
});

test('current register contains identity and cadence policy but no duplicated work arrays', async () => {
  const studio = JSON.parse(await read('studio/data/studio.json'));
  assert.ok(studio.currents.every((current) => current.path?.startsWith('/currents/')));
  assert.ok(studio.currents.every((current) => current.dailyCadence === 'one work slot per day'));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'works')));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'activeWorks')));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'completedWorks')));
});
