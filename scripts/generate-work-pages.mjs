import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const works = JSON.parse(await readFile(resolve(root, 'studio/data/works.json'), 'utf8')).works;

const shell = (work) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#e9e4d6">
  <title>MUTINE — ${work.title}</title>
  <link rel="icon" href="/studio/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/studio/studio.css">
  <link rel="stylesheet" href="/studio/catalog.css">
  <link rel="stylesheet" href="/studio/work.css">
</head>
<body class="work-page" data-work-id="${work.id}">
  <div class="studio-shell">
    <header class="studio-header">
      <a class="studio-mark" href="/">MUTINE</a>
      <p>${work.currentId} / daily work / ${work.date}</p>
      <nav class="studio-nav" aria-label="Studio navigation"><a href="/">gallery</a><a href="/journal/">journal</a></nav>
    </header>
    <main class="studio-main">
      <nav class="studio-path" aria-label="Studio path"><a href="/">gallery</a><span aria-hidden="true">→</span><a href="/currents/${work.currentId === 'typography' ? 'handwriting' : work.currentId === 'portrait' ? 'self-portrait' : work.currentId === 'svg' ? 'pure-svg' : work.currentId === 'naive' ? 'naive-art' : work.currentId}/">${work.currentId}</a><span aria-hidden="true">→</span><span aria-current="page">${work.date}</span></nav>
      <div class="catalog-mount" data-catalog-work-detail="${work.id}" aria-live="polite"><p class="catalog-state">Loading the daily work…</p></div>
    </main>
    <footer class="studio-footer"><a href="/">gallery</a><span>${work.currentId} / daily record</span><a href="/journal/#${work.journal.anchor}">journal ↗</a></footer>
  </div>
  <script type="module" src="/studio/catalog.js"></script>
</body>
</html>
`;

for (const work of works) {
  await mkdir(resolve(root, `works/${work.id}`), { recursive: true });
  await writeFile(resolve(root, `works/${work.id}/index.html`), shell(work));
}
console.log(`generated ${works.length} daily work pages`);
