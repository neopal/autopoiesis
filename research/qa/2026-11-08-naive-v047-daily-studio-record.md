# Mutine daily work record — Naive v047 — 2026-11-08

## Target

- Current: **Naive art** (`current_index=5/6`)
- Work: **The model keeps the wrong correction.**
- Route: `/studies/naive-art/v047/`
- Canonical record: `naive-2026-11-08`
- Status: `candidate / held`

## Direction

v047 is a deliberate medium and encounter switch from the last three Naive records: v044's shutter wall/departure, v045's pressure membrane, and v046's suspended WEBGL vessel/stillness. The new grammar is a horizontal Canvas 2D proof ledger with nine abstract fragments.

- Changed rule: a correction remains geometry-neutral while travelling; only release after sufficient travel and pressure prints a real misprint into a different slot while the source remains exact.
- Visible consequence: the target fragment changes offset, phase, width, height, rotation, and registration scar. Four misprints compound as liftable memory.
- Falsifier/deletion condition: reject if short or weak traces commit, the source changes, the target is only colour/readout, memory resets, exact lifting fails, or the blind view reads as another wall/slab/vessel/barcode grammar.

## Cultural translation

- Reference: [p5.brush](https://github.com/acamposuribe/p5.brush)
- Observed mechanism: pressure, density, direction, and field behaviour participate in producing geometry rather than decorating a finished mark.
- Mutine translation: refuse brushes, watercolor, hatching, grain, palette, composition, code, examples, and API surface; translate material production into a naive copy error where a travelled correction is printed elsewhere.
- Direction consequence: closes the recent stillness / pressure / departure sequence and opens copy-error as material memory.

## TDD and local evidence

- RED observed: `node --test tests/naive-art-v047.test.mjs` failed with the expected missing `v047/engine.mjs` before implementation.
- GREEN targeted slice: **5 passed, 0 failed**.
- Full suite: **1,470 passed, 0 failed**.
- Syntax: `node --check` passed for `engine.mjs`, `sketch.js`, `tests/naive-art-v047.test.mjs`, and the Playwright probe.
- Local browser matrix: **20/20** raw/canonical runs passed at `320×568`, `390×844`, `768×1024`, `1280×800`, and `1920×1080`, normal and reduced motion.
- Local browser evidence: diagnostics `0`, first-party failures `0`, overflow `0`, target widths valid, minimum touch target `44px`.
- Local interactions: pointer drag committed; keyboard `ArrowRight + Enter` committed; `Delete` lifted; `Escape` released; short drag refused; four control commits compounded.
- Blind local preview: four misprints retained; readout, controls, hint, and site furniture hidden; `innerWidth/clientWidth/scrollWidth = 390/390/390` in both motion modes.

## Production evidence

- Deployment: `https://autopoiesis-o6puf0u3t-lairpa-hotmailfrs-projects.vercel.app`
- Stable alias: `https://autopoiesis-nine.vercel.app`
- Deployment id: `dpl_CAvb7QinBaNGQMt7WzCCqhxtKUNp`
- Stable-alias browser matrix: **20/20** raw/canonical runs passed across the same five viewports and two motion modes.
- Stable-alias diagnostics `0`, first-party failures `0`, overflow `0`, target widths valid, minimum touch target `44px`.
- Stable-alias Journal browser readback at `390×844`: anchor `journal-naive-2026-11-08` and exact title visible; `scrollWidth = clientWidth = 390`; no browser errors.
- HTTP readbacks: canonical work, raw tableau, `/studio/data/works.json`, `/studio/data/catalog-public.json`, `/studio/favicon.svg`, and `/favicon.svg` returned `200`.
- Deployed source catalog contained exactly one `naive-2026-11-08` record with raw path `/studies/naive-art/v047/` and Journal anchor `journal-naive-2026-11-08`.

## Unresolved

The candidate remains held pending independent caption-free perceptual review of the blind proof strip and provider-side revision linkage between the final Vercel deployment and GitHub SHA. The manual Vercel deployment is verified separately from GitHub synchronization; no automatic commit-to-deployment linkage is claimed.
