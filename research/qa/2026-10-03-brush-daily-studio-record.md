# Mutine daily studio record — Brush v023

- **Target:** Brush (`brush`)
- **Date:** `2026-10-03`
- **Work:** *The paint turns from the witness.*
- **Status:** **candidate / held**

## Creative direction

v023 breaks Brush v020's suspended pulse, v021's dragged absence, and v022's held coagulation. The first encounter is one connected inline-SVG paint body made from seven broad stations joined by wet seams. It is not a pressure field, grain population, coil, or sampled noise surface.

The viewer task changes from painting to reciprocal witnessing: proximity arms one station without writing; leaving the field commits a turn-away. The addressed station opens an actual path notch, changes orientation, and bends later stations through inherited seam load. Repeating the same station is refused. Delete/lift rebuilds the exact preceding body.

This is a representation, encounter, and temporal-memory rupture: browser-native SVG replaces recent Canvas/WebGL fields; approach-and-depart replaces pulse/drag/hold; refusal memory changes actual station paths and downstream seams.

## Cultural translation

- **Reference:** [little-critters](https://github.com/GordenSun/little-critters)
- **Observed mechanism:** situated code-drawn agents respond to pointer proximity by changing attention and looking back, making the visitor part of a reciprocal encounter rather than a controller of a dashboard.
- **Mutine translation:** refuse animals, faces, paper scene, and look-back surface. Proximity arms one abstract paint station; only departure commits a turn-away that opens a real SVG notch and bends the later seam.
- **Visible consequence:** proximity alone leaves memory at `0`; departure changes the station silhouette and later seam coordinates; repeated attention to the same station is refused.
- **Falsifier:** if proximity commits, if departure changes only a colour/marker, if the notch is an overlay, if later seam coordinates stay fixed, or if the blind body reads as seven decorative blobs, the translation fails.
- **Anti-copy:** no animals, characters, eyes, paper style, head-turning scene, source palette, source composition, code, API surface, or surface vocabulary is reproduced.
- **Direction consequence:** closes Brush's pressure/absence/coagulation family and opens reciprocal material refusal: paint is altered by the visitor's departure, not by a stroke.

## Files

- `studies/p5-brush/v023/index.html`
- `studies/p5-brush/v023/engine.mjs`
- `studies/p5-brush/v023/sketch.js`
- `studies/p5-brush/v023/style.css`
- `studies/p5-brush/v023/README.md`
- `studies/p5-brush/v023/metrics.json`
- `studies/p5-brush/v023/critiques.json`
- `works/brush-2026-10-03/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/p5-brush-v023.test.mjs`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `scripts/p5-brush-v023-probe.mjs`
- `research/qa/proofs/brush-v023-2026-10-03/`

The local and public catalogues contain exactly one `brush-2026-10-03` record and **124 total works**.

## Verification

- **TDD RED:** the new v023 test first failed with the expected missing-module/missing-tableau errors; engine implementation then made the first two behavior tests pass before the browser files and registration were added.
- **Targeted tests:** **25 passed, 0 failed** (v023 engine/tableau/record, catalogue, and public-catalogue checks).
- **Headless Chrome matrix:** **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- **Diagnostics:** `0` console messages, page errors, failed requests, or HTTP 400+ responses across the matrix and focused interaction/blind/Journal/current readbacks.
- **Interaction evidence:** pointer tap kept memory `0`; proximity armed station `2` with memory `0`; leaving committed memory `0→1` and changed the SVG signature; Delete restored memory `1→0` and the exact prior signature; R restored the stage-00 baseline; Enter committed memory `0→1`; watch control committed `1→2`.
- **Geometry evidence:** normal state rendered `7` stations; reduced-motion settled at stage `14` with `4` bounded departures and `6` wet seams; blind preview retained `7` paint paths and `6` seams while hiding readout, controls, labels, and station marks.
- **Responsive evidence:** `scrollWidth === clientWidth === 390` in the blind probe; all three controls measured exactly `44px` high at `390×844`; tableau-first canonical ordering passed.
- **Captures:** `24` non-empty PNG captures written under `research/qa/proofs/brush-v023-2026-10-03/`.
- **Static checks:** `node --check` passed for engine, sketch, and probe; JSON validation passed for works/public catalogue/metrics/critiques; `git diff --check` passed (only Git's LF→CRLF working-copy warnings appeared).

## Publication blocker

The full suite is **615 passed, 4 failed out of 619**. All four failures are pre-existing untracked WebGPU v019 expectations in `tests/webgpu-v019.test.mjs` for missing:

- `studies/webgpu/v019/`
- `webgpu-2026-10-01`

No WebGPU v019 files were changed. Per the release gate, commit, push, and production deployment were not performed.

- **Commit SHA:** none
- **Remote SHA:** not checked
- **Production URL:** not verified
- **Intended canonical route:** `/works/brush-2026-10-03/`
- **Production Journal/work verification:** not performed

## Unresolved doubt

The causal and responsive evidence is strong, but independent caption-free perceptual review remains open: whether the blind body reads as one material paint body that turns from a witness, rather than as seven coloured blobs connected by decorative seams. This is especially important because the new SVG medium deliberately exposes station structure.

**Candidate remains held.**

MEDIA:C:/Users/ASUS/autopoiesis/research/qa/proofs/brush-v023-2026-10-03/brush-v023-blind-390x844.png
