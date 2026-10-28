# MUTINE daily studio record — Pure SVG / 2026-10-28

## Target

- **Current:** Pure SVG (`current_index=3/6`)
- **Date:** `2026-10-28`
- **Version:** `v038`
- **Title:** *The field refuses the pair.*
- **Status:** `candidate / held`
- **Canonical:** `/works/svg-2026-10-28/`
- **Raw tableau:** `/studies/pure-svg/v038/`
- **Slot decision:** `existing_work_id=none`, `action=create-and-record`
- **Cultural reference:** `little-critters` — https://github.com/GordenSun/little-critters

## Artistic direction

The last three Pure SVG works retained a relation-through-path grammar: v035 used a dwell to open a remote topology, v036 turned a drawn stroke into an open filament field, and v037 reduced a proximity tour to a remote vacancy in independent cut cells. v038 makes a material rupture in representation and encounter: a split-margin field of angular folds replaces the body, filament, and cell constellation; a single two-edge accord replaces dwell, drawing, and touring.

- **Hypothesis:** If attention is treated as a refused accord rather than a local mark, the field can keep two offered edges exact while producing a counterfold elsewhere.
- **Changed rule:** A separated pair is offered but not connected. The endpoints stay exact; an unoffered counterfold, hinge, and echo carry the refusal through actual SVG path and crease geometry.
- **Visible consequence:** The blind first view is twelve angular folds on split margins around a withheld middle. A valid pair removes its temporary offer and changes three unoffered folds through path, notch, scale, angle, and crease geometry. Four refusals persist.
- **Interaction:** Pointer/touch down at one edge and release at another; one-edge, near, same-edge, and sprawling offers refuse. Enter/Space and `offer two edges` commit deterministic pairs. Delete lifts; Escape/R releases.
- **Falsifier:** Delete if the offer is copied, endpoints deform, the counterfold is one of the offered edges, remote roles are cosmetic, the blind field reads as a generic diagram/grid/interface, later accords reset, or exact lifting fails.
- **Deletion condition:** Delete v038 if caption-free viewing cannot distinguish the counterfold field from v035–v037's body, filament, score, or cut-cell grammars.

## Cultural translation

The source makes a population of code-drawn agents turn toward pointer proximity, making the visitor part of a reciprocal social field without a dashboard. Mutine inverts that mechanism rather than borrowing its surface: no animals, eyes, characters, paper scene, head-turning gesture, palette, composition, source code, examples, API names, or surface vocabulary are reproduced. The Pure SVG translation is that an offered pair is refused locally, and an unoffered fold turns away elsewhere. The temporary accord line disappears; actual remote SVG paths and creases change.

This closes the proximity-tour / open-filament / closed-topology family and opens counterfold: Pure SVG asks what geometry a refusal can produce when a relation is not allowed to connect.

## Local verification

- Targeted TDD slice: **5 passed, 0 failed**. RED was observed first with the expected missing `v038/engine.mjs` module error.
- Full suite: **1144 passed, 0 failed** (`npm run test`).
- Full daily catalogue test: **7 passed, 0 failed**.
- JavaScript syntax: `engine.mjs`, `sketch.js`, `tests/pure-svg-v038.test.mjs`, and `scripts/pure-svg-v038-probe.mjs` passed `node --check`.
- Local browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Local diagnostics: **0**; overflow failures: **0**; minimum touch target: **44px**.
- Local interaction: pointer accord committed with geometry changed, `12` folds, `1` counterfold, `endpointsExact=true`; Delete restored the exact baseline; Enter committed; R released; weak near pair refused.
- Local blind preview: visible `12`-fold inline SVG field, memory `4`, counterfolds `4`; readout, controls, annotations hidden; `innerWidth/clientWidth/scrollWidth=390/390/390`.
- Local readbacks: Journal anchor/title, Pure SVG current/card, canonical work/tableau, raw v038, source register, public catalogue, and favicon all returned/rendered.
- Production browser matrix: **20/20 passed** at the same five viewports, raw/canonical, normal/reduced motion.
- Production diagnostics: **0**; overflow failures: **0**; minimum touch target: **44px**.
- Production interaction: pointer accord committed with geometry changed, endpoints exact, counterfold produced; Delete restored; Enter committed; R released; weak near pair refused.
- Production blind preview: visible `12`-fold inline SVG field, memory `4`, counterfolds `4`; readout, controls, annotations hidden; `innerWidth/clientWidth/scrollWidth=390/390/390`.
- Production readbacks: deployed Journal anchor/title, Pure SVG current/card, canonical work/tableau, raw v038, deployed `works.json`, deployed `catalog-public.json`, and favicon all returned/rendered exactly once.
- Proofs: `research/qa/proofs/pure-svg-v038-2026-10-28/` and `research/qa/proofs/pure-svg-v038-2026-10-28-production/` (each `qa-summary.json`, three screenshots, README).

## Publication state

- Artifact commit: `5381aa1659dff8f028aae46327a9f940cb2442be`.
- Remote `main` matched the artifact commit before the evidence update.
- Production deployment: `dpl_G8fX6hDzfBzyTbRzsnGszi5Uge9x`; stable alias: https://autopoiesis-nine.vercel.app.
- Deployed record verification: `/studio/data/works.json` returned exactly one `svg-2026-10-28` record with the title and raw path; `/studio/data/catalog-public.json` returned exactly one matching catalogue record.
- Rendered Journal verification: `/journal/` contained `journal-svg-2026-10-28` and *The field refuses the pair.*; canonical and raw tableau routes rendered the v038 field.
- The work remains **candidate / held**. Independent caption-free perceptual review and provider revision linkage between the Vercel deployment and GitHub SHA remain unresolved.
