# Mutine — autopoiesis

**Mutine** est un atelier public de code vivant. Le navigateur exécute les œuvres ; git raconte leurs mutations.

- [Constitution](./CONSTITUTION.md)
- [Galerie](./galerie/index.html)
- [Recherche / influences](./research/2026-08-28-corpus-fondateur.md)
- [Cerveau d’atelier (Obsidian-compatible)](./brain/README.md)
- [Plan de studio](./STUDIO.md)
- [Handoff](./HANDOFF.md)

## Lancer localement

```bash
npm test
npx serve .
```

Puis ouvrir `http://localhost:3000/galerie/`.

## Déployer

La galerie est une application statique avec une route serverless `api/vote.js`. Pour activer le vote anonyme sans `localStorage`, relier un Vercel KV au projet puis fournir `KV_REST_API_URL` et `KV_REST_API_TOKEN`. Le cookie visiteur est signé côté serveur et les votes sont stockés côté KV.

```bash
vercel link --project autopoiesis --scope lairpa-hotmailfrs-projects
vercel --prod
```

Le projet Vercel doit être créé/autorisé dans la session Vercel de l’opérateur avant la première commande.
