# Mutine daily studio record — Brush / 2026-11-09

## Slot and status

- Target current: `brush`
- Date: `2026-11-09`
- Work: *The paint re-counts the room.*
- Version: `v052`
- Record: `brush-2026-11-09`
- Status: `candidate / held`
- Raw tableau: `/studies/p5-brush/v052/`
- Canonical work: `/works/brush-2026-11-09/`

## Direction

The last three Brush works repeated a pressure-held object grammar: v049's chord sheet, v050's reversible relief cut, and v051's phase-locked ring. v052 makes a material and encounter rupture rather than polishing that sequence.

- Changed rule: material is a count of occupied plates. One discrete cut removes a real unit; every surviving plate is re-produced around the vacancy. Cut order changes the re-pack.
- Visible consequence: the blind view is a distributed register of 35 unequal planar plates. A valid cut makes a true empty place and moves/scales/angles/skews the surviving field. Four vacancies persist and are liftable.
- Viewer task: select one occupied plate, cut it once, then watch the rest re-count. Repeated or empty cuts refuse; no hover or timing threshold carries the work.
- Falsifier: delete if the cut is only a dark overlay, neighbours remain fixed, order is cosmetic, memory resets, lift is inexact, or the blind field reads as a generic grid.
- Deletion condition: delete v052 if caption-free viewing cannot distinguish the vacancy register from v049–v051 or if the empty place cannot carry the work without prose.

## Cultural translation

- Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: pressure, density, directional behaviour, fills, and vector fields participate in generating geometry instead of decorating a finished mark.
- Translated Mutine rule: refuse the source's brush surface and translate material production into vacancy-driven re-packing: a cut removes one occupied plate and changes the production coordinates of every survivor.
- Anti-copy boundary: no source brushes, watercolor appearance, hatching, grain, palette, composition, code, examples, API surface, or imagery were reproduced.
- Direction consequence: closes the phase-lock / subtraction / held-chord run and opens vacancy as material agency — paint remembers a removal by changing the coordinates of what remains.

## Files generated for this run

- `studies/p5-brush/v052/index.html`
- `studies/p5-brush/v052/sketch.js`
- `studies/p5-brush/v052/engine.mjs`
- `studies/p5-brush/v052/style.css`
- `studies/p5-brush/v052/README.md`
- `studies/p5-brush/v052/metrics.json`
- `studies/p5-brush/v052/critiques.json`
- `works/brush-2026-11-09/index.html`
- `studio/data/works.json`
- `studio/data/catalog-public.json`
- `tests/brush-v052.test.mjs`
- `tests/daily-catalog.test.mjs`
- `scripts/brush-v052-probe.mjs`
- `research/qa/proofs/brush-v052-2026-11-09-local/`

The pre-existing untracked reports `research/qa/2026-11-08-daily-studio-record.md` and `research/qa/2026-11-09-daily-studio-record.md` were left untouched.

## Verification observed locally

- RED: `node --test tests/brush-v052.test.mjs` failed first because `studies/p5-brush/v052/engine.mjs` did not exist.
- GREEN targeted: **8 passed, 0 failed**.
- Focused catalog + v052 tests: **15 passed, 0 failed**.
- Full suite: **1499 passed, 0 failed**.
- `node --check` on changed JavaScript: passed.
- `git diff --check`: passed.
- Static dangerous-execution scan: no findings.
- Local browser matrix: **20/20 passed** with headless system Chrome via Playwright.
- Viewports: `320×568`, `390×844`, `768×1024`, `1280×800`, `1920×1080`.
- Modes: normal and reduced motion.
- Diagnostics: **0**; horizontal overflow: **0**; minimum tested control target: **44px**.
- Interaction evidence: pointer cut changed geometry and created a vacancy; repeat cut was refused; three cuts compounded; Delete lifted; Escape released; ArrowRight + Enter committed; touch cut control committed.
- Blind preview evidence: at `390×844`, four vacancies and 31 present plates remained while readout, controls, selection, hint, and caption were hidden; `innerWidth/clientWidth/scrollWidth` was `390/390/390`.
- Local source/public catalog, Journal, Brush current, canonical work, raw tableau, and favicon readbacks passed.

## Publication state

- Initial source commit: `0ddc292ef42f9bb11247f50923b8a5ffb3a1e6ca`.
- Initial push: `origin/main` accepted `0ddc292`.
- Matrix-tested production deployment: `https://autopoiesis-lk8bpawzm-lairpa-hotmailfrs-projects.vercel.app` (`dpl_Fj6VjiPhZQrKjFjMeBpiFNxyo8Z9`).
- Stable alias: `https://autopoiesis-nine.vercel.app`.
- Production browser matrix: **20/20 passed**, with **0 diagnostics**, **0 horizontal-overflow failures**, and minimum tested control target **44px**.
- Production interaction: pointer cut, repeat refusal, three-cut compounding, Delete lift, Escape release, keyboard cut, and touch cut-control path passed.
- Production blind preview: four real vacancies and 31 present plates remained at `390×844` in reduced-motion static blind mode while readout, controls, selection, hint, and caption were hidden.
- Production readbacks: `/studio/data/works.json` and `/studio/data/catalog-public.json` each contained exactly one `brush-2026-11-09` record; `/journal/` rendered `journal-brush-2026-11-09` and the exact title; canonical work, raw tableau, and `/studio/favicon.svg` returned `200`.

The candidate remains held pending:

1. independent caption-free perceptual review of the blind tableau;
2. provider-side revision linkage between the Vercel deployment and GitHub SHA.

## Final deployment recheck

- Runtime source commit used for the final recheck: `2326b5476d1c0adb7e68f28231d2da55dcd846b6`.
- The stable alias was deployed again after the production-evidence record was committed; the final deployment URL and ID are reported in the cron release report, while this QA file preserves both the matrix-tested deployment and the final recheck proof bundle.
- Final recheck proof: `research/qa/proofs/brush-v052-2026-11-09-production-final/`.
- Final recheck: **20/20 matrix**, interaction, blind preview, readbacks, diagnostics, and overflow gates passed again.
