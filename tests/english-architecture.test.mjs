import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = async (path) => {
  try { await access(new URL(`../${path}`, import.meta.url)); return true; }
  catch { return false; }
};

const studio = JSON.parse(await read('studio/data/studio.json'));
const works = JSON.parse(await read('studio/data/works.json')).works;
const currentSlugs = studio.currents.map((current) => current.path.split('/').filter(Boolean).at(-1));

const legacyTerms = /\/(?:galerie|courants|oeuvres|chantiers|atelier)(?:\/|["'?#])/i;
const frenchUiText = /\b(?:chantier|chantiers|courants|oeuvres|galerie|atelier|travail|œuvre|courant)\b/i;

test('catalog data exposes the English public route tree', () => {
  assert.ok(studio.currents.every((current) => current.path.startsWith('/currents/')));
  assert.ok(works.every((work) => work.route === undefined || work.route.startsWith('/works/')));
  assert.ok(works.every((work) => work.rawPath?.startsWith('/studies/')));
});

test('canonical English current and work pages exist while French source pages are gone', async () => {
  for (const slug of currentSlugs) assert.equal(await exists(`currents/${slug}/index.html`), true, slug);
  for (const work of works) assert.equal(await exists(`works/${work.id}/index.html`), true, work.id);

  for (const path of ['courants', 'oeuvres', 'chantiers', 'atelier']) {
    assert.equal(await exists(`${path}/index.html`), false, `${path}/index.html`);
  }
  assert.equal(await exists('studies/typographie-manuscrite/index.html'), false);
});

test('historical French routes redirect into the English architecture', async () => {
  const redirects = JSON.parse(await read('vercel.json')).redirects;
  const pairs = redirects.map(({ source, destination }) => [source, destination]);
  assert.ok(pairs.some(([source, destination]) => source === '/courants/:path*' && destination === '/currents/:path*'));
  assert.ok(pairs.some(([source, destination]) => source === '/oeuvres/:path*' && destination === '/works/:path*'));
  assert.ok(pairs.some(([source, destination]) => source === '/chantiers/:path*' && destination === '/studies/:path*'));
});

test('served public HTML uses English labels and no French route namespaces', async () => {
  const paths = [
    'index.html',
    'journal/index.html',
    ...currentSlugs.map((slug) => `currents/${slug}/index.html`),
    ...works.map((work) => `works/${work.id}/index.html`),
    ...works.map((work) => `${work.rawPath.slice(1)}index.html`)
  ];
  for (const path of paths) {
    const html = await read(path);
    assert.match(html, /<html lang="en">/i, path);
    assert.doesNotMatch(html, legacyTerms, path);
    assert.doesNotMatch(html, frenchUiText, path);
  }
});

test('the runtime has one canonical work register, not the retired evolution duplicate', async () => {
  assert.equal(await exists('studio/data/evolutions.json'), false);
  assert.equal(await exists('scripts/migrate-evolutions-to-daily-works.mjs'), false);
});
