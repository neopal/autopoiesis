---
type: protocol
---
# Sources — protocole d’ingestion

## Carte minimale

```yaml
---
type: source
status: read | partial | blocked | to-read
source_url: https://…
author: 
date: 
media: []
replies: []
concepts: []
chantiers: []
---
```

## Méthode

1. Capturer le texte, l’auteur, date, médias et réponses visibles.
2. Ne jamais déduire un contenu derrière un mur X : marquer `blocked` ou `partial`.
3. Isoler une **tension** et une **expérience falsifiable** ; « style à reproduire » n’est jamais une conclusion.
4. Ajouter les backlinks vers concepts et chantiers.
5. Lorsqu’une œuvre mobilise la carte, lier le commit et noter l’écart entre intention et rendu.

Voir [[03 — Pratiques — éthique de référence]].