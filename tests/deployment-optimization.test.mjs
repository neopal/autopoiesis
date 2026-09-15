import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sourceStudio = JSON.parse(await read('studio/data/studio.json'));
const sourceWorks = JSON.parse(await read('studio/data/works.json'));
const sourceStimuli = JSON.parse(await read('studio/data/stimuli.json'));
const sourceArtist = JSON.parse(await read('studio/data/artist.json'));
const { buildCatalog } = await import('../studio/catalog.mjs');
const { loadCatalogData } = await import('../studio/catalog-data.mjs');
const { buildPublicCatalog } = await import('../scripts/build-public-catalog.mjs');

const publicCatalog = buildPublicCatalog({
  studio: sourceStudio,
  works: sourceWorks,
  stimuli: sourceStimuli,
  artist: sourceArtist
});

test('public catalog preserves the runtime contract without QA evidence payloads', () => {
  assert.equal(publicCatalog.schema, 'mutine-public-catalog/v1');
  assert.deepEqual(publicCatalog.studio, sourceStudio);
  assert.deepEqual(publicCatalog.artist, sourceArtist);
  assert.equal(publicCatalog.works.works.length, sourceWorks.works.length);
  assert.ok(publicCatalog.works.works.every((work) => work.id && work.rawPath && work.journal && work.critiques && work.metrics && work.decision));
  assert.doesNotMatch(JSON.stringify(publicCatalog), /browserEvidence/);
  assert.equal(Object.hasOwn(publicCatalog, 'stimuli'), false);
  assert.doesNotMatch(JSON.stringify(publicCatalog), /stage6Probe/);

  const sourceCatalog = buildCatalog(sourceStudio, sourceWorks, sourceStimuli);
  const runtimeCatalog = buildCatalog(publicCatalog.studio, publicCatalog.works);
  assert.deepEqual(runtimeCatalog.currents.map((current) => current.id), sourceCatalog.currents.map((current) => current.id));
  assert.deepEqual(runtimeCatalog.works.map((work) => work.id), sourceCatalog.works.map((work) => work.id));
  assert.deepEqual(runtimeCatalog.activity, sourceCatalog.activity);
  assert.deepEqual(runtimeCatalog.fieldTests, sourceCatalog.fieldTests);
});

test('checked-in public catalog matches the current source data', async () => {
  const checkedInCatalog = JSON.parse(await read('studio/data/catalog-public.json'));
  assert.deepEqual(checkedInCatalog, publicCatalog);
});

test('catalog loader falls back after compact network, JSON, or schema failures', async () => {
  const legacyPayload = {
    '/studio/data/studio.json': sourceStudio,
    '/studio/data/works.json': sourceWorks,
    '/studio/data/stimuli.json': sourceStimuli,
    '/studio/data/artist.json': sourceArtist
  };
  const scenarios = [
    { name: 'network', compact: () => Promise.reject(new Error('offline')) },
    { name: 'JSON', compact: { ok: true, json: () => Promise.reject(new Error('invalid JSON')) } },
    { name: 'schema', compact: { ok: true, json: async () => ({ schema: 'wrong' }) } }
  ];

  for (const scenario of scenarios) {
    const requests = [];
    const fetchStub = async (url) => {
      requests.push(url);
      if (url === '/studio/data/catalog-public.json') {
        return typeof scenario.compact === 'function' ? scenario.compact() : scenario.compact;
      }
      return { ok: true, json: async () => legacyPayload[url] };
    };

    const loaded = await loadCatalogData(fetchStub);

    assert.deepEqual(loaded, {
      studio: sourceStudio,
      works: sourceWorks,
      stimuli: sourceStimuli,
      artist: sourceArtist
    }, scenario.name);
    assert.deepEqual(requests, [
      '/studio/data/catalog-public.json',
      '/studio/data/studio.json',
      '/studio/data/works.json',
      '/studio/data/stimuli.json',
      '/studio/data/artist.json'
    ], scenario.name);
  }
});

test('vercel deployment ignores QA captures and builds the public catalog', async () => {
  const ignore = await read('.vercelignore');
  const vercel = JSON.parse(await read('vercel.json'));
  assert.match(ignore, /^research\/qa\/$/m);
  assert.equal(vercel.buildCommand, 'node scripts/build-public-catalog.mjs');
  assert.equal(vercel.outputDirectory, '.');
  assert.ok(vercel.headers.some((rule) => rule.source === '/studies/(.*)'));
  assert.ok(vercel.headers.some((rule) => rule.source === '/studio/(.*)'));
  assert.ok(vercel.routes.some((rule) => rule.src === '/api/vote/?$' && rule.status === 410));
  assert.match(ignore, /^api\/vote\.js$/m);
});

test('catalog cards defer artwork iframes until they approach the viewport', async () => {
  const source = await read('studio/catalog.js');
  assert.match(source, /data-src="\$\{escapeHtml\(withPreview\(work\.rawPath, \{ static: '1' \}\)\)\}"/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /hydrateLazyFrames/);
  assert.match(source, /loading="lazy"/);
});
