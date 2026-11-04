# Mutine daily studio archive — 2026-10-28

## Audit scope

The 09:00 local repository audit used only `studio/data/studio.json` and `studio/data/works.json` as active catalogue sources. Field tests and stimuli were not treated as works. No browser automation, CUA, Chrome, DevTools/CDP, GUI, or window launch was used.

## Today’s six current/date slots

- **Handwriting / `typography`** — real work record: `typography-2026-10-28`, “The sentence answers from its margins.”, raw tableau `/studies/handwriting/v036/`, status `candidate / held`, lifecycle `active`.
- **Self portrait / `portrait`** — real work record: `portrait-2026-10-28`, “The portrait hardens where it resists.”, raw tableau `/studies/self-portrait/v036/`, status `candidate / held`, lifecycle `active`.
- **Pure SVG / `svg`** — held; no catalogue record for `2026-10-28`.
- **Brush / `brush`** — held; no catalogue record for `2026-10-28`.
- **Naive art / `naive`** — held; no catalogue record for `2026-10-28`.
- **WebGPU / `webgpu`** — held; no catalogue record for `2026-10-28`; current state is `dormant`.

Duplicate current/date slots: **none**. The register contains **220** records, **220** unique work IDs, and **0** duplicate current/date keys.

## Register and route checks

Both JSON registers parsed successfully:

- `studio/data/studio.json` — schema `mutine-studio/v2`, **6** currents.
- `studio/data/works.json` — schema `mutine-works/v1`, **220** records.

Observed structural coverage across all 220 recorded works:

- Canonical `works/<id>/index.html`: **220/220**.
- Raw `rawPath/index.html` tableau under `/studies/`: **220/220**.
- Journal anchor field equal to `journal-<workId>`: **220/220**.
- Canonical page contains the exact `/journal/#journal-<workId>` route: **220/220**.
- At least one critique or explicit no-critique hold: **220/220**. All records satisfied this through a non-empty critique list; no explicit no-critique hold was needed.
- Valid lifecycle (`active` or `complete`): **213/220**.

### Catalogue gap / schema anomaly

Seven historical records still have no valid `lifecycle` value:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

The lifecycle acceptance criterion remains **blocked** for those records. No lifecycle value was inferred or backfilled.

Complete-work mutation check: **0 complete records**. The mutation check is therefore vacuous; no complete work was marked mutated. The existing working-tree changes are unrelated to any complete record.

## Verification commands and observed results

- `npm run test`: **1139 passed, 0 failed** (`node --test tests/*.test.mjs`).
- JSON register parse: **passed** for both active catalogue registers.
- Changed JavaScript files: **none** found in the working tree, so there were no changed JavaScript files requiring `node --check`.
- `git diff --check`: **passed** (exit code 0; Git emitted only existing LF-to-CRLF warnings for modified HTML files).
- Browser or visual verification: **not performed in this unattended audit**. Existing `browserEvidence` fields in catalogue records were not treated as fresh browser evidence. The two 2026-10-28 records therefore remain `candidate / held`.

## Working-tree boundary

Pre-existing changes were preserved and not modified by this audit:

- 11 modified canonical work HTML files.
- 3 untracked daily QA records from earlier dates.
- 1 untracked production proof directory.

This audit did not change any catalogue JSON, work page, raw tableau, commit, push, deployment, or browser state.

## Gaps and next actions

1. Resolve the seven historical lifecycle gaps by recording an explicitly verified `active` or `complete` value; do not infer state from dates or page existence.
2. Re-run the full catalogue audit after that schema repair.
3. Keep `typography-2026-10-28` and `portrait-2026-10-28` held pending an independent caption-free perceptual review and provider revision linkage.
4. Keep the four no-record slots held; do not create placeholder works for missing dates.

The catalogue audit is **blocked for lifecycle completeness** but structurally clean for routes, raw tableaux, Journal anchors, critiques/holds, duplicate slots, tests, and diff whitespace.
