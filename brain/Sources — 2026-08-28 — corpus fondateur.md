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
- statut : **blocked**
- motif : aucun contenu extrait.
- concepts : [[Contrainte plutôt que glyphe]]

### Skirook — ASCII lumineux
- URL : https://x.com/Skirook/status/2092866327828627927
- statut : **partial**
- texte observé : expérimentation avec un langage visuel ASCII glowing ; réponse liée vers patterns Figma.
- concepts : [[ASCII comme contrainte de densité]]
- essai : séparer contrainte ASCII et esthétique néon ; d’abord mesure de densité/rythme.

## Sources encore fermées

- https://x.com/msurguy/status/2092709705487683889 — `blocked`, aucun contenu.
- https://x.com/acamposuribe/status/2092906714014093351 — `blocked`, mur de connexion.
- https://x.com/estebanpm__/status/2092688339883208929 — `blocked`, mur de connexion.
- https://x.com/ann_nnng/status/2093217880896852284 — `blocked`, aucun contenu.
- https://x.com/Merzmensch/status/2092913264606728684 — `partial`, retour assumé vers l’esthétique symbolique/non-photoréaliste de Disco Diffusion ; aucune image reprise.

Relire [[Sources — protocole d’ingestion]] lors de l’ouverture d’une session X accessible.