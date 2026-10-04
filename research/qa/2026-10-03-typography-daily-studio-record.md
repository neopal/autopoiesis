# Mutine daily studio record — 2026-10-03

## Scope and decision

- Target slot: Handwriting / `typography`, local date `2026-10-03`.
- Selected cultural reference: `p5-brush` — https://github.com/acamposuribe/p5.brush.
- The slot helper returned `current_id=typography`, `current_index=1/6`, `existing_work_id=none`, and `action=create-and-record`.
- One real candidate was produced and recorded as `typography-2026-10-03`; no duplicate current/date record exists.
- Status remains **candidate / held**. No commit, push, or production deployment was made because the full suite is not green and independent caption-free perceptual review plus production readback remain open.

## Concept and progression gate

- **Changed rule:** Replace v019's browser-native situated glyph channels and phoneme reply with one p5.js Canvas 2D typographic slab. A traveled pressure stroke changes actual glyph position, scale, height, and angle; inherited pressure resistance alters the next stroke.
- **Repeated gesture refused:** v017 shelf occupancy, v018 subtractive lock-up, and v019 situated phoneme/address channels all treated type as an arrangement of marks or slots. v020 changes medium, composition, viewer task, and memory model.
- **Visible consequence:** a compact `PRESSURE / MAKES / LANGUAGE` slab begins as 21 actual canvas glyphs; after a stroke, the letters themselves deform and later pressure responds through accumulated material resistance.
- **Falsifier:** if a drag only paints a line, if glyph geometry stays fixed, if a tap commits, or if the second stroke behaves like the first, the translation fails.
- **Deletion condition:** delete v020 if the blind field reads as a styled text poster, if pressure is only cosmetic, or if lifting does not restore the exact preceding slab.

## Cultural translation

- **Observed mechanism:** p5.brush treats pressure, density, grain, and directional fields as programmable material forces that change how geometry is produced and remembered.
- **Mutine translation:** refuse brush appearance and translate material pressure into language-as-geometry: a traveled stroke compresses touched glyphs and deposits resistance in one typographic slab, so later strokes are computed through changed material.
- **Anti-copy:** no p5.brush brushes, watercolor appearance, hatching vocabulary, palette, API surface, source examples, or composition were reproduced.
- **Direction consequence:** the recent distributed-letter/lock-up/shelf family is closed; a material syntax direction is opened in which handwriting is a pressure-bearing object.

## Files produced or updated for this run

- `studies/handwriting/v020/index.html`
- `studies/handwriting/v020/engine.mjs`
- `studies/handwriting/v020/sketch.js`
- `studies/handwriting/v020/style.css`
- `studies/handwriting/v020/README.md`
- `studies/handwriting/v020/metrics.json`
- `studies/handwriting/v020/critiques.json`
- `works/typography-2026-10-03/index.html`
- `scripts/handwriting-v020-probe.mjs`
- `tests/handwriting-v020.test.mjs`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/catalog-architecture.test.mjs`
- `tests/daily-catalog.test.mjs`
- `tests/evolution-catalog.test.mjs`
- `research/qa/proofs/handwriting-v020-2026-10-03/`

The local register contains exactly one `typography-2026-10-03` record. The regenerated public catalogue contains 121 works and includes the new record.

## Verification

- TDD RED observed first: `node --test tests/handwriting-v020.test.mjs` failed because the v020 engine/tableau/docs did not exist.
- Targeted v020 tests after implementation: **5 passed, 0 failed**.
- Catalog fixture updates for the new daily record: **21 passed, 0 failed** across the three catalog suites plus v020.
- Full suite: **607 total; 603 passed, 4 failed**. The four failures are pre-existing untracked `tests/webgpu-v019.test.mjs` expectations for missing `studies/webgpu/v019/` files and the missing `webgpu-2026-10-01` record; no WebGPU v019 files were created by this run.
- Headless browser matrix: **20/20 passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion, raw and canonical routes.
- Browser diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses across matrix and focused readbacks.
- Overflow: `innerWidth == clientWidth` and `scrollWidth <= innerWidth` across the matrix and focused Journal/current readbacks.
- Canonical tableau order: **10/10** canonical runs placed the v020 iframe before generated title, Journal, critique, evidence, and neighbour prose.
- Interaction evidence: tap `0→0` and refused; focused Enter `0→1` and committed; real drag `0→1` and committed; Delete `1→0` and lifted; release returned to `0`; control committed `0→1`.
- Touch targets: all three interaction buttons measured exactly `44px` high at `390×844`.
- Blind preview: canvas visible, readout/controls hidden, no overflow at `390×844`.
- PNG proofs: **24/24 non-empty captures**, minimum observed file size `65,593` bytes.
- `node --check`: passed for v020 engine, sketch, and probe.
- JSON validation: passed for `works.json`, `metrics.json`, `critiques.json`.
- Security scan of v020 study files, test, and probe: **0** secret/eval/exec/debug-pattern hits in the study/test scope.
- `git diff --check`: passed.

## Publication state

- Commit SHA: **none**.
- Remote SHA: **not verified**.
- Production URL: **not deployed or verified**.
- Push/deployment: **not performed** because the full suite remains blocked by the pre-existing WebGPU v019 test set.

## Accepted critique and unresolved doubt

The accepted structural critique is that pressure now acts on the letter geometry and is replayable, not painted as a cosmetic line; the browser evidence confirms the interaction state transitions and exact lift locally. The unresolved perceptual doubt is caption-free: whether the blind p5 canvas reads as one pressure-bearing typographic slab whose later response materially differs, rather than as a polished poster with an interaction attached. Production readback and provider revision linkage are also open.

**Candidate remains held.**
