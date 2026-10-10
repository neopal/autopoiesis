# Mutine daily studio record — Brush v029 — 2026-10-10

## Scope and source boundary

- Audit time: **2026-10-10 local time** (`+02:00`).
- Active catalogue sources read: `studio/data/studio.json` and `studio/data/works.json` only.
- Field tests and stimuli were not merged into the work register.
- Catalogue schemas observed: `mutine-studio/v2` and `mutine-works/v1`.
- Working register size: **161 works** across **6 currents**.
- Target artifact: **Brush v029 — The paint dries around the touch.** Status: **candidate / held**.

## Today’s six current/date slots

- **Handwriting / typography** — real record: `typography-2026-10-10`, *The margin keeps the spare.*, raw tableau `/studies/handwriting/v026/`; status `candidate / held`, lifecycle `active`.
- **Self portrait / portrait** — **held without a record** for `2026-10-10`.
- **Pure SVG / svg** — real record: `svg-2026-10-10`, *The aperture waits for leaving.*, raw tableau `/studies/pure-svg/v028/`; status `candidate / held`, lifecycle `active`.
- **Brush / brush** — real record: `brush-2026-10-10`, *The paint dries around the touch.*, raw tableau `/studies/p5-brush/v029/`; status `candidate / held`, lifecycle `active`.
- **Naive art / naive** — **held without a record** for `2026-10-10`.
- **WebGPU / webgpu** — **held without a record** for `2026-10-10`; current state is `dormant`.

Today’s coverage is **3/6 slots**. The three recorded slots each have exactly one record. Across the complete register, duplicate current/date slots: **0**.

## Changed rule and cultural translation

v029 abandons v027's freehand scrape, v028's mending route, and their shared moving-pointer grammar. Eleven overlapping solid radial sediment tongues respond to stillness: pointerdown starts a waiting clock, movement resets it, a short visit evaporates, and a long wait on release makes one tongue swell, a distant tongue settle, and a third drift. Four duration-weighted events remain in bounded memory; Delete lifts the latest body and R releases the archive.

The selected reference was [p5.brush](https://github.com/acamposuribe/p5.brush). Its observed mechanism is programmable pressure/density/direction participating in geometry production. Mutine translates this into duration as pressure, refusing brush marks, watercolor, hatching, source palette, composition, examples, and API surface. The falsifier is a moving gesture or direct location changing only a timer/readout, or a blind field that reads as a generic radial chart.

The work is a structural rupture in representation, interaction, and temporal behavior: population/reservoir/path becomes radial solid mass/stillness/departure.

## Catalogue integrity checks

All checks below were performed against the parsed JSON registers and repository paths:

- Canonical `works/<id>/index.html` pages: **161/161 present**.
- Raw tableau directories under the recorded `rawPath`: **161/161 present**.
- Raw tableau `index.html` files: **161/161 present**.
- Journal anchor fields: **161/161 present**.
- Canonical `/journal/#journal-<workId>` links: **161/161 present**.
- Journal anchor derivation matched the work id: **161/161**.
- Critique coverage: **161/161** have at least one critique.
- Explicit no-critique holds: **0**; no such hold was needed.
- Valid lifecycle values (`active` or `complete`): **154/161**.

### Schema anomaly / held records

Seven historical records have no `lifecycle` field and therefore fail the required `active`/`complete` lifecycle check:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

This is a schema anomaly, not an inferred lifecycle. Those records remain held and were not repaired or promoted by this audit. No missing canonical page, raw tableau, Journal link, critique, duplicate slot, or invalid non-empty lifecycle value was found.

## Complete-record immutability

- Complete records in `HEAD`: **0**.
- Complete records in the working register: **0**.
- Mutated complete records: **0**; comparison is vacuous because no complete records exist.

## Repository verification

- `npm run test`: **801 passed, 0 failed, 0 skipped** before the production-evidence metadata update.
- Changed JavaScript for this run: v029 engine, sketch, and probe; `node --check` **passed**.
- `git diff --check`: **passed**. Git emitted only existing LF/CRLF normalization warnings for modified files.
- Local headless browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Local diagnostics: **0** console messages, page errors, failed requests, or HTTP errors; `scrollWidth` matched viewport width.
- Local interaction: pointerdown arms only; short pointerup refuses; held pointerup commits; Enter/button commit; Delete restores exact mass; R releases; blind preview hides furniture; controls measure **44px**.
- Local Journal/current/canonical work/favicon readbacks passed; proof is `research/qa/proofs/brush-v029-2026-10-10/` with `results.json` plus **25 PNG captures**.
- Production headless browser matrix: **20/20 passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, raw/canonical, normal/reduced motion.
- Production diagnostics: **0** console messages, page errors, failed requests, or HTTP errors; `scrollWidth` matched viewport width.
- Production interaction: pointerdown arms only; short pointerup refuses; held pointerup commits; Enter/button commit; Delete restores exact mass; R releases; blind preview hides furniture; controls measure **44px**.
- Production public readbacks: `/studio/data/works.json` HTTP 200 with **161** works and exactly one target record; `/studio/data/catalog-public.json` HTTP 200 with **161** public works and no QA payload; Journal, Brush current, canonical work, and favicon all rendered/read back successfully.
- Production proof: `research/qa/proofs/brush-v029-2026-10-10-production/` with `results.json` plus **25 PNG captures**.
- Added-line static security scan: pending staged-diff verification for the production-evidence metadata update.
- The working tree already contained unrelated/uncommitted changes; they remain untouched and unstaged.

## Blocked / next actions

- Production deployment/readbacks completed at `https://autopoiesis-nine.vercel.app/` via deployment `dpl_CbAzaAL3SU9S1rn6fj9prUuEDaG6`; the evidence metadata update requires a follow-up commit/deploy.
- Resolve the seven missing historical lifecycle fields through an explicit catalogue decision; do not infer them in a future audit.
- The v029 candidate remains held pending independent caption-free perceptual comparison: does the blind field read as one radial sediment mass with consequential waiting, or an attractive radial chart?
- Provider revision linkage between the eventual Vercel deployment and GitHub SHA remains unresolved; WebGPU remains dormant in the source register.
