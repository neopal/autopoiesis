# Mutine daily studio record — Brush v028 / 2026-10-09

## Candidate

- **Current:** Brush (`brush`)
- **Work:** *The paint remembers the edge.*
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/p5-brush/v028/`
- **Canonical work:** `/works/brush-2026-10-09/`
- **Journal anchor:** `journal-brush-2026-10-09`

## Creative direction

The last three Brush works were a load-bearing membrane hinge (`v025`), a global threshold slab (`v026`), and a detached-island scrape (`v027`). Their repeated gesture was a visitor point/path acting on a field by deforming or separating visible material.

v028 makes a structural rupture: it changes medium from p5.js Canvas/WebGL to semantic inline SVG, representation from field/population to one overlapping wound-bearing reservoir, and encounter from subtracting to mending. Nine apertures are actual holes in compound SVG paths. A freehand route offers evidence but does not select the target: material resistance closes one wound and reopens a non-local edge. Four mends remain in bounded topology memory; lifting the latest reconstructs the exact prior field.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** Programmable pressure, density, grain, and directional fields participate in producing geometry rather than decorating finished geometry.
- **Mutine translation:** Invert v027's subtractive population. A mending route lets resistance choose one actual wound to seal; the missing edge reappears as a non-local SVG aperture.
- **Visible consequence:** The blind field is one continuous overlapping reservoir with nine compound-path wounds. After a mend, one aperture contracts, another opens, and surrounding bodies shift; later mends inherit that topology.
- **Falsifier:** If the pointer directly picks the wound, only a readout or colour changes, no actual aperture closes and opens elsewhere, later mends restart from baseline, or the blind field reads as a generic contour chart, the translation fails.
- **Anti-copy:** No p5.brush brushes, watercolor appearance, hatching vocabulary, source palette, composition, examples, or API surface is reproduced.
- **Direction consequence:** Closes the fracture-return population and opens an inverse material direction: repair is not restoration but a topological transfer of absence.

## Art gate

- **Hypothesis:** If material agency can remember removal, a mend should transfer an edge rather than restore a previous image.
- **Changed rule:** Material-selected SVG wound closure causes a non-local wound opening; topology is the memory.
- **Visible consequence:** Actual compound paths change; `data-wound` path count remains 9, while sealed/opened counts become non-zero after mending.
- **Interaction:** Pointerdown arms without writing; pointerup after a real route commits; repeated route is refused; Enter, Space, button, Delete, R, and S provide keyboard/export paths.
- **Deletion condition:** Delete v028 if wound holes are ornamental, if the non-local aperture does not change, if the blind view is a contour chart, or if lifting is inexact.

## Local evidence

- TDD RED observed: targeted `tests/brush-v028.test.mjs` failed because the v028 engine/tableau/register did not exist.
- Targeted tests: **5 passed, 0 failed**.
- JavaScript syntax: `node --check studies/p5-brush/v028/sketch.js` and `node --check scripts/brush-v028-probe.mjs` passed.
- Local headless browser matrix: **20/20 passed** on raw and canonical routes at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP `400+` responses in matrix and focused readbacks.
- Local overflow: **0** failures; `innerWidth = clientWidth = scrollWidth` in all matrix/readback checks.
- Local interaction: pointerdown armed with memory `0`; short gesture remained `0`; drag-release committed `0 → 1`; repeated drag was refused; second drag committed `1 → 2`; Delete lifted to the exact first signature; R released to `0`; Enter and mend button committed; controls measured `44px`.
- Blind preview: SVG field and all nine wound paths remained visible at `390×844`; readout, controls, and hint were hidden.
- Local readbacks: Journal anchor/title, Brush current card/title, canonical work tableau/title, catalogue record, and favicon returned successfully.
- Proof archive: `research/qa/proofs/brush-v028-2026-10-09/` (25 PNG captures plus `results.json`).

## Publication state

- **Source commit:** `33b8f836fe0cef833e5eb5fc3141fcc653d7cee7` (`[verified] Record Brush v028 daily work`)
- **Remote SHA:** `33b8f836fe0cef833e5eb5fc3141fcc653d7cee7` matched `origin/main` before production evidence update.
- **Scoped deploy attempt:** `npx vercel --prod --yes --scope lairpa-hotmailfrs-projects` returned `Not authorized`.
- **Linked-project deploy:** succeeded with `npx vercel --prod --yes`.
- **Deployment:** `dpl_5pHcKQK2iCnPCEyFt76zhoxy3xv5`
- **Deployment state:** `READY`
- **Stable alias:** https://autopoiesis-nine.vercel.app/
- **Production browser matrix:** **20/20 passed** on raw and canonical routes at all five required viewports in normal and reduced-motion modes.
- **Production diagnostics:** **0** console messages, page errors, failed requests, or HTTP `400+` responses in matrix and focused readbacks.
- **Production interaction:** pointerdown armed without writing; real drag committed; repeated drag refused; second drag committed; Delete restored the exact preceding signature; R, Enter, and mend control completed; controls measured 44px.
- **Production blind preview:** SVG field and nine wound paths remained visible with readout, controls, and hint hidden; no overflow.
- **Production readbacks:** `/studio/data/works.json` returned HTTP 200 with 156 records and exactly one `brush-2026-10-09`; `/studio/data/catalog-public.json` exposed the target; `/journal/` rendered the target anchor; `/currents/brush/` rendered the target card; `/works/brush-2026-10-09/` rendered the canonical title/tableau; `/studio/favicon.svg` returned HTTP 200.
- **Production proofs:** `research/qa/proofs/brush-v028-2026-10-09-production/`.

The candidate remains **held**, not exhibition-ready, pending independent caption-free perceptual comparison and explicit deployment-to-SHA linkage. The deployed content corresponds to the source/evidence commit above; the later evidence commit may follow the deployment, so Git and Vercel provenance remain separate claims.
