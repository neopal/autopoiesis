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

Production publication is authorized after the local gates. The production matrix/readbacks and provider revision linkage are recorded separately after deployment. The candidate remains **held**, not exhibition-ready, pending independent caption-free perceptual comparison and explicit deployment-to-SHA linkage.
