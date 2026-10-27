# MUTINE daily studio record — Naive art v037

- **Target:** Naive art / `naive` / `2026-10-27`.
- **Version:** `v037`.
- **Title:** *The mistake cures the wrong edge.*
- **Status:** **candidate / held**.
- **Canonical route:** `/works/naive-2026-10-27/`.
- **Raw tableau:** `/studies/naive-art/v037/?preview=1&interaction=1`.
- **Journal anchor:** `journal-naive-2026-10-27`.

## Concept and progression

The last three Naive works repeated a model error as a spatial misreading: v036's false pagination, v035's remote pressure plate, and v034's faceted false reconstruction. v037 makes a material and encounter rupture: the work is a p5.js Canvas 2D print of thirteen uneven stamps, and the visitor closes a relation by tapping three distinct marks. The first two offers remain geometry-neutral. The third causes the print to misallocate pressure away from the chosen trio: an unchosen stamp becomes a false imprint, another collapses into a vacancy, and a third keeps a pressure ridge. This changes representation, composition, interaction, temporal memory, and medium rather than only changing surface parameters.

## Cultural translation

- **Reference:** `p5-brush` — https://github.com/acamposuribe/p5.brush.
- **Observed mechanism:** pressure, density, directional behaviour, and fields participate in producing geometry rather than styling a completed mark.
- **Mutine rule:** pressure becomes a three-mark relation; closure refuses to preserve the offered chord and hardens a wrong allocation into remote raster geometry.
- **Visible consequence:** chosen stamps lose ink while unchosen stamps swell, collapse, and ridge; four errors remain liftable and later chords inherit them.
- **Falsifier:** delete if a single tap commits, the selected trio answers directly, remote roles are cosmetic, later chords reset, or exact lifting fails.
- **Anti-copy:** no brush presets, watercolor appearance, hatching, grain, source palette, composition, code, examples, API surface, or source mark vocabulary is reproduced.
- **Direction consequence:** Naive art closes the page / plate / relief sequence and opens `pressure-misprint` as a discrete wrong-material-allocation grammar.

## Files

- `studies/naive-art/v037/` — executable p5.js tableau, pure engine, README, metrics, critiques.
- `works/naive-2026-10-27/index.html` — canonical tableau-first work shell.
- `studio/data/works.json` — one daily record.
- `studio/data/catalog-public.json` — regenerated public register.
- `tests/naive-art-v037.test.mjs` — TDD engine/tableau/register slice.
- `tests/daily-catalog.test.mjs` — expected daily register updated for the real slot.
- `scripts/naive-art-v037-probe.mjs` — headless browser QA runner.
- `research/qa/proofs/naive-art-v037-2026-10-27/` — local screenshots and `qa-summary.json`.

## Local verification

- TDD RED observed first: the targeted test failed with the expected missing `v037/engine.mjs` and tableau paths.
- Targeted tests: **3/3 passed**.
- Full repository suite: **1120/1120 passed**.
- JavaScript syntax checks: passed for engine, sketch, probe, and test.
- JSON parsing: passed for works, metrics, and critiques.
- `git diff --check`: passed.
- Local headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, normal and reduced motion, raw and canonical routes.
- Local diagnostics: **0**; overflow failures: **0**; minimum button target: **44px**.
- Interaction evidence: first two pointer taps stayed geometry-neutral; third tap committed a remote false imprint/vacancy/ridge event; Delete restored the exact baseline; Enter committed; Escape released; the control path committed.
- Blind evidence: 13 stamps and four settled pressure misprints remained visible with readout, controls, hint, and pending marks hidden; `innerWidth/clientWidth/scrollWidth = 390/390/390`.
- Local Journal anchor/title, canonical route, raw tableau, works JSON, public catalogue, and favicon read back successfully.

## Open doubt

Production verification, independent caption-free perceptual review, and provider revision linkage remain open. The candidate is **not exhibition-ready** and remains held.
