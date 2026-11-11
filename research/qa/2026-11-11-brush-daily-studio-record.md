# Mutine daily studio record — 2026-11-11

## Scope and audit time

- Target slot: **Brush / `brush` / `2026-11-11`**.
- Slot helper: `current_index=4/6`, `existing_work_id=none`, `action=create-and-record`, `culture_reference_id=p5-brush`.
- Active catalogue sources read and parsed: `studio/data/studio.json`, `studio/data/works.json`, and `studio/data/cultural-field.json`.
- No historical date was invented; no duplicate current/date record was created.
- Existing unrelated worktree edits were left untouched.

## Work and direction change

- **Work:** `brush-2026-11-11`
- **Version:** `v054`
- **Title:** *The pigment changes hands.*
- **Status:** `candidate / held`
- **Raw tableau:** `/studies/p5-brush/v054/`
- **Canonical work:** `/works/brush-2026-11-11/`

### Changed rule

Pressure is inert when it is local, straight, weak, or returned to the same seam. A bent relay between two different outer seams re-produces all nine detached SVG deposits and stores the transfer as ordered memory. The hand path disappears; the material relation remains distributed.

### Radical progression gate

The last three Brush records repeated a material-body grammar: v051's radial phase ring, v052's planar vacancy register, and v053's continuous drying membrane. v054 makes a deliberate structural rupture in four dimensions:

- **Representation/medium:** Canvas 2D bodies become generated inline SVG paths and DOM pointer events.
- **Composition:** one enclosing body becomes nine detached deposits arranged around a large unoccupied middle.
- **Encounter:** phase timing, select-and-cut, and edge-to-edge settling become a bent two-seam relay.
- **Memory:** local, subtractive, and drying bias become ordered transfer memory that remakes every detached piece.

The interaction and the visible consequence are coupled: one accepted relay changes all nine deposits, not only the produced seam.

## Cultural translation

- **Reference:** [p5.brush](https://github.com/acamposuribe/p5.brush)
- **Observed mechanism:** programmable pressure, density, direction, fills, and vector fields change how geometry is produced rather than decorating a finished mark.
- **Mutine translation:** refuse brush presets and visible brush simulation; make a bent two-seam pressure relay transfer the production rule through every detached deposit.
- **Visible consequence:** the blind view is nine separate SVG pigment deposits in a broken field; a valid relay moves, tilts, and re-scales all nine pieces and adds a produced seam.
- **Falsifier:** a same-seam, weak, or straight gesture commits; only the relay line/readout changes; any deposit stays fixed; order is cosmetic; or lifting is inexact.
- **Anti-copy:** no p5.brush preset, watercolor appearance, hatching vocabulary, grain treatment, source palette, composition, source code, examples, API names, or imagery is reproduced.
- **Direction consequence:** Brush leaves the radial-body, vacancy-register, and continuous-skin sequence and opens detached material: matter can answer through pieces that never shared one surface.

## Local evidence

- TDD targeted slice: **6/6 passed**. The first run failed as expected with `ERR_MODULE_NOT_FOUND` before `v054/engine.mjs` existed; later vertical slices observed red failures for missing exports/tableau files before their minimal implementations.
- Full suite: **1566/1566 passed** via `npm run test`.
- JavaScript syntax checks: `node --check` passed for `studies/p5-brush/v054/engine.mjs`, `studies/p5-brush/v054/sketch.js`, and `scripts/brush-v054-probe.mjs`.
- `git diff --check`: passed.
- Local browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses in the matrix.
- Overflow: **0** failures; target widths were valid; minimum touch target was **44 CSS px**.
- Interaction: real pointer relay with a bend changed all nine deposits; straight west-to-east drag refused; two button relays compounded; Delete restored the exact prior signature; Escape released; ArrowRight + Enter committed an equivalent keyboard relay; touch button relay committed one transfer.
- Blind preview: reduced-motion static preview retained four relay memories, nine SVG deposits, and four produced relay curves while hiding readout, controls, selection, hint, caption, and editorial furniture; `innerWidth/clientWidth/scrollWidth` remained `390/390/390`.
- Readbacks: local source and public catalog each contained exactly one `brush-2026-11-11` record; rendered Journal, Brush current, canonical work, raw v054 tableau, and favicon returned HTTP 200.
- Proofs: `research/qa/proofs/brush-v054-2026-11-11-local/`.

## Production evidence

- Deployment: **READY** at `https://autopoiesis-nine.vercel.app`.
- Deployment URL: `https://autopoiesis-4frb5bjp9-lairpa-hotmailfrs-projects.vercel.app`.
- Deployment ID: `dpl_8RP8cbtqdm8CWERnwzsHsGrK9aEB`.
- Stable-alias browser matrix: **20/20 passed** across the same five viewports and two motion modes.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP 400+ responses; overflow failures: **0**.
- Production readbacks: stable alias returned HTTP 200 for `works.json`, `catalog-public.json`, Journal, Brush current, canonical work, raw v054, and favicon; source/public registries each contained exactly one `brush-2026-11-11` record; rendered Journal/current/work contained the title.
- Production proofs: `research/qa/proofs/brush-v054-2026-11-11-production/`.

## Gate status

The artifact is recorded honestly as **candidate / held**. The executable, deterministic tableau and local/production structural interaction gates passed. Independent caption-free perceptual review remains unavailable. Vercel deployment was verified independently from GitHub synchronization; provider revision linkage is not available, so the work is not called exhibition-ready.
