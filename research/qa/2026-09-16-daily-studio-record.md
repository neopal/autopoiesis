# Daily studio record — 2026-09-16

## Scope and decision

The unattended audit ran at `2026-09-16 09:00:46 +0200` in
`C:/Users/ASUS/autopoiesis`.

The only catalogue inputs used were `studio/data/studio.json`
(`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). The
The register contains 6 currents and 70 work records covering `2026-08-28`
through `2026-09-16`.

Today's audit found three recorded daily works and three held/no-record slots.
The recorded works remain **candidate / held**. No promotion or independent
visual perceptual claim is made by this unattended run.

## Today's coverage

| Current | Register state | 2026-09-16 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | recorded / candidate-held | `typography-2026-09-16` |
| Self portrait (`portrait`) | active | recorded / candidate-held | `portrait-2026-09-16` |
| Pure SVG (`svg`) | active | held / no record | — |
| Brush (`brush`) | active | recorded / candidate-held | `brush-2026-09-16` |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | held / no record | — |

The three recorded slots each have exactly one register entry. The three missing
slots remain held rather than being filled with invented work.

## Recorded-work integrity audit

The parser checked every one of the 70 register records against its canonical
filesystem and the journal rendering contract.

- Canonical pages: **70/70 present** at `works/<workId>/index.html`.
- Raw tableau indexes: **70/70 present** at the registered `/studies/.../`
  paths.
- Journal anchors: **70/70 have the expected `journal-<workId>` anchor**, the
  `/journal/` mount exists, the renderer emits the registered anchor, and each
  canonical page links to its `/journal/#...` target.
- Critique gate: **70/70 have at least one critique**; no empty critique record
  required the explicit no-critique hold fallback.
- Duplicate current/date slots: **none**.
- Unknown current IDs: **none**.

### Schema anomaly — lifecycle gate stopped for seven legacy records

The register has **63 `active` records, 0 `complete` records, and 7 records
with no `lifecycle` field**. The affected records are:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

This is a real schema anomaly, so the lifecycle acceptance gate is **not
passed globally** and the affected legacy audit is held. The report does not
reinterpret the missing field as `active` or `complete`. Because there are no
records explicitly marked `complete`, the complete-work immutability check is
vacuous for this register. No catalogue or artwork mutation was made during
this run.

## Browser and perceptual boundary

The new Brush work has a real local headless browser matrix: 10 canonical runs
at 320×568, 390×844, 768×1024, 1280×800, and 1920×1080 in normal and
reduced-motion modes, plus raw interaction and static-blind runs. The probe
recorded zero console messages, page errors, failed requests, or HTTP 400+
responses; all canonical runs matched innerWidth, clientWidth, and scrollWidth;
the tableau preceded generated prose; and the raw interaction changed memory
0→1→2→1→0 with exact canvas restoration after lifting.

The stable production alias `https://autopoiesis-nine.vercel.app` was then
read back: `/studio/data/works.json`, `/journal/`, the canonical Brush URL, and
the raw tableau all returned HTTP 200. A production headless matrix repeated
the ten canonical viewport/motion runs with zero console messages, page errors,
failed requests, or HTTP 400+ responses; `/journal/` rendered the
`journal-brush-2026-09-16` anchor and title; and the deployed raw interaction
changed memory 0→1→2→1.

The three 2026-09-16 records carry catalogue statuses of `candidate / held` and
recorded browser-evidence notes that still leave provider revision verification
and/or independent caption-free perceptual comparison unresolved. The exact
missing evidence remains the visual gate: a fresh
caption-free review with witnesses, labels, readout, and editorial furniture
hidden. The recorded works therefore remain held.

## Automated checks

- `npm run test`: **367 passed, 0 failed, 0 skipped, 0 todo**.
- `node --check studies/p5-brush/v014/sketch.js`: **PASS**.
- `node --check studies/p5-brush/v014/engine.mjs`: **PASS**.
- `node --check research/qa/proofs/brush-v014-2026-09-16/probe.mjs`: **PASS**.
- `git diff --check`: **PASS**.
- The new work's source, engine, register, public catalog, canonical page, and
  QA evidence are present; independent code/perceptual review and production
  readback remain separate unresolved gates.

## Next actions

1. Resolve the seven legacy records' missing `lifecycle` field in the active
   catalogue process; do not infer a lifecycle in QA prose.
2. Keep the three 2026-09-16 no-record slots held unless a real work record and
   its filesystem evidence are created.
3. Obtain the blocked independent caption-free perceptual review for the three
   recorded works, then perform the provider revision check separately.
