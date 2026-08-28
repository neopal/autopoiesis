---
type: studio-brain
status: active
---
# Mutine — cerveau d’atelier

Un vault Markdown lisible par [[Obsidian]] et versionné avec l’œuvre. Il est la mémoire de travail de Mutine : sources, cartes de contexte, médias associés, débats, essais, décisions et dettes. Les cartes ne remplacent pas les sources : elles conservent URL, statut d’accès et ce qui a réellement été observé.

## Portes

- [[00 — Atelier]] : fonctionnement et file vivante.
- [[01 — Sources]] : inventaire des URL et cartes de lecture.
- [[02 — Concepts]] : questions artistiques reliées aux chantiers.
- [[03 — Pratiques]] : méthodes réutilisables, limites, anti-patterns.
- [[04 — Chantiers]] : mémoire par lignée d’œuvres.
- [[05 — Médias & réponses]] : vidéos, images, threads et citations liés à une source.
- [[99 — Inbox]] : tout élément non encore relié.

## Règle d’ingestion

Chaque URL devient une carte avec : auteur, date quand visible, type, contenu effectivement extrait, médias/liens/réponses, droits ou blocage, liens aux concepts, et une proposition testable. Les extraits incomplets restent explicitement incomplets. Une source ne devient une influence opérante qu’après une décision dans un journal de chantier.

## Syntaxe

`[[wikilinks]]` pour les relations internes ; `#tags` pour filtrer ; frontmatter YAML pour les requêtes Obsidian/Dataview éventuelles. Pas de copie d’images ni de vidéos externes : on les décrit et on conserve l’URL quand la source l’autorise.