import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataRoot = new URL('../studio/data/', import.meta.url);
const publicCatalogUrl = new URL('../studio/data/catalog-public.json', import.meta.url);
const RUNTIME_WORK_FIELDS = [
  'id',
  'currentId',
  'date',
  'title',
  'rawPath',
  'status',
  'lifecycle',
  'journal',
  'critiques',
  'metrics',
  'decision'
];
const QA_ONLY_FIELDS = new Set(['browserEvidence', 'probe']);
const isQaOnlyField = (key) => QA_ONLY_FIELDS.has(key) || /probe/i.test(key);

const withoutQaEvidence = (value) => {
  if (Array.isArray(value)) return value.map(withoutQaEvidence);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isQaOnlyField(key))
      .map(([key, entry]) => [key, withoutQaEvidence(entry)])
  );
};

export function buildPublicCatalog({ studio, works, artist }) {
  return {
    schema: 'mutine-public-catalog/v1',
    studio,
    artist,
    works: {
      schema: works?.schema ?? 'mutine-works/v1',
      works: (works?.works ?? []).map((work) =>
        withoutQaEvidence(Object.fromEntries(
          RUNTIME_WORK_FIELDS
            .filter((field) => Object.hasOwn(work, field))
            .map((field) => [field, work[field]])
        ))
      )
    }
  };
}

export async function generatePublicCatalog() {
  const [studio, works, artist] = await Promise.all(
    ['studio.json', 'works.json', 'artist.json']
      .map((filename) => readFile(new URL(filename, dataRoot), 'utf8'))
  );
  const publicCatalog = buildPublicCatalog({
    studio: JSON.parse(studio),
    works: JSON.parse(works),
    artist: JSON.parse(artist)
  });
  const serialized = `${JSON.stringify(publicCatalog)}\n`;
  await writeFile(publicCatalogUrl, serialized, 'utf8');
  return { bytes: Buffer.byteLength(serialized), path: fileURLToPath(publicCatalogUrl) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await generatePublicCatalog();
  console.log(`Generated ${result.path} (${result.bytes} bytes)`);
}
