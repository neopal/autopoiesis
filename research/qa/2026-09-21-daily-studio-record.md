# Daily studio record — 2026-09-21

## Target

- Current: **Brush** (`brush`)
- Date: **2026-09-21**
- Work: **`brush-2026-09-21`**
- Status: **candidate / held**
- Raw tableau: `/studies/p5-brush/v015/`
- Canonical page: `/works/brush-2026-09-21/`

This slot was absent before the run. One record was created; no current/date duplicate was present.

## Concept and structural delta

v015 is **The brush keeps a basin.** The changed rule is not a cosmetic palette mutation: a remembered removal becomes a basin. Neighbouring routes descend into the absence, share a finite floor, climb a far lip, and carry an altered aftershock downstream. Pointer, Enter, and Space add the same bounded basin memory; lifting the latest basin rebuilds the exact preceding field.

This is a materially new structural move relative to the last three Brush works:

- v014: pool → sideways spill → delayed shear (tide mark)
- v013: approach → finite gap → re-entry (dry seam)
- v012: bank → split → braid → settle (wake)
- v015: **descent → shared floor → far-lip climb → aftershock** (basin)

The engine exposes these as route coordinates and width/wet-load changes, not witness-only annotations. The independent caption-free perceptual gate remains unresolved, so the result stays held.

## Files

- `studies/p5-brush/v015/index.html`
- `studies/p5-brush/v015/sketch.js`
- `studies/p5-brush/v015/engine.mjs`
- `studies/p5-brush/v015/style.css`
- `studies/p5-brush/v015/README.md`
- `studies/p5-brush/v015/metrics.json`
- `studies/p5-brush/v015/critiques.json`
- `works/brush-2026-09-21/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/brush-v015.test.mjs`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/brush-v015-2026-09-21/`

The pre-existing untracked `research/qa/2026-09-18-daily-studio-record.md` was not modified or staged.

## Evidence

- TDD red observed first: `node --test tests/brush-v015.test.mjs` failed because v015 did not exist.
- Green targeted run: 5/5 v015 tests passed.
- Local headless browser run: `research/qa/proofs/brush-v015-2026-09-21/probe.mjs` completed with 10 canonical viewport runs, raw interaction, and static blind output.
- Canonical viewports: `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`; normal and reduced motion.
- Local browser evidence: all 10 canonical runs returned HTTP 200, tableau-first ordering, visible canvas, 44px controls, matching `innerWidth`/`clientWidth`/`scrollWidth`, and zero console/page/request/HTTP-400+ diagnostics.
- Interaction evidence: pointer `0→1`, Enter `1→2`, lift `2→1` with exact pointer-state canvas restoration, release `1→0`; raw canvas remained visible with no overflow.
- Static-blind evidence: reduced-motion preview kept the canvas visible while hiding controls, readout, witnesses, and notation.
- `npm run test`: **411 passed, 0 failed, 0 skipped, 0 todo**.
- `node --check studies/p5-brush/v015/sketch.js`: **PASS**.
- `node --check studies/p5-brush/v015/engine.mjs`: **PASS**.
- `node --check research/qa/proofs/brush-v015-2026-09-21/probe.mjs`: **PASS**.
- `git diff --check`: **PASS**.

## Unresolved gates

- Independent caption-free perceptual comparison with basin witnesses, labels, notation, and readout hidden.
- Production readback of `/studio/data/works.json`, `/journal/`, the canonical work, and the raw preview.
- Provider revision linking the stable production alias to the GitHub SHA.

The candidate remains **held**; the hold is honest and does not claim exhibition-ready perceptual success.
