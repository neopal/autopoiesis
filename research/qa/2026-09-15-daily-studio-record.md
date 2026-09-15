# Daily studio record — 2026-09-15

## Scope and decision

The scheduled Brush rotation was completed in `C:/Users/ASUS/autopoiesis`.
The active sources remain `studio/data/studio.json` (`mutine-studio/v2`) and
`studio/data/works.json` (`mutine-works/v1`). The run created exactly one new
Brush daily work for `2026-09-15`: `brush-2026-09-15`.

The work remains **candidate / held**, not exhibition-ready. The executable
v013 tableau, canonical work wrapper, deterministic engine measurement, local
browser matrix, and interaction readback are real. Production readback and an
independent caption-free perceptual comparison are still required before
promotion.

## Brush decision

- Work: `brush-2026-09-15` — “The brush keeps a dry seam.”
- Raw tableau: `/studies/p5-brush/v013/`
- Canonical page: `/works/brush-2026-09-15/`
- Journal anchor: `journal-brush-2026-09-15`
- Status: `candidate / held`
- Changed rule: a remembered removal becomes a structural dry seam. Neighboring
  routes approach both banks, disappear across a finite gap, and re-enter with
  a changed offset and quieter wet load.
- Falsifier: if the marks stay continuous through the absence, or if the gap is
  only a witness drawn over intact routes, the rule fails.
- Deletion condition: delete v013 if the approach → gap → re-entry grammar is
  not legible with witnesses, notation, labels, readout, and captions hidden.

The deterministic engine uses seed `0x42525533`, 17 stages, 16 strokes per
stage, 84 points per stroke, a primitive budget of 61, and a nine-seam memory
window. The measurement run recorded a visitor gap width of
`0.057209090909090904` and visitor re-entry shift of `0.036013649634993`.

## Automated verification

- `node --test tests/brush-v013.test.mjs`: **5/5 passed**.
- `node research/qa/proofs/brush-v013-2026-09-15/measure.mjs`: **PASS**.
- `node --check studies/p5-brush/v013/sketch.js`: **PASS**.
- `node --check research/qa/proofs/brush-v013-2026-09-15/probe.mjs`: **PASS**.
- `npm test`: **347/347 passed; 0 failed, 0 skipped, 0 todo**.
- `git diff --check`: **PASS**.
- Added-line security scan for secret assignment, shell injection, eval/exec,
  unsafe deserialization, and SQL-construction patterns: **no matches**.

## Local browser evidence

The headless Chromium probe ran against the canonical work wrapper and raw
preview at true emulated viewports `320x568`, `390x844`, `768x1024`, `1280x800`,
and `1920x1080`, each in normal and reduced-motion modes.

- **10/10 canonical runs passed**: HTTP 200, tableau iframe present before
  title/prose, canvas visible, no console messages, page errors, failed
  requests, or HTTP 400+ responses.
- `innerWidth == clientWidth == scrollWidth` at all ten canonical runs.
- All three raw interaction buttons measured at least 44px height at 390px.
- Pointer made one seam and paused; Enter made a second seam; lifting reduced
  memory and restored the exact preceding canvas data URL; release sequence
  returned to stage 01 with zero seams.
- Reduced-motion blind preview kept the canvas visible while hiding controls,
  readout, witnesses, and notation; no document overflow was observed.
- Evidence is recorded in
  `research/qa/proofs/brush-v013-2026-09-15/results.json`, `probe.mjs`, and
  the accompanying PNG captures.

## Publication boundary

The local run does not prove Vercel content or a provider revision. After the
verified commit is pushed and production deployment completes, the stable
production alias must be fetched separately for the public catalog JSON,
`/journal/`, and `/works/brush-2026-09-15/`. A fetched public URL proves
observed content; only an explicit provider/revision record can link that
content to a particular GitHub SHA.

## Unresolved doubt

No independent caption-free perceptual reviewer was available in this
unattended run. The work therefore stays **candidate / held** until a fresh
comparison confirms that the strokes themselves—not labels, witnesses, or
readout—make the repeated approach, finite dry gap, and changed re-entry
legible.
