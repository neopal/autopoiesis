# Mutine daily studio record — Self portrait v020 — 2026-10-04

## Slot

- Current: **Self portrait** (`portrait`)
- Date: **2026-10-04**
- Work: **The portrait makes room.**
- Canonical route: `/works/portrait-2026-10-04/`
- Status: **candidate / held**
- Study: `studies/self-portrait/v020/`
- Cultural reference selected by the slot helper: **p5.brush** — https://github.com/acamposuribe/p5.brush

## Creative record

### Hypothesis

Code can portray its own decisions by making material resistance select the next visible break. The visitor supplies pressure but cannot choose a witness or fracture location.

### Changed rule

A measured canvas or Space hold loads the whole relief. Releasing beyond the threshold makes the lowest-resistance rib yield, opens a real geometric gap, and redistributes load through neighbouring ribs. Bounded resistance changes the next selected rib. `Delete` reconstructs the exact preceding relief; `R` releases the load.

### Radical progression

The last three portrait works (v017 aperture, v018 serial pressure register, v019 syntax seal) repeatedly let attention act on a selected part and receive a local or remote geometric answer. v020 breaks that invariant in three visible dimensions:

- representation: one oblique Canvas material relief instead of blades, strands, or clauses;
- encounter: measured hold/release instead of selection, keyboard attention, or proximity-then-gaze;
- temporal model: whole-object load chooses the next fracture instead of refusal, cut, or clause debt.

### Cultural translation

- **Observed mechanism:** p5.brush treats pressure, density, grain, and fields as programmable material forces; material changes how geometry is produced and remembered rather than decorating finished geometry.
- **Mutine translation:** refuse brush surface vocabulary; make pressure a whole-object load in the portrait relief. Release crosses a threshold, the lowest-resistance rib yields into a true gap, neighbouring ribs inherit shear, and that remembered load changes the next fracture.
- **Visible consequence:** the blind view is one oblique layered relief. After a hold/release, one rib is physically split and the surrounding ribs shear under transferred load.
- **Falsifier:** a glow/counter/overlay event, a fixed yielding rib, a committing short tap, or unchanged neighbours would falsify the translation.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, examples, or source composition are reproduced.
- **Direction consequence:** closes the selected-witness/syntax family and opens material agency for Self portrait.

## Files

- `studies/self-portrait/v020/index.html`
- `studies/self-portrait/v020/sketch.js`
- `studies/self-portrait/v020/engine.mjs`
- `studies/self-portrait/v020/style.css`
- `studies/self-portrait/v020/README.md`
- `studies/self-portrait/v020/metrics.json`
- `studies/self-portrait/v020/critiques.json`
- `works/portrait-2026-10-04/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/portrait-v020.test.mjs`
- `scripts/portrait-v020-probe.mjs`
- `research/qa/proofs/portrait-v020-2026-10-04/`

## Verification

- Slot helper: `current_id=portrait`, `current_index=2/6`, `culture_reference_id=p5-brush`, `existing_work_id=none`.
- Targeted v020 tests: **4 passed, 0 failed**.
- Catalog/deployment targeted tests: **9 passed, 0 failed**.
- Browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`, raw/canonical, normal/reduced motion.
- Canonical tableau-first: **10/10** local canonical runs.
- Local overflow: `innerWidth = clientWidth = scrollWidth` in all 20 matrix runs; focused Journal/current readbacks also matched at `390×844`.
- Touch controls: **44px minimum** for all three buttons.
- Diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses across matrix, interaction, blind, Journal, and current readbacks.
- Interaction evidence:
  - short pointer tap: memory `0→0`, `pointer-tap-refused`;
  - 720ms pointer hold plus travel: memory `0→1`, one real gap, changed signature;
  - held Space: memory `0→1`;
  - Delete: memory `1→0`, exact preceding signature restored;
  - `R`: memory `0` baseline restored;
  - press control: memory `0→1`;
  - all three controls: `44px` high.
- Blind preview at `390×844`: Canvas visible; readout, controls, annotations hidden; no overflow.
- Evidence: **24/24 non-empty PNG captures** in `research/qa/proofs/portrait-v020-2026-10-04/`.
- JavaScript syntax: passed for `engine.mjs`, `sketch.js`, and `portrait-v020-probe.mjs`.
- Security-pattern scan on the run's changed paths: **0 hits**.
- `git diff --check`: passed.

## Publication blocker

The full suite remains **632 passed, 4 failed, 636 total**. The four failures are unchanged, pre-existing WebGPU v019 expectations for missing:

- `studies/webgpu/v019/`
- `works/webgpu-2026-10-01`

No v019 files were changed. Following the release gate, this run performs **no commit, push, deployment, or production readback**.

- Commit SHA: **none**
- Remote SHA: **not checked**
- Production URL/readback: **not verified**

## Critique and decision

The structural and local browser gates pass. The unresolved doubt remains caption-free perceptual: whether the blind relief reads as one self-deciding material object, rather than a polished stack of strips. The candidate remains **held** until that comparison and production verification are observed.
