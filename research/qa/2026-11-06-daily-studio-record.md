# Mutine daily studio record — 2026-11-06

## Scope and audit time

- Audit time: `2026-11-06 14:18:08 +0100` from the local system clock.
- Active catalogue sources read: `studio/data/studio.json` and `studio/data/works.json`.
- Field tests and stimuli were not treated as works.
- Browser verification used headless Playwright against the local static server only; no headed Chrome, CUA, CDP, remote debugging, GUI, or window launch was used.

## Today's coverage

The studio register declares six currents and one daily slot per current. The observed `2026-11-06` slots are:

- **Handwriting / `typography`: held** — no `2026-11-06` catalogue record.
- **Self portrait / `portrait`: real work** — `portrait-2026-11-06`, *The portrait refuses the answer.*, `candidate / held`, lifecycle `active`, raw `/studies/self-portrait/v044/`.
- **Pure SVG / `svg`: real work** — `svg-2026-11-06`, *The weight is made by waiting.*, `candidate / held`, lifecycle `active`.
- **Brush / `brush`: real work** — `brush-2026-11-06`, *The sheet holds a pressure chord.*, `candidate / held`, lifecycle `active`, raw `/studies/p5-brush/v049/`.
- **Naive art / `naive`: held** — no `2026-11-06` catalogue record.
- **WebGPU / `webgpu`: held** — no `2026-11-06` catalogue record; the current is declared `dormant` in `studio.json`.

Today's coverage is **3/6 real work records** and **3/6 held slots**. No current/date slot has more than one record. The register contains **269 records with unique IDs**, as verified by the full suite.

## Brush candidate

- Changed rule: one hand remains geometry-neutral; only a two-site pressure chord held for at least `720ms` and released with alternating lead changes the next internal fold.
- Structural rupture: v046's through-void monolith, v047's reciprocal islands, and v048's remote-regrowth wash become one portrait-oriented folded sheet with eight unequal folds, seven seams, two fixed pressure sites, internal fault geometry, and four liftable states.
- Cultural reference: `p5-brush` — pressure, density, directional behaviour, and vector fields treated as geometry-producing material rules.
- Translation: timed relational pressure changes the next fold rather than styling the current mark; source brush presets, watercolor, hatching, grain, palette, composition, code, examples, and API surface are refused.
- Falsifier: one-sided/short pressure commits, sites deform, fold change is cosmetic, alternation is ignored, later folds reset, or lift is inexact.
- Deletion condition: delete v049 if caption-free viewing cannot distinguish the held-chord fold sheet from v046–v048 or if duration is only explanatory prose.

## Catalogue integrity

Observed from the parsed local registers and filesystem:

- JSON parsing: passed for `studio/data/studio.json` (`mutine-studio/v2`) and `studio/data/works.json` (`mutine-works/v1`).
- Required work fields: **269/269** records contain the expected identity, date, route, journal, status, and critique fields.
- Current references: **269/269** reference one of the six declared currents.
- Date shape: **269/269** dates match `YYYY-MM-DD`.
- Raw path safety: **269/269** use a `/studies/` route without traversal, query, or fragment components.
- Canonical pages: **269/269** recorded works have `works/<id>/index.html`.
- Raw tableaux: **269/269** `rawPath` values resolve to an existing `/studies/` tableau with `index.html`.
- Journal anchors: **269/269** canonical pages contain the expected `/journal/#journal-<workId>` link.
- Critique or explicit no-critique hold: **269/269** have a non-empty `critiques` array; no explicit no-critique fallback was needed.
- Lifecycle: **262/269** are valid (`active` or `complete`). Seven historical records still have an absent/invalid lifecycle value; the new brush and existing 2026-11-06 records are `active`.
  - `typography-2026-08-28`
  - `brush-2026-08-28`
  - `typography-2026-08-31`
  - `svg-2026-08-31`
  - `portrait-2026-08-31`
  - `naive-2026-08-31`
  - `brush-2026-08-31`
- Complete-work mutation check: **0 complete works** are present, so there was no complete record on which to perform a mutation comparison. This gate remains unresolved rather than passing by evidence.

No duplicate slot, duplicate ID, missing canonical page, missing tableau, missing Journal link, invalid current reference, invalid date shape, invalid raw route, or required-field schema anomaly was observed. No authentication, throttling, or challenge signal was encountered in the local repository audit; no remote audit was attempted.

## Verification commands

- Full suite: **1408 passed, 0 failed** (`npm run test`).
- Targeted Brush suite: **4 passed, 0 failed** (`node --test tests/brush-v049.test.mjs`).
- Syntax: `node --check studies/p5-brush/v049/sketch.js studies/p5-brush/v049/engine.mjs` passed.
- Generators: `node scripts/generate-work-pages.mjs` generated 269 daily work pages; `node scripts/build-public-catalog.mjs` completed.
- `git diff --check`: passed.
- Local browser matrix: **20/20 raw and 20/20 canonical runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion. No overflow, page errors, failed requests, bad responses, or console messages.
- Local interaction: chord control committed one fold; keyboard chord committed a second; lift returned to one memory; release returned to the deterministic seed; a single-site pointer hold was refused without geometry change.
- Blind reduced-motion preview: four fold states visible; controls/readout/hint hidden; canvas visible; `scrollWidth` equalled `innerWidth` at `390px`.
- Proofs: `research/qa/proofs/brush-v049-2026-11-06-local/` and `research/qa/proofs/brush-v049-2026-11-06-production/`.

## Publication state

- Artifact commit: `b25b0e33b825f15d9d702a9f617dbda1e90bd97d`; remote `main` matched it before deployment.
- Production deployment: `https://autopoiesis-ja74g60fd-lairpa-hotmailfrs-projects.vercel.app`, stable alias `https://autopoiesis-nine.vercel.app`, deployment `dpl_FR9quph8cjr5bEMoNMXPwd8ocwuK`.
- Production browser matrix: **20/20 raw and 20/20 canonical runs passed** at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced-motion. No overflow, page errors, failed requests, bad responses, or console messages.
- Production readbacks: works JSON returned `brush-2026-11-06`, raw path, title, `candidate / held`, and Journal anchor; Journal returned the anchor once, the title twice in its rendered page text, and a canonical link; canonical work, raw tableau, and `/studio/favicon.svg` all returned successfully.
- Independent caption-free perceptual review and provider revision linkage remain unresolved.

## Open follow-ups

1. Repair the seven historical records with absent/invalid lifecycle values, then rerun the full catalogue audit.
2. Obtain at least one `complete` record or explicitly keep completion absent; if any work becomes complete, run a before/after mutation comparison at the next audit.
3. Keep Handwriting, Naive art, and WebGPU held; do not fabricate catalogue records for the three missing `2026-11-06` slots.
4. Obtain provider revision linkage and independent caption-free perceptual evidence before making any visual, interaction, or exhibition-readiness claim.

**Status: BRUSH ARTIFACT, LOCAL TECHNICAL GATES, AND PRODUCTION READBACK PASSED; CANDIDATE REMAINS HELD PENDING INDEPENDENT PERCEPTUAL REVIEW AND PROVIDER REVISION LINKAGE.**
