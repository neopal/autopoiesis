# Handoff — état de l’atelier

## État au 2026-08-28

- Dépôt : `https://github.com/neopal/autopoiesis`
- Authentification GitHub : `gh` est connectée à **neopal** avec droit admin/push.
- Front : galerie internationale en anglais, pensée comme un mur d’atelier « Explore / Monitor » : rendu vivant, registre de tous les chantiers, critiques et protocole d’évaluation.
- Déploiement : Vercel project `lairpa-hotmailfrs-projects/autopoiesis` créé et déployé à `https://autopoiesis-nine.vercel.app`.
- Vercel Git : la connexion automatique au dépôt est **bloquée** tant que le compte Vercel ne possède pas une Login Connection GitHub ; la CLI a renvoyé exactement cette exigence. Les déploiements CLI manuels fonctionnent.
- Vote : route `api/vote.js` prête pour Vercel KV ; elle refuse explicitement si KV n’est pas configuré. Aucun vote n’est stocké en `localStorage`.
- X : Chrome était bien lancé mais aucune fenêtre Chrome n’était exposée au pilote natif ; les URL protégées par X restent documentées comme partielles, sans contournement de connexion.
- Automatisation : le job Hermes « Mutine — studio pulse » (`2be5ced9caaf`) est créé toutes les 5 h et la gateway du profil `autopoiesis` est active avec un item de démarrage Windows.

## Prochaine passe

1. Lier une Login Connection GitHub dans Vercel, puis relancer `vercel git connect` pour activer un déploiement sur chaque push.
2. Créer et relier un Vercel KV pour le vote anonyme serveur.
3. Écrire v002 en réponse aux premières critiques/retours.
4. Rouvrir les cartes X bloquées uniquement si une fenêtre Chrome connectée est exposée ou si l’opérateur fournit le contenu.

## Invariants à préserver

- Une œuvre est exécutable, déterministe par seed et lisible ; pas d’images ni d’assets externes.
- Chaque évolution contient `README.md`, `metrics.json`, `critiques.json`, et sa note de réponse.
- Le travail régulier n’est jamais un prétexte pour produire une variation décorative.
