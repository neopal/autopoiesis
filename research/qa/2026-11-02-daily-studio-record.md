# Mutine daily studio record — 2026-11-02

## Audit boundary

- Target slot: `current_id=typography`, `current_index=1/6`, `culture_reference_id=p5-brush`, `existing_work_id=none`, `action=create-and-record`.
- Active catalogue sources: `studio/data/studio.json`, `studio/data/works.json`, and `studio/data/cultural-field.json`.
- No missed historical dates were invented.

## Work

- **Current:** Handwriting / `typography`
- **Work:** `typography-2026-11-02` — *The letter keeps its pressure debt.*
- **Raw tableau:** `/studies/handwriting/v040/`
- **Canonical route:** `/works/typography-2026-11-02/`
- **Status:** `candidate / held`
- **Lifecycle:** `active`
- **Lineage:** `typography-2026-11-01`

## Direction change

The last three handwriting works tested a folded SVG sentence with a pressure cut (v037), a browser-native word field with typed ratification (v038), and a Canvas route topology with remote rewiring (v039). v040 makes a material and encounter rupture: one asymmetric Canvas rack of nine actual glyph chambers replaces sentence, word, and route composition. Holding is geometry-neutral until 640ms; release transfers elapsed pressure into three remote glyph bodies while the source remains exact. Duration changes actual position, scale, width, slant, counter, and ink. Four debts compound and can be lifted.

## Cultural translation

- **Observed mechanism:** p5.brush makes pressure, density, directional behavior, and material state participate in producing geometry rather than sit on top of it as decoration.
- **Mutine translation:** refuse brush marks, watercolor, hatching, and grain; make elapsed pressure a debt that migrates into remote glyph chambers and changes the next letter's geometry.
- **Visible consequence:** a blind rack of nine rendered glyphs becomes visibly opened, compressed, and leaned at three remote sites after threshold release; longer holds produce stronger geometry.
- **Falsifier:** delete if holding changes geometry early, short release commits, duration is cosmetic, the source answers itself, remote change is only colour/readout, or later pressure resets.
- **Anti-copy:** no brush preset, watercolor appearance, hatching vocabulary, grain, palette, composition, source code, API surface, or source imagery was reproduced.
- **Direction consequence:** closes Handwriting's route / token / seam sequence and opens material type: a letter becomes a chamber that can carry another event's pressure.

## Evidence

- TDD targeted slice: **4/4 passed**. The first test was observed red with the expected missing-module error before `v040/engine.mjs` existed; the structural registration test was observed red before the canonical route and record existed.
- Full suite after the catalogue expectations were updated: **1285/1285 passed**.
- JavaScript syntax checks: passed for `engine.mjs`, `sketch.js`, and the Playwright probe.
- JSON validation: passed for source, public catalogue, metrics, and critiques.
- Local headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion.
- Local interaction: short pointer hold refused without geometry change; threshold pointer hold transferred to exactly three remote chambers while the source stayed exact; duration was structural; Delete lifted; keyboard, button, and touch paths committed; release returned to quiet.
- Local blind preview: `390×844`, Canvas visible, 9 chambers, 4 debts, controls/readout/note/hint hidden, `innerWidth/clientWidth/scrollWidth=390/390/390`.
- Local canonical/readbacks: works JSON, public catalog JSON, Journal anchor/title, Handwriting current/card, canonical tableau, raw tableau, and favicon returned/rendered; diagnostics `0`, overflow `0`, minimum touch target `44px`.
- Stable-alias production headless browser matrix: **20/20 passed** across the same five viewports and two motion modes; interaction, blind preview, canonical tableau-first route, diagnostics `0`, overflow `0`, and minimum touch target `44px` were read back from `https://autopoiesis-nine.vercel.app`.
- Stable-alias production readbacks: exactly one `typography-2026-11-02` record in deployed works/public catalogue JSON; Journal anchor/title, Handwriting current/card, canonical tableau, raw tableau, and favicon returned/rendered.
- Proof archives: `research/qa/proofs/handwriting-v040-2026-11-02/`, `research/qa/proofs/handwriting-v040-2026-11-02-production/`, and the final deployment readback at `research/qa/proofs/handwriting-v040-2026-11-02-production-final/`.

## Publication

- Artifact commit: `fbc660319b8a49bc530519f7094d1d0808f5b936`.
- Evidence commit: `033f71ece15fe8ab0747ca9556cff2927a06c4c4`.
- Remote `main`: matched `033f71ece15fe8ab0747ca9556cff2927a06c4c4`.
- Final production deployment: `dpl_4LjKQyhmUrbwh4Cjps6PEonHXnrP`, deployment URL `https://autopoiesis-la0q4hcke-lairpa-hotmailfrs-projects.vercel.app`, stable alias `https://autopoiesis-nine.vercel.app`.
- The final stable-alias probe re-read the deployed works/public catalogue JSON, Journal anchor/title, Handwriting current/card, canonical tableau, raw tableau, and favicon; all returned/rendered as recorded above.

## Unresolved doubt

- Independent caption-free perceptual review is unavailable in this unattended run.
- Provider revision linkage between the final Vercel deployment and GitHub SHA remains unresolved.

Candidate remains held; exhibition readiness is not claimed.
