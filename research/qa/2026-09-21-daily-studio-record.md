# Daily studio record — 2026-09-21

## Target

- Current: **Brush** (`brush`)
- Date: **2026-09-21**
- Work: **`brush-2026-09-21`**
- Status: **candidate / held**
- Raw tableau: `/studies/p5-brush/v015/`
- Canonical page: `/works/brush-2026-09-21/`

The current catalogue contains one `2026-09-21` record for this slot; this unattended archive audit did not create or mutate any catalogue, artwork, or source record. No current/date duplicate was present.

## Unattended archive audit — 2026-09-21

The audit ran from `C:/Users/ASUS/autopoiesis` at `2026-09-21 12:55:48 +0200`. It used only `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`) as active catalogue sources. Field tests remained separate from daily works.

### Today's coverage

| Current | Register state | 2026-09-21 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | held / no record | — |
| Self portrait (`portrait`) | active | held / no record | — |
| Pure SVG (`svg`) | active | held / no record | — |
| Brush (`brush`) | active | recorded / candidate-held | `brush-2026-09-21` |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | held / no record | — |

The register contains 79 work records: Handwriting 14, Self portrait 13, Pure SVG 12, Brush 15, Naive art 13, and WebGPU 12. There are no duplicate current/date slots and no unknown current IDs.

### Register and filesystem integrity

- Canonical pages: **79/79 present** at `works/<workId>/index.html`.
- Raw tableau indexes: **79/79 present** under each registered `/studies/.../` path.
- Journal anchor shape: **79/79 use `journal-<workId>`**.
- Canonical Journal links: **79/79 contain `/journal/#journal-<workId>`**.
- Critique gate: **79/79 have at least one critique**; no no-critique fallback was needed.
- Field-test IDs (`disobedient-writing`, `subtractive-ecology`) were not treated as daily work records.

### Schema anomaly and lifecycle gate

The lifecycle gate is held globally because seven legacy records have no `lifecycle` field: `typography-2026-08-28`, `brush-2026-08-28`, `typography-2026-08-31`, `svg-2026-08-31`, `portrait-2026-08-31`, `naive-2026-08-31`, and `brush-2026-08-31`. The register has 72 `active`, 0 `complete`, and 7 missing/other lifecycle values. The audit did not infer a lifecycle for the affected records.

No records are marked `complete` in either the working register or `HEAD`, so the complete-work immutability check is vacuous. The initial working tree had only the pre-existing untracked `research/qa/2026-09-18-daily-studio-record.md`; no tracked catalogue, artwork, or JavaScript files were changed by this audit.

### Automated checks and visual boundary

- `npm run test`: **411 passed, 0 failed, 0 skipped, 0 todo**.
- Changed JavaScript syntax: **not applicable**; there were no changed `.js`, `.mjs`, or `.cjs` files.
- `git diff --check`: **PASS**.
- No browser automation, GUI/CUA, Chrome, DevTools, CDP, remote debugging, or window launch was performed.

The `brush-2026-09-21` record remains **candidate / held**. Its stored browser-evidence fields report local/production checks, but the record still lists independent caption-free perceptual review and provider-revision verification as unresolved. Those visual and deployment gates were not independently re-run by this unattended audit.

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
- `research/qa/proofs/brush-v015-2026-09-21/production/` captured the deployed production matrix and readback.
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

## Resolved gates

- Production readback: `https://autopoiesis-nine.vercel.app/studio/data/works.json` returned HTTP 200 with exactly one `brush-2026-09-21` record, title, raw path, and `journal-brush-2026-09-21`; `/journal/` rendered the title and canonical work link; the canonical page returned HTTP 200 with the tableau iframe before its heading; the raw preview returned HTTP 200 and `lift latest` changed memory from 8 to 7; favicon returned HTTP 200 (`image/svg+xml`). All production probes recorded zero console, page, request-failure, and bad-response diagnostics.

## Unresolved gates

- Independent caption-free perceptual comparison with basin witnesses, labels, notation, and readout hidden.
- Provider revision linking the stable production alias to the GitHub SHA is not independently exposed by the deployed site/CLI evidence.
The candidate remains **held**; the hold is honest and does not claim exhibition-ready perceptual success.
