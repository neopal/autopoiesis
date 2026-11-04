# Mutine daily studio record — 2026-11-04

## Scope and audit time

- Audit time: `2026-11-04 11:47:15` from the local system clock.
- Active catalogue sources read: `studio/data/studio.json` and `studio/data/works.json`.
- Field tests and stimuli were not treated as works.
- Browser verification used headless system Chrome through Playwright only; no GUI, headed Chrome, CDP, or remote debugging was used.

## Today's coverage

The studio register declares six currents and one daily slot per current. The observed 2026-11-04 slots are:

- **Handwriting / `typography`: real work** — `typography-2026-11-04`, *The mouth becomes a hinge.*, `candidate / held`, lifecycle `active`, raw `/studies/handwriting/v042/`.
- **Self portrait / `portrait`: real work** — `portrait-2026-11-04`, *The portrait leaves the room.*, `candidate / held`, lifecycle `active`, raw `/studies/self-portrait/v042/`.
- **Pure SVG / `svg`: real work** — `svg-2026-11-04`, *The cut changes its elsewhere.*, `candidate / held`, lifecycle `active`, raw `/studies/pure-svg/v044/`.
- **Brush / `brush`: held** — no 2026-11-04 catalogue record.
- **Naive art / `naive`: held** — no 2026-11-04 catalogue record.
- **WebGPU / `webgpu`: held** — no 2026-11-04 catalogue record; the current is declared `dormant` in `studio.json`.

There is no more-than-one-record collision for any current/date slot. Work IDs are also unique: **259 records, 259 unique IDs**.

## Catalogue integrity

Observed from the parsed local registers:

- JSON parsing: passed for `studio/data/studio.json` (`mutine-studio/v2`), `works.json` (`mutine-works/v1`), `catalog-public.json` (`mutine-public-catalog/v1`), `stimuli.json` (`mutine-stimuli/v1`), `cultural-field.json` (`mutine-cultural-field/v1`), and `artist.json` (`mutine-artist/v1`).
- Canonical pages: **259/259** recorded works have `works/<id>/index.html`.
- Raw tableaux: **259/259** `rawPath` values are safe `/studies/` routes with an existing `index.html` tableau.
- Journal anchors: **259/259** have the expected `journal-<workId>` field and a matching `/journal/#journal-<workId>` link in the canonical page. The journal renderer's `journalHref` helper is present.
- Critique or explicit no-critique hold: **259/259**. All recorded works currently carry critique data; no explicit no-critique fallback was needed.
- Lifecycle: **252/259 valid** (`active` or `complete`). Seven historical records still have a null/invalid lifecycle:
  - `typography-2026-08-28`
  - `brush-2026-08-28`
  - `typography-2026-08-31`
  - `svg-2026-08-31`
  - `portrait-2026-08-31`
  - `naive-2026-08-31`
  - `brush-2026-08-31`
- Complete-work mutation check: **0 complete works**; therefore the mutation check is vacuous and no complete-work mutation was observed.

No missing tableau, current/date duplicate, catalogue/page mismatch, or schema parse anomaly was observed. No authentication, throttling, or challenge state was encountered. The stable production alias was fetched and rendered successfully after deployment.

## Verification commands

- Targeted `pure-svg-v044` suite: **6 passed, 0 failed**.
- Full suite: **1359 passed, 0 failed** (`npm test`).
- Local headless browser matrix: **20/20 raw/canonical runs passed** across `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080` in normal and reduced-motion modes; diagnostics `0`, overflow failures `0`, minimum touch target `44px`.
- Stable production-alias headless browser matrix: **20/20 raw/canonical runs passed** across the same five viewports and two motion modes; diagnostics `0`, overflow failures `0`, minimum touch target `44px`.
- Interaction evidence, locally and on the stable alias: pointer and synthetic touch committed a remote split while the source aperture stayed exact; incomplete and re-entry paths were refused; Delete, Escape, keyboard, and controls passed.
- Blind preview evidence, locally and on the stable alias: reduced-motion static mode retained one compound SVG skin, six apertures, and four secondary split paths while hiding readout, controls, rim markers, annotations, and chrome.
- Changed JavaScript syntax: `node --check studies/pure-svg/v044/sketch.js` passed; the new Playwright probe also parsed and ran.
- `git diff --check`: passed. Git emitted existing LF-to-CRLF working-copy warnings only; no whitespace error was reported.

## Publication

- Artifact commit: `dc10b10ba4382880d63e991a0b5dc40cabfe486b`.
- `origin/main`: `dc10b10ba4382880d63e991a0b5dc40cabfe486b` (matches local `HEAD`).
- Production deployment: `dpl_CzygwzH5mcvrbotmV5TmcjHh8zQw` at `https://autopoiesis-1q27u5khy-lairpa-hotmailfrs-projects.vercel.app`, aliased to `https://autopoiesis-nine.vercel.app`.
- Stable-alias readback: HTTP 200 and rendered visibility for `/studio/data/works.json`, `/studio/data/catalog-public.json`, `/journal/`, `/currents/pure-svg/`, `/works/svg-2026-11-04/`, `/studies/pure-svg/v044/`, and `/studio/favicon.svg`; exactly one `svg-2026-11-04` record in both registers; Journal anchor/title and canonical tableau rendered.

## Open follow-ups

1. Repair the seven historical records with invalid/null lifecycle values, then rerun the full catalogue audit.
2. Keep the three uncovered 2026-11-04 currents held; do not fabricate catalogue records for missing work.
3. Independent caption-free perceptual review and provider revision linkage remain unavailable; the SVG candidate stays held and no exhibition-readiness claim is made.

**Status: TECHNICALLY VERIFIED LOCALLY AND ON THE STABLE ALIAS; TODAY'S COVERAGE IS 3/6 REAL WORK RECORDS. SVG V044 REMAINS CANDIDATE / HELD.**