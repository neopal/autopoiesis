# Handoff — état de l’atelier

## État au 2026-08-28

- Dépôt : `https://github.com/neopal/autopoiesis`
- Authentification GitHub : `gh` est connectée à **neopal** avec droit admin/push.
- Front : galerie statique, sans framework, prête à Vercel.
- Vote : route `api/vote.js` prévue pour Vercel KV ; elle refuse explicitement si KV n’est pas configuré. Aucun vote n’est stocké en `localStorage`.
- X : Chrome était bien lancé mais aucune fenêtre Chrome n’était exposée au pilote natif ; les URL protégées par X restent donc documentées comme partielles, sans contournement de connexion.

## Prochaine passe

1. Vérifier le build et l’apparence locale de `galerie/` et de v001.
2. Se connecter à Vercel (`npx vercel login` si nécessaire), créer/lier `autopoiesis` sous `lairpa-hotmailfrs-projects` et créer un KV.
3. Déployer ; relire l’URL de production.
4. Écrire v002 en réponse aux premières critiques/retours.

## Invariants à préserver

- Une œuvre est exécutable, déterministe par seed et lisible ; pas d’images ni d’assets externes.
- Chaque évolution contient `README.md`, `metrics.json`, `critiques.json`, et sa note de réponse.
- Le travail régulier n’est jamais un prétexte pour produire une variation décorative.
