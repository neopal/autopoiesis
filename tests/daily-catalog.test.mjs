import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const expectedDailyIds = [
  'naive-2026-09-25',
  'brush-2026-09-25',
  'svg-2026-09-25',
  'portrait-2026-09-25',
  'naive-2026-09-24',
  'brush-2026-09-24',
  'svg-2026-09-24',
  'portrait-2026-09-24',
  'webgpu-2026-09-24',
  'naive-2026-09-23',
  'brush-2026-09-23',
  'portrait-2026-09-23',
  'svg-2026-09-23',
  'naive-2026-09-22',
  'svg-2026-09-22',
  'typography-2026-09-22',
  'webgpu-2026-09-21',
  'naive-2026-09-21',
  'brush-2026-09-21',
  'portrait-2026-09-18',
  'typography-2026-09-18',
  'webgpu-2026-09-17',
  'naive-2026-09-17',
  'typography-2026-09-17',
  'webgpu-2026-09-16',
  'naive-2026-09-16',
  'brush-2026-09-16',
  'webgpu-2026-09-15',
  'brush-2026-09-15',
  'svg-2026-09-15',
  'naive-2026-09-14',
  'brush-2026-09-14',
  'svg-2026-09-14',
  'portrait-2026-09-14',
  'webgpu-2026-09-13',
  'naive-2026-09-13',
  'brush-2026-09-13',
  'svg-2026-09-13',
  'typography-2026-09-13',
  'naive-2026-09-12',
  'brush-2026-09-12',
  'svg-2026-09-12',
  'portrait-2026-09-12',
  'typography-2026-09-12',
  'webgpu-2026-09-12',
  'webgpu-2026-09-11',
  'brush-2026-09-11',
  'typography-2026-09-11',
  'portrait-2026-09-11',
  'naive-2026-09-11',
  'webgpu-2026-09-10',
  'naive-2026-09-10',
  'brush-2026-09-10',
  'svg-2026-09-10',
  'portrait-2026-09-10',
  'typography-2026-09-10',
  'svg-2026-09-09',
  'typography-2026-09-09',
  'portrait-2026-09-09',
  'brush-2026-09-09',
  'webgpu-2026-09-08',
  'naive-2026-09-08',
  'brush-2026-09-08',
  'svg-2026-09-08',
  'portrait-2026-09-08',
  'brush-2026-09-07',
  'svg-2026-09-07',
  'naive-2026-09-07',
  'naive-2026-09-04',
  'typography-2026-09-04',
  'portrait-2026-09-04',
  'svg-2026-09-04',
  'brush-2026-09-04',
  'webgpu-2026-09-07',
  'webgpu-2026-09-04',
  'webgpu-2026-09-03',
  'brush-2026-09-03',
  'typography-2026-09-03',
  'portrait-2026-09-03',
  'svg-2026-09-03',
  'naive-2026-09-02',
  'svg-2026-09-02',
  'typography-2026-08-28',
  'brush-2026-08-28',
  'typography-2026-08-31',
  'svg-2026-08-31',
  'portrait-2026-08-31',
  'naive-2026-08-31',
  'brush-2026-08-31',
  'webgpu-2026-09-09',
  'typography-2026-09-14',
  'typography-2026-09-15',
  'portrait-2026-09-15',
  'naive-2026-09-15',
  'typography-2026-09-16',
  'portrait-2026-09-16',
  'portrait-2026-09-17',
  'brush-2026-09-22',
  'webgpu-2026-09-22'
];
test('daily work register preserves the recorded dates without inventing history', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));

  assert.equal(data.schema, 'mutine-works/v1');
  assert.deepEqual(data.works.map((work) => work.id), expectedDailyIds);
  assert.deepEqual(data.works.map((work) => work.date), [
    '2026-09-25', '2026-09-25', '2026-09-25', '2026-09-25', '2026-09-24', '2026-09-24', '2026-09-24', '2026-09-24', '2026-09-24', '2026-09-23', '2026-09-23', '2026-09-23', '2026-09-23', '2026-09-22', '2026-09-22', '2026-09-22', '2026-09-21', '2026-09-21', '2026-09-21', '2026-09-18', '2026-09-18', '2026-09-17', '2026-09-17', '2026-09-17', '2026-09-16', '2026-09-16', '2026-09-16', '2026-09-15', '2026-09-15', '2026-09-15', '2026-09-14', '2026-09-14', '2026-09-14', '2026-09-14', '2026-09-13', '2026-09-13', '2026-09-13', '2026-09-13', '2026-09-13', '2026-09-12', '2026-09-12', '2026-09-12', '2026-09-12', '2026-09-12', '2026-09-12', '2026-09-11', '2026-09-11', '2026-09-11', '2026-09-11', '2026-09-11', '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-10', '2026-09-09', '2026-09-09', '2026-09-09', '2026-09-09', '2026-09-08', '2026-09-08', '2026-09-08', '2026-09-08', '2026-09-08', '2026-09-07', '2026-09-07', '2026-09-07', '2026-09-04', '2026-09-04', '2026-09-04', '2026-09-04', '2026-09-04', '2026-09-07', '2026-09-04', '2026-09-03', '2026-09-03', '2026-09-03', '2026-09-03', '2026-09-03', '2026-09-02', '2026-09-02',
    '2026-08-28', '2026-08-28', '2026-08-31', '2026-08-31',
    '2026-08-31', '2026-08-31', '2026-08-31', '2026-09-09', '2026-09-14', '2026-09-15', '2026-09-15', '2026-09-15', '2026-09-16', '2026-09-16', '2026-09-17', '2026-09-22', '2026-09-22'
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

test('the SVG daily work records a real v003 tableau with a topology engine', async () => {
  const data = JSON.parse(await read('studio/data/works.json'));
  const work = data.works.find((entry) => entry.id === 'svg-2026-09-03');

  assert.ok(work, 'the SVG v003 daily work must be recorded');
  assert.equal(work.currentId, 'svg');
  assert.equal(work.date, '2026-09-03');
  assert.equal(work.rawPath, '/studies/pure-svg/v003/');
  assert.equal(work.journal.anchor, 'journal-svg-2026-09-03');
  assert.equal(work.decision.lineage, 'pure-svg-v002');

  const tableau = await read('studies/pure-svg/v003/index.html');
  const engine = await read('studies/pure-svg/v003/engine.mjs');
  assert.match(tableau, /<svg[^>]+id="field"/);
  assert.match(tableau, /data-gesture="refuse"/);
  assert.match(tableau, /tabindex="0"/);
  assert.match(engine, /influencedRoutes/);
  assert.match(engine, /deleteRefusal/);
  assert.match(engine, /visitor-refusal/);
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
  assert.equal(catalog.works.length, 99);
  for (const current of catalog.currents) {
    const dates = current.works.map((work) => work.date);
    assert.deepEqual(dates, [...dates].sort((a, b) => b.localeCompare(a)));
  }

  assert.deepEqual(catalog.currents.find((current) => current.id === 'typography').works.map((work) => work.id), [
    'typography-2026-09-22',
    'typography-2026-09-18',
    'typography-2026-09-17',
    'typography-2026-09-16',
    'typography-2026-09-15',
    'typography-2026-09-14',
    'typography-2026-09-13',
    'typography-2026-09-12',
    'typography-2026-09-11',
    'typography-2026-09-10',
    'typography-2026-09-09',
    'typography-2026-09-04',
    'typography-2026-09-03',
    'typography-2026-08-31',
    'typography-2026-08-28'
  ]);
  assert.deepEqual(catalog.currents.find((current) => current.id === 'svg').works.map((work) => work.id), [
    'svg-2026-09-25',
    'svg-2026-09-24',
    'svg-2026-09-23',
    'svg-2026-09-22',
    'svg-2026-09-15',
    'svg-2026-09-14',
    'svg-2026-09-13',
    'svg-2026-09-12',
    'svg-2026-09-10',
    'svg-2026-09-09',
    'svg-2026-09-08',
    'svg-2026-09-07',
    'svg-2026-09-04',
    'svg-2026-09-03',
    'svg-2026-09-02',
    'svg-2026-08-31'
  ]);
  assert.deepEqual(catalog.currents.find((current) => current.id === 'brush').works.map((work) => work.id), [
    'brush-2026-09-25',
    'brush-2026-09-24',
    'brush-2026-09-23',
    'brush-2026-09-22',
    'brush-2026-09-21',
    'brush-2026-09-16',
    'brush-2026-09-15',
    'brush-2026-09-14',
    'brush-2026-09-13',
    'brush-2026-09-12',
    'brush-2026-09-11',
    'brush-2026-09-10',
    'brush-2026-09-09',
    'brush-2026-09-08',
    'brush-2026-09-07',
    'brush-2026-09-04',
    'brush-2026-09-03',
    'brush-2026-08-31',
    'brush-2026-08-28'
  ]);
  assert.deepEqual(catalog.currents.find((current) => current.id === 'portrait').works.map((work) => work.id), [
    'portrait-2026-09-25',
    'portrait-2026-09-24',
    'portrait-2026-09-23',
    'portrait-2026-09-18',
    'portrait-2026-09-17',
    'portrait-2026-09-16',
    'portrait-2026-09-15',
    'portrait-2026-09-14',
    'portrait-2026-09-12',
    'portrait-2026-09-11',
    'portrait-2026-09-10',
    'portrait-2026-09-09',
    'portrait-2026-09-08',
    'portrait-2026-09-04',
    'portrait-2026-09-03',
    'portrait-2026-08-31'
  ]);
  assert.deepEqual(catalog.currents.find((current) => current.id === 'webgpu').works.map((work) => work.id), ['webgpu-2026-09-24', 'webgpu-2026-09-22', 'webgpu-2026-09-21', 'webgpu-2026-09-17', 'webgpu-2026-09-16', 'webgpu-2026-09-15', 'webgpu-2026-09-13', 'webgpu-2026-09-12', 'webgpu-2026-09-11', 'webgpu-2026-09-10', 'webgpu-2026-09-09', 'webgpu-2026-09-08', 'webgpu-2026-09-07', 'webgpu-2026-09-04', 'webgpu-2026-09-03']);
});

test('current register contains identity and cadence policy but no duplicated work arrays', async () => {
  const studio = JSON.parse(await read('studio/data/studio.json'));
  assert.ok(studio.currents.every((current) => current.path?.startsWith('/currents/')));
  assert.ok(studio.currents.every((current) => current.dailyCadence === 'one work slot per day'));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'works')));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'activeWorks')));
  assert.ok(studio.currents.every((current) => !Object.hasOwn(current, 'completedWorks')));
});
