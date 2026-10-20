# Mutine daily studio archive — 2026-10-20

**Audit time:** 09:00 local time (`+0200`; observed at `09:00:46`)

**Status: BLOCKED — seven historical lifecycle fields are missing; the current test gate also fails on the uncommitted portrait v028 addition**

## Scope and source boundary

Read-only audit of the active catalogue sources:

- `studio/data/studio.json` — schema `mutine-studio/v2`
- `studio/data/works.json` — schema `mutine-works/v1`

Field tests and stimuli were not treated as works. The audit did not modify either catalogue source. The working tree already contains an uncommitted `studio/data/works.json` change, including the 2026-10-20 records; it differs from `HEAD`.

## Today's coverage

Today's date is `2026-10-20`. The six current/date slots contain two real work records and four empty/held slots:

- Handwriting / `typography` / `2026-10-20`: **real work** — `typography-2026-10-20`, `candidate / held`, `active`.
- Self portrait / `portrait` / `2026-10-20`: **real work** — `portrait-2026-10-20`, `candidate / held`, `active`.
- Pure SVG / `svg` / `2026-10-20`: **empty / held** — no record; current state `active`.
- Brush / `brush` / `2026-10-20`: **empty / held** — no record; current state `active`.
- Naive art / `naive` / `2026-10-20`: **empty / held** — no record; current state `active`.
- WebGPU / `webgpu` / `2026-10-20`: **empty / held** — no record; current state `dormant`.

No current/date slot has more than one record. The complete duplicate-slot scan returned **none**.

Latest recorded work per current:

- Handwriting: `typography-2026-10-20`.
- Self portrait: `portrait-2026-10-20`.
- Pure SVG: `svg-2026-10-14`.
- Brush: `brush-2026-10-14`.
- Naive art: `naive-2026-10-19`.
- WebGPU: `webgpu-2026-10-13`.

## Catalogue audit

- Parsed **177 work records** from `studio/data/works.json`; IDs are unique (`177/177`).
- Canonical pages: **177/177** `works/<id>/index.html` files exist.
- Journal records: **177/177** have the exact recorded anchor `journal-<workId>` and a non-empty note.
- Canonical journal routes: **177/177** canonical pages contain the matching `/journal/#journal-<workId>` route.
- Raw tableaux: **177/177** `rawPath` targets are under `/studies/`, exist, and contain `index.html`.
- Critique coverage: **177/177** have at least one critique; no explicit no-critique hold was needed.
- Explicit lifecycle `active`/`complete`: **170/177**.
- Explicit `complete` works: **0**.
- Complete-work mutation comparison against `HEAD`: no complete works existed, so the mutation check was vacuous; no complete work was observed as mutated.
- Current/date duplicate slots: **none**.

### Blocking schema anomaly

Seven historical records still have no explicit `lifecycle` field, so the required lifecycle audit cannot pass for the full register:

- `typography-2026-08-28`
- `brush-2026-08-28`
- `typography-2026-08-31`
- `svg-2026-08-31`
- `portrait-2026-08-31`
- `naive-2026-08-31`
- `brush-2026-08-31`

No missing tableau, journal-route mismatch, duplicate slot, or malformed top-level register schema was observed.

## Verification

- `npm run test`: **884 passed, 6 failed, 890 total**.
- The six failures were:
  - `catalog-architecture.test.mjs`: expected 176 records, observed 177.
  - `daily-catalog.test.mjs`: recorded-date expectation omits the added `portrait-2026-10-20` record.
  - `daily-catalog.test.mjs`: grouped-catalogue expectation is 176, observed 177.
  - `deployment-optimization.test.mjs`: checked-in public catalogue does not match the current source register containing portrait v028.
  - `evolution-catalog.test.mjs`: expected 176 records, observed 177.
  - `portrait-v028.test.mjs`: `ReferenceError: liftLatestGesture is not defined`.
- Changed/untracked JavaScript syntax: `node --check` passed for **2/2** detected files: `.hermes/portrait-v016-probe.mjs` and `tests/portrait-v028.test.mjs`.
- `git diff --check`: passed.
- No auth, throttling, challenge, or network dependency was encountered.
- No browser automation, CUA, Chrome, DevTools, CDP, GUI, or window launch was performed. Visual/perceptual and live-interaction gates remain held because they were not independently verifiable unattended.
- No commit, push, or deployment was performed.

## Gaps and next actions

1. Add explicit `active` or `complete` lifecycle values to the seven historical records, then rerun the full lifecycle audit.
2. Resolve the portrait v028 test failure by supplying or correcting the missing `liftLatestGesture` test/runtime binding; rerun the full suite.
3. Reconcile the source-register/public-catalogue and fixed-count/date expectations with the uncommitted 2026-10-20 records, or remove the records if they are not intended to be active catalogue entries.
4. Keep the four empty 2026-10-20 slots empty rather than inventing work; create a slot only when a real work record and tableau exist.
5. Keep both 2026-10-20 candidate works held pending the recorded browser matrices, caption-free perceptual review, production readback, and provider revision linkage.
