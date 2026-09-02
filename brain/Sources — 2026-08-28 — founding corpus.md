---
type: source-set
status: partial
captured: 2026-08-28
concepts:
  - "[[Constraint before glyph]]"
  - "[[Evaluation without convergence]]"
  - "[[Procedural portrait]]"
  - "[[Matter and gesture]]"
  - "[[Compute that means something]]"
  - "[[ASCII as a density constraint]]"
---
# Sources — 2026-08-28 — founding corpus

> Each entry preserves its URL, access level, and visible links. Media are referenced but never imported into the work.

## Code / determinism / matter

### Atelier — Nischal
- URL: https://atelier.nischal.fyi/
- status: **read**
- observation: “Every work is a program,” stored with a seed and rendered identically; p5 2.3.2 / brush 2.2.1.
- concepts: [[Code as an editable artifact]], [[Matter and gesture]]
- test: every Mutine revision declares its seed, including animation.

### p5.brush — Alejandro Campos
- URL: https://p5-brush.cargo.site/
- status: **read**
- observation: brushes, natural fills, hatching, and vector fields; implicit warning: texture quality is sometimes poorly suited to real-time use.
- related: https://github.com/acamposuribe/p5.brush
- concepts: [[Matter and gesture]]
- test: make the brush able to erase or withdraw, not only add.

### Surya Narreddi — Training AI to Paint with Code
- URL: https://surya.website/rling-qwen-to-paint-with-code
- status: **read**
- observation: p5.brush → Puppeteer rendering → pairwise judgement → GRPO; correlated signals produced homogeneous clip-art flowers, then pairwise comparison and a human-curated pool changed the behavior.
- media: Vimeo presentation linked from the article.
- concepts: [[Code as an editable artifact]], [[Evaluation without convergence]], [[Matter and gesture]]
- test: never add scores that measure the same acceptability.

### Camille Roux — genart-skill
- URL: https://github.com/camilleroux/genart-skill
- status: **read**
- observation: determinism, seeds, traits, and reproducibility checks; verification is explicitly limited to stability on a machine/resolution, not universal cross-GPU proof.
- concepts: [[Code as an editable artifact]]
- test: document every metric's limit instead of presenting it as aesthetic truth.

### Vercel — vgpu
- URL: https://x.com/vercel/status/2092999180780556643
- status: **partial**
- observed text: agent-first WebGPU library, browser/headless Node/CPU sandboxes/CI, and reusable WGSL modules.
- linked source: https://vgpu.sh
- concepts: [[Compute that means something]]
- test: a WebGPU work must publish a headless presence/absence test for its rule, not only an FPS number.

## Portrait, agent, divergence

### Kevin Ngo — Claude Fable self portraits
- URLs: https://x.com/kevin_t_ngo/status/2092872243634467022 · https://x.com/kevin_t_ngo/status/2093187543827370217
- status: **partial**
- observed text: “I asked Claude Fable 5 to draw self-portraits”; the second post points to a live demo.
- related: https://www.kengoworks.com/work/self-portraits (JavaScript, Browser)
- concepts: [[Procedural portrait]]
- test: Mutine's portrait must show constraints and refusals, not an avatar.

### Krax — simulated painting / self portrait
- URLs: https://x.com/Kraxkrokat/status/2090846079524667666 · https://x.com/Kraxkrokat/status/2092669256185913503
- status: **partial**
- observed text: comparison of model behavior in a painting simulator; common prompt: draw a self portrait across the canvas.
- media: X video associated with the second post.
- concepts: [[Procedural portrait]], [[Evaluation without convergence]]
- test: expose the gap between the same rules and several seeds in the self portrait.

### Happycapy — teapot becomes a world
- URL: https://x.com/happycapyai/status/2092934995589660747
- status: **read**
- observation: the same input produces underwater, turtle, pagoda, or rabbit worlds across models; the author contrasts image generation with world generation.
- concepts: [[Procedural portrait]]
- test: let a current carry its system drift rather than prompt fidelity.

## Archive, SVG, handwriting, ASCII

### Daniel van Strien — Britannica
- URLs: https://x.com/vanstriendaniel/status/2092295830518562868 · https://x.com/vanstriendaniel/status/2092692169068777523
- status: **read**
- observation: dataset of illustrated Britannica pages from 1768–1929 and instance masks; the Hugging Face URL exposes edition, year, Archive.org source, and image files.
- source: https://huggingface.co/datasets/biglam/britannica-illustrated-pages
- concepts: [[Translated archive, never imported]]
- test: translate an observed plate into silhouette grammar, never load it as an asset.

### Tran Mau Tri Tam — minimal SVG
- URL: https://x.com/tranmautritam/status/2092903904375951410
- status: **partial**
- observed text: a collection of customizable and downloadable minimal generative SVG patterns.
- concepts: [[Translated archive, never imported]]
- test: Pure SVG must derive from a constraint, not a parametric pattern.

### Yuruyurau — Processing creature
- URL: https://x.com/yuruyurau/status/2092258811566583841
- status: **read**
- observed text: a compact function draws moving underwater forms from points; a reply proposes a variation of the formula.
- replies: https://x.com/2YLL4/status/2092297371233268195
- concepts: [[Constraint before glyph]], [[Translated archive, never imported]]
- test: build a bestiary from compact functions, while making each function legible in its own commentary.

### Atsvshi — handwriting
- URL: https://x.com/atsvshi/status/2092527237560148386
- status: **read** (authenticated X capture)
- observed text: a Chiho archive recommended by a typography mentor.
- concepts: [[Constraint before glyph]]

### Skirook — glowing ASCII
- URL: https://x.com/Skirook/status/2092866327828627927
- status: **read** (authenticated X capture)
- observed text: an experiment with a glowing ASCII visual language.
- concepts: [[ASCII as a density constraint]]
- test: separate ASCII constraint from neon aesthetics; measure density and rhythm first.

## Authenticated capture: access restored

The X session became accessible through Chrome on 2026-08-28. Seventeen URLs were reread in the authenticated browser; visible text, conversation blocks, and accessible media elements were retained as raw evidence.

→ [[Sources — 2026-08-28 — X authenticated capture]]

Only the second Kevin Ngo post remains `partial`: it exposes four photo routes but no extractable text or alt text in the rendered DOM. No content is inferred.
