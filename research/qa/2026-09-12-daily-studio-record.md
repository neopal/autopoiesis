# Daily studio record — 2026-09-12

## Scope and decision

Run completed in `C:/Users/ASUS/autopoiesis` for the scheduled Pure SVG slot.
Target current: **Pure SVG (`svg`)**. Target date: **2026-09-12**.

A real v009 tableau was created at `studies/pure-svg/v009/`, a canonical
navigable record was created at `works/svg-2026-09-12/`, and exactly one
`svg / 2026-09-12` entry was added to `studio/data/works.json`.
The record remains **candidate / held**: structural and local browser gates
passed, but independent caption-free perceptual review and production
readback are not yet complete. No work was promoted to complete or called
exhibition-ready.

## Creative gate

- **Hypothesis:** a refusal can become a pocket inside an animal instead of travelling outward as a message.
- **Changed rule:** each remembered refusal stores a contour anchor and a later seam. Between them, the contour folds through a negative-space opening; downstream legs inherit an inside/outside choice around that seam.
- **Visible consequence:** the body contains an even-odd cut-out pocket and the later gait changes with it. Fold circles, seam threads, labels, and readout are witnesses only.
- **Deterministic state:** seed `0x53564739`; 12 stages; primitive budget 18; memory capped at four folds; bounded pointer input `x: 0.06..0.94`, `y: 0.16..0.84`.
- **Falsifier:** hide fold points, seam threads, labels, and readout. If the opening does not read as a bodily interruption and the feet do not retain the inside/outside consequence, the direction fails.
- **Deletion condition:** delete v009 if unfolding the latest fold leaves downstream contour or route coordinates unchanged, or if the animal reads as a stable body with a decorative cut-out.
- **Lineage:** `pure-svg-v008` → `v009`.

## Today's coverage

| Current | 2026-09-12 record | Result |
|---|---|---|
| Handwriting (`typography`) | `typography-2026-09-12` | pre-existing real record; candidate / held |
| Self portrait (`portrait`) | `portrait-2026-09-12` | pre-existing real record; candidate / held |
| Pure SVG (`svg`) | `svg-2026-09-12` | created this run; candidate / held |
| Brush (`brush`) | none | slot remains held; no invented tableau |
| Naive art (`naive`) | none | slot remains held; no invented tableau |
| WebGPU (`webgpu`) | none | dormant slot remains held; no invented tableau |

No current/date duplicate was found after registration. The register contains
**48** daily records after this run.

## Implementation evidence

- Raw tableau: `studies/pure-svg/v009/index.html`
- Engine: `studies/pure-svg/v009/engine.mjs`
- Runtime: `studies/pure-svg/v009/sketch.js`
- Style: `studies/pure-svg/v009/style.css`
- Supporting record: `studies/pure-svg/v009/README.md`
- Metrics: `studies/pure-svg/v009/metrics.json`
- Critiques: `studies/pure-svg/v009/critiques.json`
- Canonical work: `works/svg-2026-09-12/index.html`
- Register: `studio/data/works.json`

Measured settled structural state: zero-based stage `10` (user-facing stage
11 / 12), four remembered folds, latest anchor index `5`, seam index `10`,
pocket depth `0.09799999999999999`, pocket width `0.076`, three folded routes,
two inside routes, one outside route, contour delta against latest-unlinked
frame `0.4177011193607442`, and gait delta `1.9539783001759623`.

## Test-first record

1. Wrote `tests/pure-svg-v009.test.mjs` for the fold/pocket engine before
   creating v009 production files; the first run failed with the expected
   `ERR_MODULE_NOT_FOUND` for `v009/engine.mjs`.
2. Implemented the deterministic engine; the two structural tests passed.
3. Added the browser-contract assertions before v009 HTML/runtime/style
   existed; the run failed with the expected missing `v009/index.html`.
4. Added the tableau, runtime, and style; the browser-contract slice passed.
5. Added the daily-register assertion before the record existed; the run
   failed with zero matching `svg / 2026-09-12` records.
6. Added the canonical page and register entry; the targeted v009 suite passed.
7. Updated three existing count/order snapshots for the legitimate 48th
   daily record; the complete suite passed.

## Automated evidence

- `node --test tests/pure-svg-v009.test.mjs`: **4/4 passed**.
- `npm run test`: **257/257 passed; 0 failed, 0 skipped, 0 todo**.
- `node --check studies/pure-svg/v009/engine.mjs`: passed.
- `node --check studies/pure-svg/v009/sketch.js`: passed.
- `node --check research/qa/proofs/svg-v009-2026-09-12/probe.mjs`: passed.
- `node --check tests/pure-svg-v009.test.mjs`: passed.
- `git diff --check`: passed.

## Local headless browser evidence

Probe: `research/qa/proofs/svg-v009-2026-09-12/probe.mjs`.
Result: `results.json`, **passed**, zero recorded failures.

- Canonical route rendered the v009 tableau iframe before generated title,
  Journal, critique, evidence, and neighbouring-work prose at all five target
  viewports in normal and reduced-motion modes: **10/10**.
- At every canonical run, target width equaled `innerWidth` and
  `clientWidth`; top-level and embedded `scrollWidth` stayed contained.
- All three embedded controls met the 44 CSS px touch target; raw 390x844
  controls measured exactly 44 px.
- Canonical, raw interactive, and static blind runs reported empty console,
  page-error, request-failure, and HTTP 400+ arrays.
- Raw interactive preview: pointer changed memory `0 → 1`; Enter on the
  focused SVG changed it `1 → 2`; `unfold latest` returned `2 → 1`; `release
  the body` returned `1 → 0` and resumed the sequence.
- Reduced-motion static blind preview at 390x844 kept the SVG visible while
  hiding controls, readout, labels, witness marks, threads, and seam; no
  overflow was observed.
- Evidence includes **13 PNG captures** plus probe and result JSON.

## Remaining gates and archive decision

The independent caption-free perceptual comparison is unresolved. It must
confirm, with witness marks and explanatory furniture hidden, that the pocket
reads as a bodily fold and that inside/outside gait consequences remain
visible. Delete v009 if that falsifier fails.

The seven pre-existing legacy records without an explicit `lifecycle` remain
unresolved and were not inferred or mutated:
`typography-2026-08-28`, `brush-2026-08-28`, `typography-2026-08-31`,
`svg-2026-08-31`, `portrait-2026-08-31`, `naive-2026-08-31`, and
`brush-2026-08-31`.

Stable-alias readback is now observed at `https://autopoiesis-nine.vercel.app`:
HTTP 200 JSON contains the single SVG record, the canonical work renders the
v009 tableau first, the Journal renders one SVG anchor/title, and the raw
preview passes the 390x844 pointer/keyboard/unfold/release sequence with empty
browser issue arrays. Both Vercel CLI paths were blocked (`scope-not-accessible`
and `no-credentials-found`), so no deployment URL or provider-revision linkage
is claimed.

Keep `svg-2026-09-12` as an honest **candidate / held** record. Keep the
other empty slots visibly held. The independent caption-free perceptual
comparison remains the unresolved artistic gate.
