# Mutine daily studio record — 2026-10-01

## Target

- Current: Typography / Handwriting (`typography`)
- Work: `typography-2026-10-01`
- Study: `studies/handwriting/v018/`
- Title: *The ink leaves a counter.*
- Status: **candidate / held**
- Canonical page: `/works/typography-2026-10-01/`
- Raw tableau: `/studies/handwriting/v018/`

## Artistic gate

### Repeated grammar refused

The last three Handwriting records were v015's attention/quorum field, v016's connected capillary route, and v017's additive HTML shelf setting. Their repeated gesture was a visible sentence-like field where visitor attention or pressure adds, reroutes, or occupies marks. v018 refuses another route, shelf, tile, tap, or continuous pressure path.

### Structural and perceptual rupture

v018 changes the composition to one oversized SVG typographic lock-up of five word bands. A sustained hold—not a tap, drag, or pointer position—crosses a material threshold. The event punches a counter-shaped aperture through one word via an SVG mask and shifts a later word's baseline, tracking, and x-position. The rupture is visible in representation, composition, encounter, and temporal memory before the explanation.

The blind falsifier is concrete: hide labels, readout, controls, captions, and furniture. Delete v018 if the aperture is only an overlay, if the downstream word stays fixed, if a short touch commits, or if the work reads as v017's shelf/grid refinement.

### Deterministic state

- Seed: `0x48574818`
- Stages: 13 (`0` through `12`)
- Typographic lines: 5
- Memory window: 5 hold-pressure events
- Hold threshold: `560ms`
- A short pointer touch is refused; a sustained hold commits
- Enter/Space and the pressure control commit the same deterministic event
- Delete/lift latest restores the exact preceding SVG signature
- `R`/release returns to stage `0` with zero memory

## Cultural translation

- Reference: `p5-brush` / [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: pressure, density, grain, and vector fields act as programmable material forces that change how geometry is produced and remembered.
- Mutine translation: invert v017's pressure setter. Sustained pressure becomes a threshold that removes a counter-shaped region from one word and reroutes the missing room into a later word's baseline and tracking.
- Visible consequence: a real SVG mask aperture is cut into the lock-up, and the downstream word visibly shifts rather than merely changing colour.
- Falsifier: if a short touch commits, if the aperture is only an overlay, if the downstream word stays fixed, or if the blind view reads as v017's shelf setting, the translation fails.
- Anti-copy: no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, or source composition is reproduced.
- Direction consequence: the Handwriting current closes the additive setting grammar and opens a subtractive, thresholded counter grammar.

## Files

- `studies/handwriting/v018/index.html`
- `studies/handwriting/v018/engine.mjs`
- `studies/handwriting/v018/sketch.js`
- `studies/handwriting/v018/style.css`
- `studies/handwriting/v018/README.md`
- `studies/handwriting/v018/metrics.json`
- `studies/handwriting/v018/critiques.json`
- `works/typography-2026-10-01/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `vercel.json`
- `tests/handwriting-v018.test.mjs`
- updated catalogue count/order tests
- `research/qa/proofs/typography-v018-2026-10-01/`

## Verification

- RED observed first: focused test failed because `studies/handwriting/v018/engine.mjs` did not exist.
- GREEN observed: focused v018 tests passed after each vertical slice.
- Focused v018/catalog tests: **25 passed, 0 failed**.
- Local headless browser matrix: **10/10 canonical + 10/10 raw** at `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced-motion modes.
- Local browser diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses.
- Local overflow: **0**; `innerWidth = clientWidth = scrollWidth` across the matrix and focused routes.
- Tableau order: **10/10** canonical runs mounted the SVG tableau before generated title and explanation.
- Interaction: short pointer touch unchanged; `660ms` hold changed memory `0→1`; Enter changed `1→2`; Delete changed `2→1` and restored the sustained signature; release returned memory to `0`.
- Blind preview: SVG remained visible while the interaction panel, caption, header, and annotations were hidden at `390×844`; reduced motion settled at stage `12/12` with five remembered apertures.
- Touch targets: all three raw controls measured `44px` high at `390×844`.
- Local Journal: exactly one `#journal-typography-2026-10-01` entry with title and canonical link.
- Local Handwriting current: exactly one latest `2026-10-01` artwork with no overflow.
- Proof bundle: `results.json`, `summary.json`, `probe.mjs`, `production-results.json`, `production-summary.json`, and 26 local plus 8 representative production PNG captures.
- Production deployment: Vercel deployment `dpl_48HHonCKBteUhCbxR8YMfnfjthTy` reached `READY` and aliased to `https://autopoiesis-nine.vercel.app`.
- Production headless browser matrix: **10/10 canonical + 10/10 raw** at `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced-motion modes.
- Production browser diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses; production overflow **0**.
- Production readback: `/studio/data/works.json` returned exactly one matching record; `/studio/data/catalog-public.json` returned exactly one public record; the canonical page and raw v018 URL returned HTTP 200; the rendered Journal contained exactly one `#journal-typography-2026-10-01` entry with the title and canonical link; the Handwriting current contained exactly one latest 2026-10-01 artwork.
- GitHub publication: local `HEAD` and `origin/main` both equal `ada2af7f4baeb5b7a893686836559eaa3a9d0407`.

## Evidence boundary

The deployed runtime, routes, catalog, Journal, current, responsive matrix, and interaction paths are now verified. The candidate remains **candidate / held** pending an independent caption-free perceptual comparison with labels, readout, controls, annotations, and prose hidden; provider-side linkage between the stable Vercel deployment and the GitHub revision is also not independently confirmed.
