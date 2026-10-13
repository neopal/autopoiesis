# Mutine daily studio audit — 2026-10-07

- **Audit time:** 09:01 local (system clock)
- **Scope:** `studio/data/studio.json` and `studio/data/works.json` only as active catalogue sources
- **Catalogue schemas:** `mutine-studio/v2`, `mutine-works/v1`
- **Currents audited:** 6
- **Recorded work records parsed:** 144

## Today’s coverage

| Current | Date slot | Result |
|---|---|---|
| Handwriting (`typography`) | `2026-10-07` | **Recorded:** `typography-2026-10-07` |
| Self portrait (`portrait`) | `2026-10-07` | **Recorded:** `portrait-2026-10-07` |
| Pure SVG (`svg`) | `2026-10-07` | **Held:** no record |
| Brush (`brush`) | `2026-10-07` | **Held:** no record |
| Naive art (`naive`) | `2026-10-07` | **Held:** no record |
| WebGPU (`webgpu`) | `2026-10-07` | **Held:** no record; current is marked dormant in `studio.json` |

- Today’s real work records: **2/6 current/date slots**.
- Duplicate current/date slots: **0** across all 144 records.
- Today’s records have no duplicate slot and both are `lifecycle: active`.

## Catalogue integrity

- Canonical pages: **144/144 present** at `works/<workId>/index.html`.
- Raw tableaus: **144/144 present** at the registered `rawPath` under `/studies/`, with an `index.html`.
- Journal anchors: **144/144 valid**. Each record has the exact `journal-<workId>` anchor, its canonical page links to `/journal/#journal-<workId>`, and `/journal/index.html` exists.
- Critique coverage: **144/144 have at least one critique**; no explicit no-critique hold was needed.
- Lifecycle: **137 valid** values (`active` or `complete`); **7 missing fields**; **0 invalid values**.

### Schema anomaly — held, not inferred

The seven records below lack a lifecycle field. The audit does not infer `active` or `complete`:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

## Complete-work immutability

- Complete records in `HEAD`: **0**.
- Complete records in the working register: **0**.
- Therefore no complete work is present to compare or mutate; no lifecycle-complete record was promoted or edited by this audit.
- Existing working-tree changes were not committed, pushed, or altered by this audit.

## Repository verification

- `npm run test`: **717 passed, 0 failed**.
- Changed JavaScript syntax: no tracked JavaScript changes; untracked `.hermes/portrait-v016-probe.mjs` passed `node --check`.
- `git diff --check`: **PASS**. Git emitted only existing LF/CRLF normalization warnings for modified HTML files.
- Current working-tree paths observed before this report update: seven modified canonical HTML pages, `.hermes/portrait-v016-probe.mjs`, and the prior `research/qa/2026-10-06-daily-studio-record.md`.
- This audit updated only this QA report; no catalogue, work-page, or raw-tableau files were altered, committed, pushed, or deployed.

## Verification boundary and next actions

- No browser, GUI, CUA, Chrome, CDP, remote-debugging, or window-launch activity was performed.
- Visual, interaction, responsive, blind-preview, and publication gates were **not re-verified** in this unattended audit; they remain held unless independently evidenced elsewhere.
- Next action: resolve the seven missing lifecycle fields in the catalogue or explicitly document their intended state before treating the register as schema-complete.
- Next action: run the independent caption-free perceptual and interaction gates in an authorized browser-capable review, without inferring results from source inspection.