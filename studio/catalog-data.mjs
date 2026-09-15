const PUBLIC_CATALOG_URL = '/studio/data/catalog-public.json';
const FALLBACK_DATA_URLS = [
  '/studio/data/studio.json',
  '/studio/data/works.json',
  '/studio/data/stimuli.json',
  '/studio/data/artist.json'
];

const isPublicCatalog = (payload) => Boolean(
  payload?.schema === 'mutine-public-catalog/v1'
  && payload.studio
  && payload.artist
  && Array.isArray(payload.works?.works)
);

async function loadLegacyCatalogData(fetchImpl) {
  const responses = await Promise.all(FALLBACK_DATA_URLS.map((url) => fetchImpl(url)));
  if (responses.some((response) => !response.ok)) throw new Error('Catalog data request failed');
  const [studio, works, stimuli, artist] = await Promise.all(responses.map((response) => response.json()));
  return { studio, works, stimuli, artist };
}

export async function loadCatalogData(fetchImpl = globalThis.fetch) {
  try {
    const compactResponse = await fetchImpl(PUBLIC_CATALOG_URL);
    if (compactResponse.ok) {
      const compactCatalog = await compactResponse.json();
      if (isPublicCatalog(compactCatalog)) return compactCatalog;
    }
  } catch {
    // Fall through to the source JSON files so a transient manifest failure cannot blank the site.
  }

  return loadLegacyCatalogData(fetchImpl);
}
