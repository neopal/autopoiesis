# Mutine daily studio record — 2026-10-03 / Pure SVG v021

## Slot

- **Current:** Pure SVG (`svg`)
- **Work id:** `svg-2026-10-03`
- **Title:** *The ribbon keeps the pressure.*
- **Status:** candidate / held
- **Raw tableau:** `/studies/pure-svg/v021/`
- **Canonical work:** `/works/svg-2026-10-03/`
- **Lineage:** `svg-2026-10-02`

## Artist hypothesis and rupture

If pressure changes the silhouette-producing material of one SVG ribbon, rather than decorating a finished path, a minimal primitive can remember force without becoming a contour, plate field, or diagram.

The last three Pure SVG records repeated a local/remote topology gesture: v018 transferred a negative cut between disjoint plates, v019 changed the front/back order of a radial pressure valve, and v020 bent one compound contour while opening a displaced negative pocket. v021 breaks that family on four visible axes:

- **Representation:** disjoint plates / radial stack / closed compound contour → one broad filled SVG ribbon rebuilt from seven pressure stations.
- **Viewer task:** situated attention, global pressure, or clause selection → a traveled drag whose distance is required for commitment.
- **Shape vocabulary:** negative rooms and occlusion → width, centerline kink, pinch, and swelling silhouette.
- **Temporal rule:** displaced topology or paint order → inherited material resistance; the next pressure starts from changed widths.

A traveled pressure pinches the source station and swells a non-adjacent binder in the actual generated ribbon polygon. A short tap does not write. Three pressure events are replayable; lifting the latest rebuilds the exact preceding signature.

**Falsifier:** if dragging only paints a cursor trail, if the source pinch or remote binder is a color badge rather than changed ribbon geometry, if a tap commits, if later pressure ignores inherited width, or if the relation requires the caption, the translation fails.

**Deletion condition:** delete v021 rather than polish it if the blind image cannot be distinguished from a decorative stroke, if the remote binder is not legible in the silhouette, or if latest-pressure lifting fails to restore the exact signature.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** natural drawing tools treat pressure, density, grain, and directional fields as programmable material forces; material changes how geometry is produced and remembered rather than decorating finished geometry.
- **Mutine rule:** refuse p5.brush's brush surface, watercolor appearance, hatching, and API. Translate material agency into one SVG ribbon whose width and centerline are regenerated from pressure stations. Force narrows its entry station, binds a distant station, and becomes inherited resistance for the next pressure.
- **Visible consequence:** one broad filled ribbon changes its actual silhouette at two separated stations after a traveled gesture; the next event starts from that altered material rather than from a reset path.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, source examples, or composition are reproduced.
- **Direction consequence:** closes Pure SVG v018's plate topology, v019's radial occlusion, and v020's compound contour; opens a material-agency direction in which one SVG primitive has inherited width and resistance.

## Critique

- **Material critic:** the rule lives in the ribbon path; source width, source centerline, and remote binder geometry must change.
- **Perceptual critic:** labels, readout, controls, annotations, and prose must not be needed to read one pressure-bearing ribbon or find its changed silhouette.
- **Interaction critic:** a short tap must be refused; a real traveled drag, the press control, Enter, and Space must commit; Delete restores; R releases.
- **Radical progression critic:** the filled-ribbon medium switch, traveled-pressure task, and inherited width memory must be visible in code, interaction, and render, not only in the caption.
- **Cynic:** delete if the work is a styled line with a material claim attached, if the remote binder is only color, or if the second pressure behaves like the first.

## Files

- `studies/pure-svg/v021/index.html`
- `studies/pure-svg/v021/engine.mjs`
- `studies/pure-svg/v021/sketch.js`
- `studies/pure-svg/v021/style.css`
- `studies/pure-svg/v021/README.md`
- `studies/pure-svg/v021/metrics.json`
- `works/svg-2026-10-03/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/pure-svg-v021.test.mjs`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `scripts/pure-svg-v021-probe.mjs`
- `research/qa/proofs/pure-svg-v021-2026-10-03/results.json`
- `research/qa/proofs/pure-svg-v021-2026-10-03/` — local PNG captures

## Verification

- TDD RED observed: `tests/pure-svg-v021.test.mjs` first failed because `studies/pure-svg/v021/engine.mjs` was missing; the next surface test failed because the v021 tableau files were missing; the registration test failed because the daily record and canonical page were missing.
- Targeted v021 + catalogue slice: **20 passed, 0 failed**.
- Full `npm test`: **615 total; 611 passed, 4 failed**. The four failures are pre-existing untracked `tests/webgpu-v019.test.mjs` expectations for missing `studies/webgpu/v019/` and `webgpu-2026-10-01`; the v021 and catalogue regressions pass.
- Headless Chrome local matrix: **20/20 raw/canonical runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Browser diagnostics: **0 console messages, page errors, failed requests, or HTTP 400+ responses** across the matrix and focused interaction/blind/Journal/current readbacks.
- Pointer tap preserved memory `0`; focused Enter created one material crease; Delete restored memory `0` and the exact preceding signature; R returned to the quiet ribbon; a real pointer drag across 210 CSS pixels created one material crease.
- Blind preview kept one SVG ribbon and three actual settled crease events visible while hiding controls, readout, labels, station marks, and furniture; `scrollWidth` matched `innerWidth` at `390×844`.
- The three interaction buttons measured **44px high** at `390×844`.
- Local Journal and Pure SVG current readbacks rendered the new record at `390×844` with no overflow.
- `node --check` passed for `engine.mjs`, `sketch.js`, and the probe; JSON validation passed; `git diff --check` passed.

## Publication state

- Local artifact, local register, public catalogue, and QA evidence are recorded.
- Production verification, commit, push, and Vercel deployment were **not performed** because the full suite remains red on the unrelated pre-existing untracked WebGPU v019 work (`tests/webgpu-v019.test.mjs` expects missing `studies/webgpu/v019/` and `webgpu-2026-10-01` files).
- Candidate remains **held** pending the WebGPU test blocker, production readback, independent caption-free perceptual review, and provider revision linkage.
