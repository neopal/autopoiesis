# Mutine daily studio record — 2026-09-26 — Naive art

## Slot

- Target current: Naive art (`naive`), slot `5/6`.
- Work: *The picture remembers a second horizon.*
- Version: `studies/naive-art/v019/`.
- Status: candidate / held.
- Cultural reference selected by the slot helper: `little-critters` — https://github.com/GordenSun/little-critters.
- Browser verification used headless Playwright only; no headed browser, CUA, CDP, remote debugging, or GUI launch was used.

## Creative direction

The last three Naive records used isolated SVG forms (`v016`), a load-bearing Canvas pile (`v017`), and one hinged Canvas mechanism (`v018`). v019 makes a material rupture: one continuous p5 panorama, a weather/horizon vocabulary, and a discrete wheel/arrow encounter replace the object, pile, and directional-drag grammars.

### Changed rule

A wheel step misreads one weather form. Its actual contour opens, a distant form borrows the wrong contour, and the shared horizon redraws at a changed slope to carry the error. Pointer movement and short clicks have no causal path. Delete/undo reconstructs the exact preceding mural.

### Cultural translation

- **Observed mechanism:** situated code-drawn agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter rather than a controller of a dashboard.
- **Mutine translation:** refuse the look-back and turn situated attention into an ordinal weather error: a wheel step opens one source contour, teaches a distant form the wrong edge, and forces the shared horizon to carry the false relation.
- **Visible consequence:** the blind field is one continuous naive panorama; after a step, a source opening, a distant borrowed contour, and a changed horizon are all geometry.
- **Falsifier:** if a short tap changes the mural, if the source opening is only recolouring, if the borrowed contour is only a marker, or if the horizon remains fixed, the translation fails.
- **Anti-copy:** no animals, characters, eyes, paper style, source palette, composition, or head-turning surface vocabulary is reproduced.
- **Direction consequence:** closes the recent joint/adjacency grammar and opens a continuous mural direction where a discrete misreading becomes a rule of the shared world.

## Files

- `studies/naive-art/v019/index.html`
- `studies/naive-art/v019/engine.mjs`
- `studies/naive-art/v019/sketch.js`
- `studies/naive-art/v019/style.css`
- `studies/naive-art/v019/README.md`
- `studies/naive-art/v019/metrics.json`
- `studies/naive-art/v019/critiques.json`
- `works/naive-2026-09-26/index.html`
- `tests/naive-art-v019.test.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `research/qa/proofs/naive-art-v019-2026-09-26/`

## TDD and local verification

- RED observed before the title-spacing fix: the new test failed because the rendered `<h1>` produced `remembersa` in DOM text.
- GREEN targeted test after the minimal HTML fix: **3 passed, 0 failed**.
- Local headless browser matrix: **20/20** raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion.
- Browser diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Overflow: **0** failures; `innerWidth = clientWidth = scrollWidth` in all matrix runs.
- Interaction: pointer movement and click unchanged; wheel changed geometry; ArrowDown changed geometry; Delete restored the preceding wheel signature; release returned to the seeded sequence.
- Blind preview: canvas visible; readout and controls hidden; memory reached `4` with no overflow.
- Journal: exactly one `#journal-naive-2026-09-26` entry with title and canonical link.
- Naive current: header and first artwork rendered at `390×844` with no overflow.
- Captures: `24` PNGs in the proof bundle (`20` matrix, interaction, blind, Journal, current).
- `node --check` passed for `engine.mjs` and `sketch.js`.
- Catalog-focused suite: **21 passed, 0 failed**.
- Full suite: **529 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo**.
- Production headless browser matrix: **20/20** raw/canonical runs passed at the same five viewports in normal and reduced-motion modes.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Production interaction: pointer/click unchanged; wheel and ArrowDown changed geometry; Delete restored the preceding signature; release returned to the seeded sequence.
- Production blind/Journal/current readbacks: canvas visible with furniture hidden; exactly one Journal anchor/title; Naive art current header and first work present; no overflow.
- Production proof bundle: `research/qa/proofs/naive-art-v019-2026-09-26-production/`, with `24` PNG captures plus `results.json`, `summary.json`, and `probe.mjs`.

## Publication state

- Commit: `717f3e3fac30ca17a0d59cd0dd8c46db320c78ba`.
- `origin/main`: matched the commit before deployment.
- Deployment: `dpl_2CUcgKuv4KJeb6zXQKpHGyw7GPKc`; stable alias `https://autopoiesis-nine.vercel.app/`.
- Production HTTP readback: `/studio/data/works.json`, canonical work, raw tableau, and favicon returned **200**.
- Rendered production Journal readback: exactly one `#journal-naive-2026-09-26` entry with the title and canonical link.
- The deployed JSON contains exactly one `naive-2026-09-26` record with the correct raw path, status, and Journal anchor.

## Evidence boundary

Production runtime and responsive evidence is complete. The candidate remains held for independent caption-free perceptual review and provider revision linkage. Runtime evidence does not prove that the changed weather law reads immediately without labels or explanation.

## Next decision

Run the labels-off, controls-off, readout-off comparison after publication. Delete v019 if the source opening, distant borrowed contour, and wrong horizon are not legible in the panorama itself, or if the blind view still reads as v018's repaired hinge object.
