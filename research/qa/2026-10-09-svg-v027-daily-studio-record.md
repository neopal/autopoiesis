# Mutine daily studio record — Pure SVG v027 — 2026-10-09

- **Target:** Pure SVG (`svg`) · 2026-10-09 · slot 3/6
- **Work:** *The weight finds a seam.*
- **Status:** candidate / held
- **Study:** `/studies/pure-svg/v027/`
- **Canonical:** `/works/svg-2026-10-09/`
- **Raw preview:** `/studies/pure-svg/v027/?preview=1&interaction=1`
- **Blind preview:** `/studies/pure-svg/v027/?preview=1&static=1&blind=1`

## Changed rule

v027 abandons v024's compound witness-knot, v025's single open contour and drawn route, and v026's dispersed fragment population. Eleven continuous SVG strata share a resistance field. A pressure puncture does not mark the pointer location: the material chooses its weakest seam, slips the stack, and carries inherited resistance into the next event. Four slips remain in bounded memory; Delete lifts the latest exact stack; R releases to the seed.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure, density, grain, and vector fields participate in producing geometry rather than decorating finished geometry.
- **Mutine translation:** refuse brushes, watercolor, hatching, source palette, examples, and API. Pressure enters as a vector; the Pure SVG material chooses the weakest seam and re-forms every long path body around it.
- **Visible consequence:** the blind field is eleven long SVG strata. After a puncture, actual path silhouettes bend across the stack at a calculated seam; later punctures choose against inherited slips.
- **Falsifier:** a cursor/colour/readout-only response, direct pointer-to-seam selection, fewer than five changed strata, memory reset, or a blind generic chart/waveform/particle reading.
- **Direction consequence:** closes the discrete-population and single-boundary sequence; opens a constraint-as-material direction with a small number of load-bearing paths.
- **Anti-copy:** no p5.brush brushes, watercolor surface, hatching vocabulary, source palette, source composition, source examples, or API surface is reproduced.

## Files

- `studies/pure-svg/v027/` — executable SVG tableau, engine, styling, README, metrics, critiques
- `works/svg-2026-10-09/index.html` — canonical navigable work shell
- `studio/data/works.json` — one factual daily record; total 155
- `studio/data/catalog-public.json` — rebuilt public catalog
- `scripts/pure-svg-v027-probe.mjs` — local/production headless browser QA
- `tests/pure-svg-v027.test.mjs` — engine TDD coverage
- updated catalogue expectation tests
- `research/qa/proofs/pure-svg-v027-2026-10-09/` — local matrix, interaction, blind and readback proofs
- `research/qa/proofs/pure-svg-v027-2026-10-09-production/` — production matrix, interaction, blind and public readback proofs

## Verification

- TDD RED observed for missing `engine.mjs`, `applyLoad`, `liftLatestSlip`, and `buildTimeline`; each was implemented only after the expected failure.
- Targeted tests: **15 passed, 0 failed** (v027 + catalogue tests).
- Full `npm run test`: **772 passed, 0 failed**.
- JavaScript syntax checks: passed.
- `git diff --check`: passed.
- Local headless browser matrix: **20/20 passed** across raw/canonical routes, normal/reduced motion, and `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP `400+` responses.
- Local overflow: **0** failures; all inner/client/scroll widths matched.
- Local interaction: pointerdown `memory 0 → pressure-armed`; pointerup `0 → 1`; Enter `0 → 1`; Delete restored exact prior signature; load button `0 → 1`; lift restored `0`; release returned to baseline; all controls measured 44px high.
- Production headless browser matrix: **20/20 passed** across raw/canonical routes, normal/reduced motion, and `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP `400+` responses across matrix, interaction, blind, Journal, current, and work readbacks.
- Production interaction: pointerdown `memory 0 → pressure-armed`; pointerup `0 → 1`; Enter `0 → 1`; Delete restored exact prior signature; load/lift/release completed; controls measured 44px.
- Production blind preview: field visible with 11 SVG strata and 11 paths; readout and controls hidden; `innerWidth=390`, `clientWidth=390`, `scrollWidth=390`.
- Public readbacks: stable alias `https://autopoiesis-nine.vercel.app/` returned HTTP 200 for works JSON, public catalog, Journal, Pure SVG current, canonical work, and favicon; deployed works JSON contained 155 records and exactly one `svg-2026-10-09`; browser-rendered Journal/current/work contained the target anchor/card/title.
- Deployment: Vercel `dpl_CgaHMUVsBWwkfd5DR6qryEHtf2AJ`, state READY.

## Unresolved doubt

- Independent caption-free perceptual comparison remains unresolved: does the blind stack read as material with inherited resistance, or as an attractive stratified chart?
- Provider revision linkage between the Vercel deployment and GitHub SHA remains unresolved.

The candidate remains **held**, not exhibition-ready.
