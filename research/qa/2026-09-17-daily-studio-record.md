# Daily studio record — 2026-09-17

## Scope and decision

The unattended audit ran at `2026-09-17 09:01:41 +0200` in
`C:/Users/ASUS/autopoiesis`.

The only active catalogue inputs used were `studio/data/studio.json`
(`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`). The
register contains 6 currents and 74 work records covering `2026-08-28` through
`2026-09-17`.

Today's audit found two recorded daily works and four held/no-record slots. The
recorded works remain **candidate / held**. No promotion or independent visual
perceptual claim is made by this unattended run.

## Today's coverage

| Current | Register state | 2026-09-17 slot | Record |
|---|---|---|---|
| Handwriting (`typography`) | active | recorded / candidate-held | `typography-2026-09-17` |
| Self portrait (`portrait`) | active | recorded / candidate-held | `portrait-2026-09-17` |
| Pure SVG (`svg`) | active | held / no record | — |
| Brush (`brush`) | active | held / no record | — |
| Naive art (`naive`) | active | held / no record | — |
| WebGPU (`webgpu`) | dormant | held / no record | — |

Each of the two recorded slots has exactly one register entry. The four missing
slots remain held rather than being filled with invented work. Across the full
register, records by current are: Handwriting 13, Self portrait 12, Pure SVG
12, Brush 14, Naive art 12, and WebGPU 11. Duplicate current/date slots: none.
Unknown current IDs: none.

## Recorded-work integrity audit

The parser checked every one of the 74 register records against its canonical
filesystem path and the Journal rendering contract.

- Canonical pages: **74/74 present** at `works/<workId>/index.html`.
- Raw tableau directories and indexes: **74/74 present** at the registered
  `/studies/.../` paths.
- Journal anchor shape: **74/74 use `journal-<workId>`**.
- Canonical Journal links: **74/74 canonical pages contain the exact
  `/journal/#journal-<workId>` target**.
- Critique gate: **74/74 have at least one critique**; no explicit
  no-critique hold fallback was needed.
- Duplicate current/date slots: **none**.
- Field-test separation: the 2 registered field-test paths are under `/spikes/`
  and neither occurs as a work `rawPath`. Field tests were not treated as daily
  works.

### Schema anomaly — lifecycle gate stopped for seven legacy records

The register has **67 `active` records, 0 `complete` records, and 7 records
with no `lifecycle` field**. The affected records are:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

This is a real schema anomaly, so the lifecycle acceptance gate is **not
passed globally** and the affected legacy audit remains held. The report does
not reinterpret the missing field as `active` or `complete`. Because there are
no records explicitly marked `complete`, the complete-work immutability check
is vacuous for this register. The audit began with a clean working tree; no
catalogue, artwork, or source mutation was made during the audit.

## Browser and perceptual boundary

No browser automation, GUI, CUA, Chrome, DevTools, CDP, or remote-debugging
run was performed by this unattended audit. The two 2026-09-17 records carry
catalogue browser-evidence notes, but both remain held in the register:

- `typography-2026-09-17`: recorded evidence says local and production
  headless matrices passed, but independent caption-free perceptual comparison
  and provider revision verification remain unresolved.
- `portrait-2026-09-17`: recorded evidence says local headless readback and
  production route readback passed, but a production viewport matrix,
  independent caption-free perceptual comparison, and provider revision
  verification remain unresolved.

Those visual and interaction gates were not independently re-run here. The
exact missing evidence remains the caption-free review with witnesses, labels,
readout, and editorial furniture hidden, plus the provider revision check where
recorded as unresolved. The affected works stay held.

## Automated checks

- `npm run test`: **387 passed, 0 failed, 0 skipped, 0 todo**.
- Changed JavaScript syntax check: **not applicable**; the repository had no
  changed `.js` or `.mjs` files at audit start.
- `git diff --check`: **PASS**.
- Initial `git status --short`, `git diff --stat`, and `git diff --name-only`:
  **no source changes**.

The report itself is the only artifact written by this run. No commit, push, or
deploy was performed.

## Next actions

1. Resolve the seven legacy records' missing `lifecycle` field in the active
   catalogue process; do not infer a lifecycle in QA prose.
2. Keep the four 2026-09-17 no-record slots held unless a real work record and
   its filesystem evidence are created.
3. Obtain the blocked caption-free perceptual reviews and the provider revision
   checks for the two recorded works before considering promotion.
