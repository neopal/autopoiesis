---
type: source-set
status: partial
captured: 2026-08-28
concepts:
  - "[[Contrainte plutôt que glyphe]]"
  - "[[Évaluation sans convergence]]"
  - "[[Portrait procédural]]"
  - "[[Matière et geste]]"
  - "[[Compute qui signifie quelque chose]]"
  - "[[ASCII comme contrainte de densité]]"
---
# Sources — 2026-08-28 — corpus fondateur

> Chaque entrée préserve l’URL, le niveau d’accès et les liens visibles. Les médias sont référencés mais jamais importés dans l’œuvre.

## Code / déterminisme / matière

### Atelier — Nischal
- URL : https://atelier.nischal.fyi/
- statut : **read**
- constat : « Every work is a program », stocké avec seed et re-rendu identiquement ; p5 2.3.2 / brush 2.2.1.
- concepts : [[Code comme artefact éditable]], [[Matière et geste]]
- essai : toute évolution Mutine déclare sa seed, même quand elle est animée.

### p5.brush — Alejandro Campos
- URL : https://p5-brush.cargo.site/
- statut : **read**
- constat : brosses, remplissages naturels, hachures, champs vectoriels ; avertissement implicite : qualité de texture parfois peu adaptée au temps réel.
- associé : https://github.com/acamposuribe/p5.brush
- concepts : [[Matière et geste]]
- essai : faire que le pinceau puisse effacer/retirer, non seulement ajouter.

### Surya Narreddi — Training AI to Paint with Code
- URL : https://surya.website/rling-qwen-to-paint-with-code
- statut : **read**
- constat : boucle p5.brush → rendu Puppeteer → jugement pairwise → GRPO ; la multiplication de signaux est corrélée et a produit des fleurs clip-art homogènes, puis la comparaison pairwise et un pool humainement trié ont changé le comportement.
- média : présentation Vimeo liée depuis l’article.
- concepts : [[Code comme artefact éditable]], [[Évaluation sans convergence]], [[Matière et geste]]
- essai : ne jamais additionner plusieurs scores qui mesurent la même acceptabilité.

### Camille Roux — genart-skill
- URL : https://github.com/camilleroux/genart-skill
- statut : **read**
- constat : vérification du déterminisme, seeds, traits et reproductibilité ; la vérification est explicitement limitée à une stabilité sur machine/résolution, pas une preuve universelle inter-GPU.
- concepts : [[Code comme artefact éditable]]
- essai : documenter la limite de toute métrique plutôt que la présenter comme vérité esthétique.

### Vercel — vgpu
- URL : https://x.com/vercel/status/2092999180780556643
- statut : **partial**
- texte observé : lib WebGPU agent-first, navigateur/headless Node/sandboxes CPU/CI et modules WGSL réutilisables.
- source liée : https://vgpu.sh
- concepts : [[Compute qui signifie quelque chose]]
- essai : une œuvre WebGPU devra publier un test headless de présence/absence de sa règle, pas seulement un FPS.

## Portrait, agent, divergence

### Kevin Ngo — Claude Fable self portraits
- URLs : https://x.com/kevin_t_ngo/status/2092872243634467022 · https://x.com/kevin_t_ngo/status/2093187543827370217
- statut : **partial**
- texte observé : « I asked Claude Fable 5 to draw self-portraits » ; seconde partie pointe vers démo live.
- associé : https://www.kengoworks.com/work/self-portraits (JavaScript, Browser)
- concepts : [[Portrait procédural]]
- essai : le portrait de Mutine doit montrer ses contraintes et ses rejets, non un avatar.

### Krax — peinture simulée / autoportrait
- URLs : https://x.com/Kraxkrokat/status/2090846079524667666 · https://x.com/Kraxkrokat/status/2092669256185913503
- statut : **partial**
- texte observé : comparaison de comportements de modèles dans un simulateur de peinture ; prompt commun : dessiner un autoportrait sur tout le canvas.
- média : vidéo x.com associée au second post.
- concepts : [[Portrait procédural]], [[Évaluation sans convergence]]
- essai : exposer, dans le self portrait, l’écart entre les mêmes règles et plusieurs seeds.

### Happycapy — théière devenue monde
- URL : https://x.com/happycapyai/status/2092934995589660747
- statut : **read**
- constat : mêmes entrées, mondes sous-marins/tortue/pagode/lapin selon modèles ; l’auteur oppose génération d’image et génération de mondes.
- concepts : [[Portrait procédural]]
- essai : faire porter à un chantier la dérive de son système, pas une fidélité de prompt.

## Archive, SVG, typographie, ASCII

### Daniel van Strien — Britannica
- URLs : https://x.com/vanstriendaniel/status/2092295830518562868 · https://x.com/vanstriendaniel/status/2092692169068777523
- statut : **read**
- constat : dataset de pages illustrées Britannica 1768–1929 et masques d’instances ; l’URL Hugging Face montre champs d’édition, année, source Archive.org et fichiers image.
- source : https://huggingface.co/datasets/biglam/britannica-illustrated-pages
- concepts : [[Archive traduite, jamais importée]]
- essai : traduire une planche observée en grammaire de silhouette, jamais la charger comme asset.

### Tran Mau Tri Tam — SVG minimal
- URL : https://x.com/tranmautritam/status/2092903904375951410
- statut : **partial**
- texte observé : collection de patterns SVG génératifs minimaux personnalisables/téléchargeables.
- concepts : [[Archive traduite, jamais importée]]
- essai : SVG pur doit dériver d’une contrainte et non d’un pattern paramétrique.

### Yuruyurau — créature Processing
- URL : https://x.com/yuruyurau/status/2092258811566583841
- statut : **read**
- texte observé : une fonction compactée qui dessine des formes sous-marines mouvantes par points ; une réponse propose une variation de la formule.
- réponses : https://x.com/2YLL4/status/2092297371233268195
- concepts : [[Contrainte plutôt que glyphe]], [[Archive traduite, jamais importée]]
- essai : construire un bestiaire par fonctions compactes, mais rendre chaque fonction lisible dans son propre commentaire.

### Atsvshi — typographie
- URL : https://x.com/atsvshi/status/2092527237560148386
- statut : **read** (capture X authentifiée)
- texte observé : archive Chiho recommandée par un maître en typographie.
- concepts : [[Contrainte plutôt que glyphe]]

### Skirook — ASCII lumineux
- URL : https://x.com/Skirook/status/2092866327828627927
- statut : **read** (capture X authentifiée)
- texte observé : expérimentation avec un langage visuel ASCII glowing.
- concepts : [[ASCII comme contrainte de densité]]
- essai : séparer contrainte ASCII et esthétique néon ; d’abord mesure de densité/rythme.

## Capture authentifiée : blocage levé

La session X via Chrome a été rendue accessible le 2026-08-28. Les 17 URLs ont été relues dans le navigateur authentifié ; les textes visibles, blocs de conversation et éléments de média accessibles ont été conservés comme preuve brute.

→ [[Sources — 2026-08-28 — X authenticated capture]]

Seule la seconde publication Kevin Ngo est désormais `partial` : elle expose quatre routes photo mais aucun texte extractible/alt dans le DOM rendu. Aucun contenu n’est inféré.